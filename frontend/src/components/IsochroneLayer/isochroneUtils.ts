import type { MultiPolygon, Polygon } from 'geojson'

export function getTopmostPoint(polygon: Polygon | MultiPolygon): [number, number] {
  const rings =
    polygon.type === 'MultiPolygon'
      ? polygon.coordinates.map((p) => p[0])
      : [polygon.coordinates[0]]

  let topLat = -Infinity
  let topLng = 0
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat > topLat) {
        topLat = lat
        topLng = lng
      }
    }
  }
  return [topLng, topLat]
}
