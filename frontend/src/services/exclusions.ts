import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { ExclusionZone } from '../types/exclusions'

/** True if the coordinate falls inside any exclusion zone. */
export function isPointInExclusions(coord: [number, number], zones: ExclusionZone[]): boolean {
  return zones.some((z) => booleanPointInPolygon(coord, z.geometry))
}
