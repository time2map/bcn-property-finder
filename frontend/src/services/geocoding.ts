import buffer from '@turf/buffer'
import type { MultiLineString, Polygon, MultiPolygon } from 'geojson'

const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/search'
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Barcelona metro area bounding box: lon_min,lat_min,lon_max,lat_max
const BCN_METRO_BBOX = '1.9,41.2,2.4,41.6'

// Barcelona bounding box for Overpass queries: south,west,north,east
const BCN_BBOX = '41.20,1.90,41.60,2.40'

export interface GeocodedLocation {
  coords: [number, number]
  accuracyPolygon?: Polygon | MultiPolygon
}

// Returns ranked queries: full address first, then street-only fallback.
function buildQueries(address: string): string[] {
  const queries = [address.trim()]
  const street = address.split(',')[0].trim()
  if (street !== address.trim()) queries.push(street)
  return [...new Set(queries)]
}

// Fetches ALL way segments for a named street from Overpass API within the Barcelona metro area.
async function fetchFullStreetGeometry(streetName: string): Promise<MultiLineString | null> {
  const query = `[out:json][timeout:15];way["name"="${streetName}"](${BCN_BBOX});out geom;`
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!res.ok) return null
    const data = await res.json()
    const coords: number[][][] = (data.elements ?? [])
      .filter((el: { type: string; geometry?: { lat: number; lon: number }[] }) =>
        el.type === 'way' && Array.isArray(el.geometry),
      )
      .map((el: { geometry: { lat: number; lon: number }[] }) =>
        el.geometry.map((pt) => [pt.lon, pt.lat]),
      )
    if (coords.length === 0) return null
    return { type: 'MultiLineString', coordinates: coords }
  } catch {
    return null
  }
}

function bufferLine(line: MultiLineString): Polygon | MultiPolygon | undefined {
  try {
    const result = buffer(line, 80, { units: 'meters' })
    const geom = result?.geometry
    if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
      return geom as Polygon | MultiPolygon
    }
  } catch {
    // turf failed — no buffer
  }
  return undefined
}

async function tryGeoapify(query: string): Promise<GeocodedLocation | null> {
  const params = new URLSearchParams({
    text: query,
    filter: `rect:${BCN_METRO_BBOX}`,
    lang: 'en',
    limit: '1',
    apiKey: GEOAPIFY_API_KEY ?? '',
  })
  const res = await fetch(`${GEOAPIFY_URL}?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) return null

  const [lon, lat] = feature.geometry.coordinates as [number, number]
  const coords: [number, number] = [lon, lat]

  let accuracyPolygon: Polygon | MultiPolygon | undefined
  const { result_type, street } = feature.properties as { result_type: string; street?: string }
  if (result_type === 'street' && street) {
    const fullGeometry = await fetchFullStreetGeometry(street)
    if (fullGeometry) accuracyPolygon = bufferLine(fullGeometry)
  }

  return { coords, accuracyPolygon }
}

export async function geocodeAddress(address: string | null | undefined): Promise<GeocodedLocation | null> {
  if (!address) return null
  try {
    for (const query of buildQueries(address)) {
      const result = await tryGeoapify(query)
      if (result) return result
    }
    return null
  } catch {
    return null
  }
}

export { buildQueries }
