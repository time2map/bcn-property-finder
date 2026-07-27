import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { SERVICE_CATEGORIES } from './serviceCategories'
import { computeWalkabilityScore } from './walkabilityScore'
import type { ServiceResult } from './walkabilityTypes'

export interface NearbyResult {
  /** Top-N nearest objects per category, for map markers + the tooltip. */
  services: ServiceResult[]
  /** Walkability score 0–100 (decay + saturation over ALL objects in range). */
  score: number
}

const PMTILES_URL = `${import.meta.env.BASE_URL}barcelona_poi.pmtiles`
const ZOOM = 14
const SEARCH_RADIUS_M = 2500
export const DETOUR_FACTOR = 1.3
export const WALK_SPEED_M_PER_MIN = 80  // 4.8 km/h

let pmtiles: PMTiles | null = null

function getPmtiles(): PMTiles {
  if (!pmtiles) pmtiles = new PMTiles(PMTILES_URL)
  return pmtiles
}

function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateWalkingMinutes(distanceMeters: number): number {
  return Math.round((distanceMeters * DETOUR_FACTOR) / WALK_SPEED_M_PER_MIN)
}

interface RawFeature {
  props: Record<string, unknown>
  lat: number
  lng: number
  dist: number
}

export async function fetchNearbyServices(lng: number, lat: number): Promise<NearbyResult> {
  const deltaLat = SEARCH_RADIUS_M / 111320
  const deltaLng = SEARCH_RADIUS_M / (111320 * Math.cos((lat * Math.PI) / 180))

  // y increases going south: top-left has smaller y (higher lat), bot-right has larger y (lower lat)
  const tileNW = lngLatToTile(lng - deltaLng, lat + deltaLat, ZOOM)
  const tileSE = lngLatToTile(lng + deltaLng, lat - deltaLat, ZOOM)

  const raw: RawFeature[] = []

  for (let tx = tileNW.x; tx <= tileSE.x; tx++) {
    for (let ty = tileNW.y; ty <= tileSE.y; ty++) {
      const tileData = await getPmtiles().getZxy(ZOOM, tx, ty)
      if (!tileData) continue

      const tile = new VectorTile(new Pbf(tileData.data))
      const layer = tile.layers['poi']
      if (!layer) continue

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i).toGeoJSON(tx, ty, ZOOM)
        if (feat.geometry.type !== 'Point') continue

        const [fLng, fLat] = (feat.geometry as GeoJSON.Point).coordinates
        const dist = haversineMeters(lat, lng, fLat, fLng)
        if (dist <= SEARCH_RADIUS_M) {
          raw.push({ props: feat.properties as Record<string, unknown>, lat: fLat, lng: fLng, dist })
        }
      }
    }
  }

  const results: ServiceResult[] = []
  const distancesByCategory = new Map<string, number[]>()

  for (const cat of SERVICE_CATEGORIES) {
    const matching = raw.filter((f) => cat.matches(f.props)).sort((a, b) => a.dist - b.dist)

    // Score uses ALL matching objects in range; markers use only the nearest topN.
    distancesByCategory.set(cat.id, matching.map((f) => f.dist))

    results.push(
      ...matching.slice(0, cat.topN).map((f) => ({
        categoryId: cat.id,
        label: cat.label,
        emoji: cat.emoji,
        name: f.props.name as string | undefined,
        lat: f.lat,
        lon: f.lng,
        distanceMeters: f.dist,
        walkingMinutes: estimateWalkingMinutes(f.dist),
      })),
    )
  }

  return { services: results, score: computeWalkabilityScore(distancesByCategory) }
}
