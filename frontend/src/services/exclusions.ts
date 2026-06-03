import { difference } from '@turf/difference'
import { union } from '@turf/union'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { ExclusionZone } from '../types/exclusions'

type Poly = Polygon | MultiPolygon

function toFeature(geometry: Poly): Feature<Poly> {
  return { type: 'Feature', properties: {}, geometry }
}

function collection(features: Feature<Poly>[]): FeatureCollection<Poly> {
  return { type: 'FeatureCollection', features }
}

/**
 * Subtracts the union of all exclusion zones from `base`.
 * Returns the remaining geometry, or null if nothing remains (or base is null).
 */
export function subtractExclusions(base: Poly | null, zones: ExclusionZone[]): Poly | null {
  if (!base) return null
  if (zones.length === 0) return base

  const features = zones.map((z) => toFeature(z.geometry))
  // @turf/union requires at least 2 geometries; skip it for a single zone.
  const merged = features.length === 1 ? features[0] : union(collection(features))
  if (!merged) return base

  const result = difference(collection([toFeature(base), merged as Feature<Poly>]))
  return result ? result.geometry : null
}

/** True if the coordinate falls inside any exclusion zone. */
export function isPointInExclusions(coord: [number, number], zones: ExclusionZone[]): boolean {
  return zones.some((z) => booleanPointInPolygon(coord, z.geometry))
}
