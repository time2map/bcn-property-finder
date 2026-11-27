import { useMemo } from 'react'
import type { MultiPolygon, Polygon } from 'geojson'
import { useStore } from '../store'
import { useExclusionsStore } from '../store/exclusionsStore'
import { subtractExclusions } from '../services/exclusionsGeometry'
import { features } from '../features'

/**
 * The isochrone result with all exclusion zones subtracted.
 * Shared by the isochrone mask, the Idealista export and the building layer (077: it sets the area the buildings
 * and the area ranks cover), so they always match. Null while the isochrone feature is off.
 */
export function useEffectiveArea(): Polygon | MultiPolygon | null {
  const resultPolygon = useStore((s) => s.resultPolygon)
  const zones = useExclusionsStore((s) => s.zones)
  return useMemo(() => (features.isochrone ? subtractExclusions(resultPolygon, zones) : null), [resultPolygon, zones])
}
