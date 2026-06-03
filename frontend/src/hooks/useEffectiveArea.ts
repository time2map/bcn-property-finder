import { useMemo } from 'react'
import type { MultiPolygon, Polygon } from 'geojson'
import { useStore } from '../store'
import { useExclusionsStore } from '../store/exclusionsStore'
import { subtractExclusions } from '../services/exclusions'

/**
 * The isochrone result with all exclusion zones subtracted.
 * Shared by the isochrone mask (preview) and the Idealista export so they always match.
 */
export function useEffectiveArea(): Polygon | MultiPolygon | null {
  const resultPolygon = useStore((s) => s.resultPolygon)
  const zones = useExclusionsStore((s) => s.zones)
  return useMemo(() => subtractExclusions(resultPolygon, zones), [resultPolygon, zones])
}
