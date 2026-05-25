import buffer from '@turf/buffer'
import type { MultiLineString, Polygon, MultiPolygon } from 'geojson'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Barcelona bounding box for Overpass queries: south,west,north,east
const BCN_BBOX = '41.30,2.05,41.48,2.35'

// Maps Spanish street-type prefixes to Catalan — Barcelona OSM data uses Catalan names.
const SPANISH_TO_CATALAN: [RegExp, string][] = [
  [/^Calle del\s+/i, 'Carrer del '],
  [/^Calle de la\s+/i, 'Carrer de la '],
  [/^Calle de los\s+/i, 'Carrer dels '],
  [/^Calle de\s+/i, 'Carrer de '],
  [/^Calle\s+/i, 'Carrer '],
  [/^Avenida del\s+/i, 'Avinguda del '],
  [/^Avenida de la\s+/i, 'Avinguda de la '],
  [/^Avenida de\s+/i, 'Avinguda de '],
  [/^Avenida\s+/i, 'Avinguda '],
  [/^Plaza de la\s+/i, 'Plaça de la '],
  [/^Plaza de\s+/i, 'Plaça de '],
  [/^Plaza\s+/i, 'Plaça '],
  [/^Paseo de\s+/i, 'Passeig de '],
  [/^Paseo\s+/i, 'Passeig '],
  [/^Gran Vía\s*/i, 'Gran Via '],
]

export interface GeocodedLocation {
  coords: [number, number]
  accuracyPolygon?: Polygon | MultiPolygon
}

function toBarcelonaCatalan(street: string): string {
  for (const [pattern, replacement] of SPANISH_TO_CATALAN) {
    if (pattern.test(street)) return street.replace(pattern, replacement)
  }
  return street
}

function ensureBarcelona(s: string): string {
  return s.toLowerCase().includes('barcelona') ? s : `${s}, Barcelona`
}

// Returns a ranked list of queries to try, from most to least specific.
function buildQueries(address: string): string[] {
  const queries: string[] = []
  const withBcn = ensureBarcelona(address)
  queries.push(withBcn)

  // If address has multiple comma-separated parts, try just the street segment.
  const street = address.split(',')[0].trim()
  if (street !== address.trim()) {
    queries.push(ensureBarcelona(street))
  }

  // Try Catalan street-type translation for the street segment.
  const catalan = toBarcelonaCatalan(street)
  if (catalan !== street) {
    queries.push(ensureBarcelona(catalan))
  }

  // Deduplicate while preserving order.
  return [...new Set(queries)]
}

// Fetches ALL way segments for a named street from Overpass API within Barcelona.
// Nominatim returns only one OSM way (a short segment); Overpass gives the full street.
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

async function tryNominatim(query: string): Promise<GeocodedLocation | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'bcn-property-finder/1.0' },
  })
  if (!res.ok) return null
  const results = await res.json()
  if (!Array.isArray(results) || results.length === 0) return null
  const { lon, lat, addresstype, name } = results[0]
  const coords: [number, number] = [parseFloat(lon), parseFloat(lat)]

  let accuracyPolygon: Polygon | MultiPolygon | undefined
  if (addresstype === 'road' && name) {
    const fullGeometry = await fetchFullStreetGeometry(name)
    if (fullGeometry) accuracyPolygon = bufferLine(fullGeometry)
  }

  return { coords, accuracyPolygon }
}

export async function geocodeAddress(address: string | null | undefined): Promise<GeocodedLocation | null> {
  if (!address) return null

  try {
    for (const query of buildQueries(address)) {
      const result = await tryNominatim(query)
      if (result) return result
    }
    return null
  } catch {
    return null
  }
}

export { buildQueries, toBarcelonaCatalan }
