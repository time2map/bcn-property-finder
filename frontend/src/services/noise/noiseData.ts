import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

const PMTILES_URL = `${import.meta.env.BASE_URL}data/noise.pmtiles`
const SCORE_ZOOM = 14

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

export async function getNoiseLden(lng: number, lat: number): Promise<number | undefined> {
  const { x, y } = lngLatToTile(lng, lat, SCORE_ZOOM)
  const tileData = await getPmtiles().getZxy(SCORE_ZOOM, x, y)
  if (!tileData) return undefined

  const tile = new VectorTile(new Pbf(tileData.data))
  const layer = tile.layers['noise']
  if (!layer) return undefined

  const pt = point([lng, lat])
  for (let i = 0; i < layer.length; i++) {
    const feat = layer.feature(i).toGeoJSON(x, y, SCORE_ZOOM)
    if (booleanPointInPolygon(pt, feat as Parameters<typeof booleanPointInPolygon>[1])) {
      const lden = feat.properties?.lden
      return typeof lden === 'number' ? lden : undefined
    }
  }
  return undefined
}
