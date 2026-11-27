import i18n from '../../i18n'
import { lazyLabels } from '../../i18n/format'
import type { MatchParts } from './matchText'
import { homeWeight } from '../buildings/buildingRank'
import { MATCH_BANDS, type Bands } from './bands'
import type { CompositeResult, CompositeWeights, ComponentScores } from '../composite/compositeScore'

// Match score (TODO-050): how the Livability score is shown. The score keeps its definition (049); this module
// only turns it into bands and a per-condition summary (the card's rows).

export type MatchBandId = 'great' | 'good' | 'partial' | 'poor'
export { DEFAULT_BANDS, MATCH_BANDS, parseBands, type Bands } from './bands'

export const BAND_LABEL = lazyLabels('conditions:band', ['great', 'good', 'partial', 'poor'] as const)
/** Band label for a score shown as a range (060): the top of the range is only possible, so "Possibly a great match". */
export const BAND_LABEL_POSSIBLY = lazyLabels('conditions:bandPossibly', ['great', 'good', 'partial', 'poor'] as const)
/** Swatch colours; the same stops as the map ramp (scoreRamp.ts). Poor runs from orange to red on the map. */
export const BAND_COLOR: Record<MatchBandId, string> = {
  great: '#1a9850', good: '#91cf60', partial: '#fee08b', poor: '#fc8d59',
}
export const BAND_ORDER: readonly MatchBandId[] = ['great', 'good', 'partial', 'poor']

/** Band of a final score (after risk penalties). */
export function matchBand(score: number, bands: Bands = MATCH_BANDS): MatchBandId {
  if (score >= bands[0]) return 'great'
  if (score >= bands[1]) return 'good'
  if (score >= bands[2]) return 'partial'
  return 'poor'
}

/**
 * Share of homes (percent) in each band, in `BAND_ORDER`, from the score of every building. A building counts as
 * many homes as `homes` (the `dwellings` column) says, at least one (TODO-073); without it, once.
 */
export function bandShares(scores: Uint8Array, bands: Bands = MATCH_BANDS, homes?: Float32Array): number[] {
  const counts = BAND_ORDER.map(() => 0)
  let total = 0
  for (let i = 0; i < scores.length; i++) {
    const w = homeWeight(homes, i)
    counts[BAND_ORDER.indexOf(matchBand(scores[i], bands))] += w
    total += w
  }
  return counts.map((n) => (total > 0 ? (100 * n) / total : 0))
}

export type ConditionId = keyof ComponentScores
export type ConditionStatus = 'met' | 'partly' | 'missed' | 'nodata'

/** Short names of the conditions, in the order the card lists them. */
export const CONDITION_LABEL = lazyLabels('conditions:label', ['noise', 'poiAccess', 'cityCore', 'openPrice', 'localsOpinion', 'age'] as const)
const ORDER = Object.keys(CONDITION_LABEL) as ConditionId[]

/** Met when the component scores 100, partly at 1–99, not met at 0; null = no data. */
export function conditionStatus(score: number | null): ConditionStatus {
  if (score === null) return 'nodata'
  if (score >= 100) return 'met'
  return score > 0 ? 'partly' : 'missed'
}

export interface MatchRow {
  id: ConditionId
  label: string
  status: ConditionStatus
  text: string
  /** The value and its limit, split for the card's rows (072); `value` reads "no data" without data. */
  value?: string
  limit?: string
}

export interface MatchSummary {
  met: number
  total: number
  rows: MatchRow[]
}

/** The conditions that are on, how the building does on each, and how many it meets. */
export function matchSummary(
  result: CompositeResult,
  weights: CompositeWeights,
  texts: Partial<Record<ConditionId, string>> = {},
  parts: Partial<Record<ConditionId, MatchParts>> = {},
): MatchSummary {
  const rows: MatchRow[] = []
  for (const id of ORDER) {
    if ((weights[id] ?? 0) <= 0) continue
    const status = conditionStatus(result.components[id])
    const text = status === 'nodata' ? i18n.t('conditions:match.noData') : texts[id] ?? ''
    const p = status === 'nodata' ? { value: text } : parts[id]
    rows.push({ id, label: CONDITION_LABEL[id], status, text, ...(p ? { value: p.value, limit: p.limit } : {}) })
  }
  return { met: rows.filter((r) => r.status === 'met').length, total: rows.length, rows }
}

const RISK_KEYS = ['flood', 'street', 'fire'] as const
const RISK_LABEL = lazyLabels('conditions:risk', RISK_KEYS)

/** "Risk: −6 points — river flooding (100-year zone), street flooding"; null when no risk costs points. */
export function riskLine(
  penalties: CompositeResult['penalties'],
  detail: Partial<Record<keyof typeof RISK_LABEL, string>> = {},
): string | null {
  const costly = (Object.keys(RISK_LABEL) as (keyof typeof RISK_LABEL)[]).filter((k) => penalties[k] > 0)
  if (costly.length === 0) return null
  const points = costly.reduce((sum, k) => sum + penalties[k], 0)
  const names = costly.map((k) => (detail[k] ? `${RISK_LABEL[k]} (${detail[k]})` : RISK_LABEL[k]))
  return i18n.t('conditions:match.risk', { points, names: names.join(', ') })
}

/**
 * Hover tooltip on a building: "Good match · 78"; "~78" when the data is incomplete (060). No "meets N of M" count
 * (decided 2026-11-16: a condition counts as met only at 100, so a 92 read "meets 1 of 3" and argued with the band).
 */
export function matchTooltip(score: number, bands: Bands = MATCH_BANDS, incomplete = false): string {
  return `${BAND_LABEL[matchBand(score, bands)]} · ${incomplete ? '~' : ''}${score}`
}
