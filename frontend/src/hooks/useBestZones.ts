import { useEffect, useMemo, useRef, useState } from 'react'
import type { Polygon } from 'geojson'
import { useStore } from '../store'
import { useIdealistaBaseUrlStore } from '../store/idealistaBaseUrlStore'
import { useExclusionsStore } from '../store/exclusionsStore'
import { features } from '../features'
import { allowedCells, findZoneCells, RES, zoneOutline } from '../services/bestZones'
import { buildIdealistaUrl } from '../services/idealista'
import { loadBuildings } from '../services/buildings/buildingData'
import { cellMeans, centroidCells } from '../services/buildings/bestZoneGrid'

/**
 * Best zones (feature 038) for the captured viewport, on the res-9 H3 grid: each cell scores the mean of
 * the buildings whose centroid is in it (TODO-046; the scores are the ones BuildingsLayer computed).
 * Derived state: new scores (weights, risks, landmarks, categories) or a new isochrone/exclusion restriction
 * recompute the zones from scratch; changing only strictness keeps them sticky.
 * `ready` is false until the score data has loaded (so "no zones" isn't shown prematurely).
 */
export function useBestZones(): { zones: Polygon[]; urls: string[]; labels: number[]; ready: boolean } {
  const bounds = useStore((s) => s.bestZonesBounds)
  const topPct = useStore((s) => s.bestZonesTopPct)
  const baseUrl = useIdealistaBaseUrlStore((s) => s.baseUrl)
  const restrict = useStore((s) => s.bestZonesRestrict)
  const isochrone = useStore((s) => s.resultPolygon)
  const exclusions = useExclusionsStore((s) => s.zones)
  const buildingScores = useStore((s) => s.buildingScores)
  // Cell of each building centroid, once. Same module-cached loader as the map layer — usually resolved.
  const [buildingCells, setBuildingCells] = useState<string[] | null>(null)
  useEffect(() => {
    if (!bounds || buildingCells) return
    let cancelled = false
    loadBuildings()
      .then((b) => { if (!cancelled) setBuildingCells(centroidCells(b, RES)) })
      .catch((err) => console.error('Best zones: score data failed to load', err))
    return () => { cancelled = true }
  }, [bounds, buildingCells])

  const scores = useMemo(
    () => (buildingCells && buildingScores ? cellMeans(buildingScores, buildingCells) : null),
    [buildingCells, buildingScores],
  )

  const allowed = useMemo(() => (restrict ? allowedCells(
    features.isochrone ? isochrone : null,
    features.exclusions ? exclusions.map((z) => z.geometry) : [],
  ) : undefined), [restrict, isochrone, exclusions])

  // Everything but strictness: the view, the restriction and the scores (a new map whenever the settings
  // change; building scores arrive a moment after the settings). While it stays the same, the zones of the
  // last fresh computation (the anchor) are handed over as sticky — moving the strictness slider
  // narrows/widens zones in place instead of swapping them, and coming back to a strictness gives the same
  // zones again.
  const key = JSON.stringify(bounds)
  const anchor = useRef<{ key: string; allowed: typeof allowed; scores: typeof scores; cells: string[][] } | null>(null)
  const same = anchor.current?.key === key && anchor.current.allowed === allowed && anchor.current.scores === scores
  const sticky = same ? anchor.current!.cells : undefined
  const cells = useMemo(
    () => (bounds && scores ? findZoneCells({ scores, bounds, topPct, sticky, allowed }) : []),
    [bounds, scores, topPct, sticky, allowed],
  )
  useEffect(() => {
    if (scores && !same) anchor.current = { key, allowed, scores, cells }
  }, [key, allowed, cells, scores, same])

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
