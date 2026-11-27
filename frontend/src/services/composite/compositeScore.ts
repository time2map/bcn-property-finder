import { applyRiskPenalties, type Risks, type RiskStrengths } from '../climateRisk/climateRisk'
import { MATCH_BANDS } from '../match/bands'

/** The budget is a hard condition (TODO-073): over it, a home is at most a partial match. ENV `VITE_BUDGET_HARD`. */
export const BUDGET_HARD = (import.meta.env.VITE_BUDGET_HARD ?? 'true') !== 'false'

/**
 * Highest final score a home can have for its budget score `p` (0–100): the top of the "Partial" band at `p` = 0,
 * rising in a straight line to 100 at `p` = 100, so a home just inside the fall-off and one just past it differ by
 * a few points, not by a band. `good` is the lower edge of the "Good" band.
 */
export function budgetCeiling(p: number, good = MATCH_BANDS[1]): number {
  const floor = good - 1
  return floor + ((100 - floor) * Math.max(0, Math.min(100, p))) / 100
}

/**
 * Which conditions are on: 1 = on, 0 = off (049: every condition counts the same). Stored weights from before 049
 * (1–10) are read as "on" by the store.
 */
export interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  openPrice: number
  /** 042, behind a flag; absent = 0. */
  localsOpinion?: number
  /** Building age (047); absent = 0. */
  age?: number
}

/**
 * True when at least one condition is on. With none, there is nothing to score and the map stays neutral (061).
 * "Avoid flood and wildfire risk" is a condition too: on its own it colours the map by risk (everything starts at 100).
 */
export function hasConditions(weights: CompositeWeights, riskStrengths?: RiskStrengths): boolean {
  const weighted = (['poiAccess', 'noise', 'cityCore', 'openPrice', 'localsOpinion', 'age'] as const).some((k) => (weights[k] ?? 0) > 0)
  return weighted || (riskStrengths !== undefined && Object.values(riskStrengths).some((v) => v > 0))
}

/** Score 0–100 of each component of one building against the user's conditions; null = no data. */
export interface ComponentScores {
  poiAccess: number | null
  noise: number | null
  cityCore: number | null
  openPrice: number | null
  localsOpinion: number | null
  age: number | null
}

/** Inputs of one building's score (services/buildings/buildingScore.ts builds them). */
export interface ScoreInputs {
  components: ComponentScores
  /** Locals' opinion from a small survey sample (042): treated as missing data (060). */
  localsLowN?: boolean
  /** Climate risks 0–1 (036, 037); missing = no risk. */
  risks?: Risks
}

const NO_RISK_PENALTY: RiskStrengths = { flood: 0, fire: 0, street: 0 }
const NO_RISKS: Risks = { flood: 0, fire: 0, street: 0 }

export interface CompositeResult {
  /** Final score after climate-risk penalties. With gaps this is the best case (060, TODO-073): every missing condition counts 100. */
  score: number
  /** Worst case (060): every missing condition counts 0. Equals `score` when there are no gaps. */
  scoreMin: number
  /** Mean over the conditions that are on, before penalties; with gaps the best case (missing = 100). */
  baseScore: number
  hasGap: boolean
  components: ComponentScores
  risks: Risks
  /** Points lost to each risk. */
  penalties: { flood: number; fire: number; street: number }
  /** Points lost to the budget ceiling (TODO-073); 0 when the budget is met, off, without data or not hard. */
  budgetCap: number
}

/**
 * Match score (0–100) of one building: how well it meets the user's conditions, then the climate-risk
 * penalties (036), applied as multiplicative factors so safe buildings keep their score, then the budget ceiling
 * (TODO-073, `budgetCeiling`): a home over the budget cannot be made a good match by the other conditions.
 *
 * Missing-data rule (060, TODO-073): a condition that is on but has no data makes the score a range. `scoreMin`
 * counts it as 0, `score` (max) as 100: the real worst and best case. hasGap is set so the building gets the
 * hatch. Locals' opinion from a small sample counts as missing.
 */
export function computeComposite(
  inputs: ScoreInputs,
  weights: CompositeWeights,
  riskStrengths: RiskStrengths = NO_RISK_PENALTY,
  budgetHard = BUDGET_HARD,
): CompositeResult {
  const { components } = inputs
  let sum = 0
  let total = 0
  let missing = 0
  let hasGap = false
  for (const key of Object.keys(components) as (keyof ComponentScores)[]) {
    const w = weights[key] ?? 0
    if (w <= 0) continue
    const lowN = key === 'localsOpinion' && inputs.localsLowN === true
    const v = lowN ? null : components[key]
    total += w
    if (v === null) {
      hasGap = true
      missing += w
      continue
    }
    sum += v * w
  }

  const risks = inputs.risks ?? NO_RISKS
  const penalised = (base: number) => applyRiskPenalties(base, risks, riskStrengths)
  // Only risks are on (no weighted condition): nothing to average, every home starts at 100 and loses points to risk.
  const onlyRisks = total === 0 && hasConditions(weights, riskStrengths)
  const baseMin = onlyRisks ? 100 : total === 0 ? 0 : Math.round(sum / total)
  const baseScore = onlyRisks ? 100 : total === 0 ? 0 : Math.round((sum + 100 * missing) / total)
  const { score: afterRisk, floodPenalty, firePenalty, streetPenalty } = penalised(baseScore)
  // The budget ceiling comes last (TODO-073): mean, then risks, then the cap. No price data → no cap.
  const p = components.openPrice
  const ceiling = budgetHard && (weights.openPrice ?? 0) > 0 && p !== null ? Math.floor(budgetCeiling(p)) : 100
  const score = Math.min(afterRisk, ceiling)
  const minAfterRisk = hasGap ? penalised(baseMin).score : afterRisk
  return {
    score, scoreMin: Math.min(minAfterRisk, ceiling), baseScore, hasGap, components, risks,
    penalties: { flood: floodPenalty, fire: firePenalty, street: streetPenalty },
    budgetCap: afterRisk - score,
  }
}
