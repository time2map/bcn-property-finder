import { scoreAll, type BuildingSettings } from '../buildings/buildingScore'
import { homeWeight } from '../buildings/buildingRank'
import type { BuildingData } from '../buildings/buildingData'
import { matchBand, BAND_ORDER, type ConditionId } from '../match/matchSummary'
import { MATCH_BANDS } from '../match/bands'
import { NO_DATA } from '../areas/areaRank'

// The score model audit (TODO-073): figures that tell whether the default settings and the profiles make sense,
// computed with the app's own scoring code, and a guard that fails when a default condition can hardly be met. Run
// by scripts/score-audit.mjs after every data rebuild and after changing a default; tested on synthetic data.

/** Every figure counts Barcelona homes (dwellings), not buildings. */
export interface AuditResult {
  /** The conditions that are on. */
  active: ConditionId[]
  /** Percent of homes meeting each condition fully (score 100). */
  metShare: Partial<Record<ConditionId, number>>
  /** Percent of homes meeting 0, 1, …, all of the conditions. */
  metCount: number[]
  /** Percent of homes meeting every condition. */
  allMet: number
  /** Highest final score of a Barcelona building. */
  best: number
  /** Percent of homes in each band, in BAND_ORDER (great, good, partial, poor). */
  bands: number[]
  /**
   * How much of the spread of the score (before risks and the budget ceiling) each condition explains, in percent;
   * they add up to 100. Over the buildings with data for every condition that is on.
   */
  influence: Partial<Record<ConditionId, number>>
}

/** Rows of `data` in Barcelona (a barri, not a municipality). */
function barcelonaRows(data: BuildingData): number[] {
  const rows: number[] = []
  const areas = data.meta.areas
  for (let i = 0; i < data.count; i++) {
    const a = data.cols.area[i]
    if (a === a && areas[a]?.kind === 'barri') rows.push(i)
  }
  return rows
}

export function auditSettings(data: BuildingData, settings: BuildingSettings, rows = barcelonaRows(data)): AuditResult {
  const { score, components } = scoreAll(data, settings, true)
  const comp = components!
  const active = (Object.keys(comp) as ConditionId[]).filter((k) => (settings.weights[k] ?? 0) > 0)
  const homes = data.cols.dwellings
  let total = 0
  let best = 0
  const met: Record<string, number> = {}
  const metCount = new Array(active.length + 1).fill(0)
  const bands = BAND_ORDER.map(() => 0)
  // Weighted sums for the influence: mean m = Σ c_j / n; share_j = cov(c_j, m) / var(m) / n.
  const complete: { w: number; c: number[] }[] = []
  for (const i of rows) {
    const w = homeWeight(homes, i)
    total += w
    best = Math.max(best, score[i])
    bands[BAND_ORDER.indexOf(matchBand(score[i], MATCH_BANDS))] += w
    let k = 0
    const values: number[] = []
    for (const c of active) {
      const v = comp[c][i]
      if (v === 100) { met[c] = (met[c] ?? 0) + w; k++ }
      if (v !== NO_DATA) values.push(v)
    }
    metCount[k] += w
    if (values.length === active.length && active.length > 0) complete.push({ w, c: values })
  }
  const pct = (x: number) => (total > 0 ? (100 * x) / total : 0)
  return {
    active,
    metShare: Object.fromEntries(active.map((c) => [c, pct(met[c] ?? 0)])),
    metCount: metCount.map(pct),
    allMet: pct(metCount[active.length] ?? 0),
    best,
    bands: bands.map(pct),
    influence: influence(active, complete),
  }
}

/** Share of the variance of the mean each component explains (weighted by homes); empty without spread. */
export function influence(active: readonly ConditionId[], rows: readonly { w: number; c: number[] }[]): Partial<Record<ConditionId, number>> {
  const n = active.length
  let wSum = 0
  const meanC = new Array(n).fill(0)
  let meanM = 0
  for (const r of rows) {
    wSum += r.w
    const m = r.c.reduce((a, b) => a + b, 0) / n
    meanM += r.w * m
    r.c.forEach((v, j) => { meanC[j] += r.w * v })
  }
  if (wSum === 0) return {}
  meanM /= wSum
  for (let j = 0; j < n; j++) meanC[j] /= wSum
  let varM = 0
  const cov = new Array(n).fill(0)
  for (const r of rows) {
    const dm = r.c.reduce((a, b) => a + b, 0) / n - meanM
    varM += r.w * dm * dm
    r.c.forEach((v, j) => { cov[j] += r.w * (v - meanC[j]) * dm })
  }
  if (varM === 0) return {}
  return Object.fromEntries(active.map((c, j) => [c, (100 * cov[j]) / varM / n]))
}

/** The guard: what must hold for a set of settings to be offered as a default or a profile. */
export interface GuardRule {
  /** Some Barcelona building meets every condition that is on. */
  someoneMeetsAll: boolean
  /** Conditions met fully by fewer than `minShare` percent of Barcelona homes. */
  rare: ConditionId[]
}

export const GUARD_MIN_SHARE = 5

export function guard(r: AuditResult, minShare = GUARD_MIN_SHARE): GuardRule {
  return {
    someoneMeetsAll: r.allMet > 0,
    rare: r.active.filter((c) => (r.metShare[c] ?? 0) < minShare),
  }
}

export const passes = (g: GuardRule) => g.someoneMeetsAll && g.rare.length === 0
