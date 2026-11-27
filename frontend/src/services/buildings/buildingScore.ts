/**
 * Livability score of a building: how well it meets the user's conditions (049), each component scored by
 * services/buildings/conditions.ts from the building's columns:
 * - walkability: walking minutes from the entrance to each service category the user keeps;
 * - noise: the Lden on the street side of the building, or over every facade when it has none (TODO-073);
 * - City Core: walking minutes to each landmark the user keeps;
 * - price and Locals' opinion: the building's barri (Barcelona) or municipality;
 * - building age: the year built against the eras the user likes (047);
 * - risks: the ACA zone the footprint touches, wildfire, and water depth at the door (penalties, 036 / 037).
 */
import { computeComposite, type CompositeResult, type CompositeWeights, type ScoreInputs } from '../composite/compositeScore'
import {
  fireRisk, floodRisk, streetFloodRisk, type Risks, type RiskStrengths,
} from '../climateRisk/climateRisk'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import { minutesCapOf, valueOf, type BuildingArea, type BuildingData } from './buildingData'
import { ageScore } from './buildingAge'
import {
  localsCondition, minutesShare, noiseCondition, priceCondition, type Conditions,
} from './conditions'

/** Water at the door counts 0 up to MIN cm (stays in the gutter) and fully from MAX cm. */
export const STREET_FLOOD_MIN_CM = Number(import.meta.env.VITE_STREET_FLOOD_MIN_CM ?? 10)
export const STREET_FLOOD_MAX_CM = Number(import.meta.env.VITE_STREET_FLOOD_MAX_CM ?? 50)

export interface BuildingSettings {
  /** Which conditions are on (1) or off (0). */
  weights: CompositeWeights
  conditions: Conditions
  enabledLandmarkIds: readonly string[]
  enabledCategories: readonly string[]
  riskStrengths: RiskStrengths
  /** Building-age eras the user likes (047). */
  ageEras: readonly string[]
  /** Locals' opinion data (042); null = flag off or not loaded. */
  vibe: BarriVibeData | null
}

/** ACA zone the footprint touches (10 / 100 / 500; null = none) → nested zone shares for floodRisk. */
export function riverZoneShares(zone: number | null): { flood_t10: number; flood_t100: number; flood_t500: number } {
  return {
    flood_t10: zone === 10 ? 1 : 0,
    flood_t100: zone !== null && zone <= 100 ? 1 : 0,
    flood_t500: zone !== null ? 1 : 0,
  }
}

/** Water depth at the door (cm) → weight 0–1. */
export function doorWaterSeverity(cm: number | null, min = STREET_FLOOD_MIN_CM, max = STREET_FLOOD_MAX_CM): number {
  if (cm === null) return 0
  return Math.max(0, Math.min(1, (cm - min) / (max - min)))
}

export function buildingRisks(data: BuildingData, i: number): Risks {
  return {
    flood: floodRisk(riverZoneShares(valueOf(data, 'river_zone', i))),
    fire: fireRisk({ fire_wui: valueOf(data, 'fire_wui', i), fire_hazard: valueOf(data, 'fire_hazard', i) }),
    street: streetFloodRisk({
      street_t10: doorWaterSeverity(valueOf(data, 'street_t10_cm', i)),
      street_t100: doorWaterSeverity(valueOf(data, 'street_t100_cm', i)),
    }),
  }
}

export function buildingArea(data: BuildingData, i: number): BuildingArea | null {
  const a = valueOf(data, 'area', i)
  return a === null ? null : data.meta.areas[a] ?? null
}

/** Walking minutes of building i in the columns `<prefix><id>`; null = out of reach. */
function minutesTo(data: BuildingData, i: number, prefix: string, ids: readonly string[]): (number | null)[] {
  return ids.map((id) => valueOf(data, `${prefix}${id}`, i))
}

/**
 * The noise level the condition is checked against (TODO-073): the street side, as the EU noise directive assesses
 * the most exposed side, not the mean over street and courtyard (no window has the mean level). A building with no
 * street side (inside a block, or detached in a garden) uses the mean over its facades. Null = no noise map.
 */
export function scoredNoise(data: BuildingData, i: number): number | null {
  return valueOf(data, 'lden_street', i) ?? valueOf(data, 'lden_avg', i)
}

export function buildingBundle(data: BuildingData, i: number, s: Omit<BuildingSettings, 'weights' | 'riskStrengths'>): ScoreInputs {
  const area = buildingArea(data, i)
  const barri = area?.kind === 'barri' ? s.vibe?.barris[area.code] : undefined
  const cap = minutesCapOf(data.meta)
  return {
    components: {
      poiAccess: minutesShare(minutesTo(data, i, 'min_', s.enabledCategories), s.conditions.walkMaxMin, cap.walk),
      noise: noiseCondition(scoredNoise(data, i), s.conditions),
      cityCore: minutesShare(minutesTo(data, i, 'cc_', s.enabledLandmarkIds), s.conditions.cityCoreMaxMin, cap.cityCore),
      openPrice: priceCondition(area?.price ?? null, s.conditions),
      localsOpinion: barri ? localsCondition(barri.satisfAdj, s.conditions) : null,
      age: ageScore(valueOf(data, 'year_built', i), s.ageEras),
    },
    localsLowN: barri?.lowN ?? false,
    risks: buildingRisks(data, i),
  }
}

export function scoreBuilding(data: BuildingData, i: number, s: BuildingSettings): CompositeResult {
  return computeComposite(buildingBundle(data, i, s), s.weights, s.riskStrengths)
}

const COMPONENT_KEYS = ['poiAccess', 'noise', 'cityCore', 'openPrice', 'localsOpinion', 'age'] as const

/**
 * Final score and missing-data flag of every building, by row. With `withComponents` also the score of each
 * condition (255 = no data) for the area ranking (TODO-051); 6 × 174k bytes.
 */
export function scoreAll(
  data: BuildingData,
  s: BuildingSettings,
  withComponents = false,
): { score: Uint8Array; gap: Uint8Array; components?: Record<(typeof COMPONENT_KEYS)[number], Uint8Array> } {
  const score = new Uint8Array(data.count)
  const gap = new Uint8Array(data.count)
  const components = withComponents
    ? (Object.fromEntries(COMPONENT_KEYS.map((k) => [k, new Uint8Array(data.count)])) as Record<(typeof COMPONENT_KEYS)[number], Uint8Array>)
    : undefined
  for (let i = 0; i < data.count; i++) {
    const r = scoreBuilding(data, i, s)
    score[i] = r.score
    gap[i] = r.hasGap ? 1 : 0
    if (components) for (const k of COMPONENT_KEYS) components[k][i] = r.components[k] ?? 255
  }
  return { score, gap, components }
}
