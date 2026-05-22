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

export function buildIdealistaUrl(polygon: Polygon | MultiPolygon): string {
  const { coordinates } = largestPolygon(polygon)
  // GeoJSON ring is [lng, lat]; polyline spec requires [lat, lng]
  const coords = coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
  const encoded = encodePolyline(coords)
  const shape = encodeURIComponent(`((${encoded}))`)
  return `https://www.idealista.com/areas/venta-viviendas/mapa-google?shape=${shape}`
}
