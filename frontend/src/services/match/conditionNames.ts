import { SHORT_LABEL, type ConditionKey } from '../conditionOptions'
import type { CompositeWeights } from '../composite/compositeScore'
import type { RiskStrengths } from '../climateRisk/climateRisk'

const ORDER: Exclude<ConditionKey, 'risk'>[] = ['noise', 'poiAccess', 'cityCore', 'openPrice', 'localsOpinion', 'age']

/** Short names of the conditions that are on ("Quiet", "On foot", …), in the order of the editor. */
export function conditionNames(weights: CompositeWeights, risks: RiskStrengths): string[] {
  const names = ORDER.filter((k) => (weights[k] ?? 0) > 0).map((k) => SHORT_LABEL[k])
  if (Object.values(risks).some((v) => v > 0)) names.push(SHORT_LABEL.risk)
  return names
}
