import { MATCH_BANDS, type Bands, type ConditionId } from '../match/matchSummary'
import type { BuildingArea } from '../buildings/buildingData'
import { homeWeight } from '../buildings/buildingRank'

// Ranked list of areas (TODO-051): a display aggregation of the building scores, not a scoring unit. An area
// has no score of its own in the card (DEPRECATED-027).

/** Marks "no data" in the per-condition score arrays (scores are 0–100). */
export const NO_DATA = 255

/** Areas with fewer buildings are listed after the ranked ones. */
export const AREA_MIN_BUILDINGS = Number(import.meta.env.VITE_AREA_MIN_BUILDINGS ?? 50)

/** An area is hatched when more than this share of its buildings has an incomplete-data range (060). */
export const INCOMPLETE_AREA_MIN_SHARE = Number(import.meta.env.VITE_INCOMPLETE_AREA_MIN_SHARE ?? 0.3)

/** Below this zoom the map shows areas, from it the buildings. */
export const AREA_VIEW_MAX_ZOOM = Number(import.meta.env.VITE_AREA_VIEW_MAX_ZOOM ?? 13)

export interface AreaRank {
  /** Index in `buildings-meta.json` areas = the `area` column. */
  index: number
  code: string
  name: string
  kind: BuildingArea['kind']
  /** Number of homes (dwellings, TODO-073) in the area. */
  n: number
  /** Number of buildings in the area: decides whether it is big enough to rank. */
  buildings: number
  /** Mean score 0–100 over the homes. */
  mean: number
  /** Percent of the homes in the Good or Great band. */
  shareGood: number
  /** Percent of the homes in the Great band. */
  shareGreat: number
  /** Share 0–1 of the homes with an incomplete-data range (060). */
  gapShare: number
  /** A ranked area (enough buildings) where more than `INCOMPLETE_AREA_MIN_SHARE` of the buildings have a range: drawn hatched. */
  incomplete: boolean
  /** The (up to three) conditions the area meets best, strongest first. */
  strongest: ConditionId[]
  /** False when the area has fewer than `minBuildings` buildings. */
  ranked: boolean
}

export type ComponentArrays = Partial<Record<ConditionId, Uint8Array>>

/**
 * One pass over the buildings (`scores` are the max scores, 060; `gap` flags buildings with a range): per area the
 * number of homes and of buildings, the mean score, the shares of good / great homes and the mean of each condition
 * that is on. Every figure counts homes: a building counts as many times as `homes` (the `dwellings` column) says
 * (TODO-073; absent = once). Ranked by the share of good homes, ties by mean score; small areas last.
 */
export function rankAreas(
  scores: Uint8Array,
  areaCol: Float32Array,
  areas: readonly BuildingArea[],
  components: ComponentArrays,
  active: readonly ConditionId[],
  bands: Bands = MATCH_BANDS,
  minBuildings = AREA_MIN_BUILDINGS,
  gap: Uint8Array | null = null,
  minGapShare = INCOMPLETE_AREA_MIN_SHARE,
  homes?: Float32Array,
): AreaRank[] {
  const m = areas.length
  const n = new Float64Array(m)
  const count = new Uint32Array(m)
  const sum = new Float64Array(m)
  const good = new Float64Array(m)
  const great = new Float64Array(m)
  const gaps = new Float64Array(m)
  const arrays = active.flatMap((k) => (components[k] ? [{ key: k, values: components[k]!, sum: new Float64Array(m), count: new Float64Array(m) }] : []))

  for (let i = 0; i < scores.length; i++) {
    const a = areaCol[i]
    if (a !== a || a < 0 || a >= m) continue // NaN: no area
    const s = scores[i]
    const w = homeWeight(homes, i)
    n[a] += w
    count[a]++
    sum[a] += s * w
    if (s >= bands[1]) good[a] += w
    if (s >= bands[0]) great[a] += w
    if (gap && gap[i] === 1) gaps[a] += w
    for (const c of arrays) {
      const v = c.values[i]
      if (v !== NO_DATA) { c.sum[a] += v * w; c.count[a] += w }
    }
  }

  const ranks: AreaRank[] = []
  for (let a = 0; a < m; a++) {
    if (n[a] === 0) continue
    const strongest = arrays
      .filter((c) => c.count[a] > 0)
      .map((c) => ({ key: c.key, mean: c.sum[a] / c.count[a] }))
      .sort((x, y) => y.mean - x.mean)
      .slice(0, 3)
      .map((c) => c.key)
    ranks.push({
      index: a, code: areas[a].code, name: areas[a].name, kind: areas[a].kind,
      n: n[a], buildings: count[a], mean: sum[a] / n[a], shareGood: (100 * good[a]) / n[a], shareGreat: (100 * great[a]) / n[a],
      gapShare: gaps[a] / n[a], incomplete: count[a] >= minBuildings && gaps[a] / n[a] > minGapShare,
      strongest, ranked: count[a] >= minBuildings,
    })
  }
  return ranks.sort((x, y) =>
    Number(y.ranked) - Number(x.ranked) || y.shareGood - x.shareGood || y.mean - x.mean || x.name.localeCompare(y.name))
}
