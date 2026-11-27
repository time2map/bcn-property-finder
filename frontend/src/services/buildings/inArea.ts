import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { MultiPolygon, Polygon } from 'geojson'

// ponytail: point-in-polygon per building (40–80 ms for 174k buildings and a 20-min isochrone). If it gets slow,
// skip the buildings of H3 cells that lie wholly inside (centroidCells + polygonToCellsExperimental, as in bestZones.ts).
/**
 * 077: 1 for each building whose centroid is inside the area (the isochrone minus exclusion zones; holes
 * count as outside). Each part carries its outer-ring bbox, so turf skips the far-away parts at once.
 */
export function inArea(lng: ArrayLike<number>, lat: ArrayLike<number>, area: Polygon | MultiPolygon): Uint8Array {
  const parts = (area.type === 'Polygon' ? [area.coordinates] : area.coordinates).map((coordinates) => {
    const xs = coordinates[0].map(([x]) => x)
    const ys = coordinates[0].map(([, y]) => y)
    return {
      type: 'Polygon' as const, coordinates,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number],
    }
  })
  const mask = new Uint8Array(lng.length)
  for (let i = 0; i < mask.length; i++) {
    const pt = [lng[i], lat[i]]
    if (parts.some((p) => booleanPointInPolygon(pt, p))) mask[i] = 1
  }
  return mask
}
