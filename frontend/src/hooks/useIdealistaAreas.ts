import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Polygon } from 'geojson'
import { useEffectiveArea } from './useEffectiveArea'
import { decomposeByBarris, decomposeForIdealista } from '../services/idealistaAreas'
import { buildIdealistaUrl } from '../services/idealista'
import { loadAreas } from '../services/areas'
import type { AreaFeature } from '../services/areas'
import { useStore } from '../store'
import { useIdealistaBaseUrlStore } from '../store/idealistaBaseUrlStore'

/**
 * Returns the Idealista areas that were last computed via `useComputeIdealistaAreas().compute`.
 * URLs are derived from the stored areas + the current baseUrl so they update immediately when
 * the user saves or clears their filter URL — without recomputing the zones.
 */
export function useIdealistaAreas(): { areas: Polygon[]; urls: string[]; count: number } {
  const areas = useStore((s) => s.idealistaAreas)
  const baseUrl = useIdealistaBaseUrlStore((s) => s.baseUrl)
  const urls = useMemo(() => areas.map((a) => buildIdealistaUrl(a, baseUrl)), [areas, baseUrl])
  return { areas, urls, count: areas.length }
}

/**
 * Returns a `compute` callback that runs the barri-based decomposition and stores the result,
 * a `computing` flag that is true while the computation is in progress, and `hasAreas` indicating
 * whether computed areas exist.
 *
 * Also clears the stored areas whenever the effective area changes (isochrone or exclusion zones
 * changed) — the old areas would no longer match the current search zone.
 */
export function useComputeIdealistaAreas(): {
  compute: () => void
  computing: boolean
  hasAreas: boolean
} {
  const effectiveArea = useEffectiveArea()
  const setIdealistaAreas = useStore((s) => s.setIdealistaAreas)
  const clearIdealistaAreas = useStore((s) => s.clearIdealistaAreas)
  const idealistaAreas = useStore((s) => s.idealistaAreas)

  const [loadedAreas, setLoadedAreas] = useState<AreaFeature[]>([])
  const [computing, setComputing] = useState(false)

  useEffect(() => {
    loadAreas().then(setLoadedAreas)
  }, [])

  // Whenever the effective area *changes* (after mount), any previously computed areas are stale.
  // We skip the initial mount so that areas pre-loaded into the store survive the first render.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    clearIdealistaAreas()
  }, [effectiveArea, clearIdealistaAreas])

  const compute = useCallback(() => {
    setComputing(true)
    // Let React render the loading state before the synchronous computation blocks the thread.
    setTimeout(() => {
      // Read baseUrl at execution time so fitToUrlBudget sizes polygons against the actual
      // (potentially longer) filter URL, not the default template.
      const baseUrl = useIdealistaBaseUrlStore.getState().baseUrl
      const areas =
        loadedAreas.length > 0
          ? decomposeByBarris(effectiveArea, loadedAreas, baseUrl)
          : decomposeForIdealista(effectiveArea, baseUrl)
      // URLs are derived in useIdealistaAreas (areas + baseUrl), not stored.
      setIdealistaAreas(areas, [])
      setComputing(false)
    }, 0)
  }, [effectiveArea, loadedAreas, setIdealistaAreas])

  return { compute, computing, hasAreas: idealistaAreas.length > 0 }
}
