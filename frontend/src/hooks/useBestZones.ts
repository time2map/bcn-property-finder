import { useEffect, useMemo, useRef, useState } from 'react'
import type { Polygon } from 'geojson'
import { useStore } from '../store'
import { useIdealistaBaseUrlStore } from '../store/idealistaBaseUrlStore'
import { loadBundles, loadOpenPriceMeta, type CellBundle } from '../services/composite/compositeData'
import { computeComposite, type OpenPriceBounds } from '../services/composite/compositeScore'
import { findZoneCells, zoneOutline } from '../services/bestZones'
import { buildIdealistaUrl } from '../services/idealista'

/**
 * Best zones (feature 038) for the captured viewport. Derived state: changing weights, risks,
 * landmarks or score range recomputes them from scratch; changing only strictness keeps them sticky.
 * `ready` is false until the score data has loaded (so "no zones" isn't shown prematurely).
 */
export function useBestZones(): { zones: Polygon[]; urls: string[]; labels: number[]; ready: boolean } {
  const bounds = useStore((s) => s.bestZonesBounds)
  const topPct = useStore((s) => s.bestZonesTopPct)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const baseUrl = useIdealistaBaseUrlStore((s) => s.baseUrl)
  const [data, setData] = useState<{ bundles: CellBundle[]; priceBounds: OpenPriceBounds } | null>(null)

  // Same module-cached loaders as CompositeLayer — usually already resolved.
  useEffect(() => {
    if (!bounds || data) return
    let cancelled = false
    Promise.all([loadBundles(), loadOpenPriceMeta()])
      .then(([bundles, priceBounds]) => { if (!cancelled) setData({ bundles, priceBounds }) })
      .catch((err) => console.error('Best zones: score data failed to load', err))
    return () => { cancelled = true }
  }, [bounds, data])

  const scores = useMemo(() => data && new Map(data.bundles.map((b) => [
    b.h3,
    computeComposite(b, weights, enabledLandmarkIds, data.priceBounds, riskStrengths).score,
  ])), [data, weights, enabledLandmarkIds, riskStrengths])

  // Everything but strictness. While it stays the same, the zones of the last fresh computation
  // (the anchor) are handed over as sticky — moving the strictness slider narrows/widens zones in
  // place instead of swapping them, and coming back to a strictness gives the same zones again.
  const key = JSON.stringify([bounds, weights, enabledLandmarkIds, riskStrengths, scoreRange])
  const anchor = useRef<{ key: string; cells: string[][] } | null>(null)
  const sticky = anchor.current?.key === key ? anchor.current.cells : undefined
  const cells = useMemo(
    () => (bounds && scores ? findZoneCells({ scores, bounds, scoreRange, topPct, sticky }) : []),
    [bounds, scores, scoreRange, topPct, sticky],
  )
  useEffect(() => {
    if (scores && anchor.current?.key !== key) anchor.current = { key, cells }
  }, [key, cells, scores])

  // A zone keeps its anchor's number; a vanished one leaves a gap; newcomers get the next numbers.
  const labels = useMemo(() => {
    const ref = sticky ?? cells
    const taken = new Set<number>()
    let next = ref.length
    return cells.map((zone) => {
      const hexes = new Set(zone)
      const i = ref.findIndex((r, j) => !taken.has(j) && r.some((h) => hexes.has(h)))
      if (i < 0) return ++next
      taken.add(i)
      return i + 1
    })
  }, [cells, sticky])

  const zones = useMemo(() => cells.map((c) => zoneOutline(c, baseUrl)), [cells, baseUrl])
  const urls = useMemo(() => zones.map((z) => buildIdealistaUrl(z, baseUrl)), [zones, baseUrl])

  return { zones, urls, labels, ready: bounds !== null && scores !== null }
}
