import type { MultiPolygon, Polygon } from 'geojson'

function encodeValue(value: number): string {
  let v = Math.round(value * 1e5)
  v = v < 0 ? ~(v << 1) : v << 1
  let chunk = ''
  while (v >= 0x20) {
    chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  return chunk + String.fromCharCode(v + 63)
}

// Encodes [lat, lng] pairs as a Google Encoded Polyline string.
function encodePolyline(coords: [number, number][]): string {
  let result = ''
  let prevLat = 0
  let prevLng = 0
  for (const [lat, lng] of coords) {
    result += encodeValue(lat - prevLat)
    result += encodeValue(lng - prevLng)
    prevLat = lat
    prevLng = lng
  }
  return result
}

// Shoelace formula — returns absolute area of a GeoJSON ring ([lng, lat] pairs).
function ringArea(ring: number[][]): number {
  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(area / 2)
}

// Returns a Polygon from the sub-polygon with the largest outer ring.
export function largestPolygon(geometry: Polygon | MultiPolygon): Polygon {
  if (geometry.type === 'Polygon') return geometry
  const largest = geometry.coordinates.reduce((best, poly) =>
    ringArea(poly[0]) > ringArea(best[0]) ? poly : best,
  )
  return { type: 'Polygon', coordinates: largest }
}

const DEFAULT_BASE = 'https://www.idealista.com/areas/venta-viviendas/mapa-google'

/**
 * Parses a user-supplied Idealista URL, strips the `shape` parameter, and returns the
 * base string (origin + path + remaining query params) ready to append `?shape=…` to.
 * Returns null if the URL is not a valid Idealista property-search URL.
 */
export function parseIdealistaBaseUrl(input: string): string | null {
  let url: URL
  try { url = new URL(input.trim()) } catch { return null }
  if (!url.hostname.includes('idealista.com')) return null
  const path = url.pathname
  if (!path.includes('venta-viviendas') && !path.includes('alquiler-viviendas')) return null
  url.searchParams.delete('shape')
  const qs = url.searchParams.toString()
  return url.origin + url.pathname + (qs ? `?${qs}` : '')
}

// Builds a search URL for ONE simple polygon. Idealista's `shape` accepts a single
// hole-free outer ring only — multiple polygons (400) and holes (silently filled) are not
// supported, so exclusions are handled upstream by splitting the area into simple polygons
// (services/idealistaAreas.ts).
// When `baseUrl` is provided (user's saved filter URL with `shape` already removed), the
// shape parameter is appended to it instead of the default template.
export function buildIdealistaUrl(polygon: Polygon | MultiPolygon, baseUrl?: string | null): string {
  const { coordinates } = largestPolygon(polygon)
  // GeoJSON ring is [lng, lat]; polyline spec requires [lat, lng]
  const coords = coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
  const encoded = encodePolyline(coords)
  // Idealista requires the (( )) wrapper to be percent-encoded (%28%28…%29%29).
  // encodeURIComponent does NOT encode ( and ) (they are RFC 3986 unreserved), so we
  // encode the delimiters explicitly and percent-encode only the polyline body.
  const shape = '%28%28' + encodeURIComponent(encoded) + '%29%29'
  const base = baseUrl ?? DEFAULT_BASE
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}shape=${shape}`
}
