import type { Polygon } from 'geojson'

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

export function buildIdealistaUrl(polygon: Polygon): string {
  // GeoJSON ring is [lng, lat]; polyline spec requires [lat, lng]
  const coords = polygon.coordinates[0].map(
    ([lng, lat]) => [lat, lng] as [number, number],
  )
  const encoded = encodePolyline(coords)
  const shape = encodeURIComponent(`((${encoded}))`)
  return `https://www.idealista.com/areas/venta-viviendas/mapa-google?shape=${shape}`
}
