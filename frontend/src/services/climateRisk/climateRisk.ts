/**
 * Climate-risk penalties for the Livability Index (features 036, 037).
 *
 * This module turns a building's exposure (TODO-046, see services/buildings/buildingScore.ts) into risks 0–1
 * and applies them as multiplicative penalties on the composite score, so safe buildings keep their score
 * and only exposed buildings lose points.
 */

/** Exposure of one building. Null / missing = no data (no penalty). */
export interface ClimateRiskProps {
  flood_t10?: number | null // 1 when the footprint touches the ACA 10-year river flood zone, else 0
  flood_t100?: number | null // … 100-year (nested: ≥ t10)
  flood_t500?: number | null // … 500-year (nested: ≥ t100)
  fire_wui?: number | null // 1 when the footprint touches the wildland–urban interface, else 0
  fire_hazard?: number | null // distance-decayed forest hazard class / 10 (0–1)
  fire_class?: number | null // hazard class 1–10 of the strongest nearby forest pixel
  fire_dist_m?: number | null // distance to that pixel (m)
  // Street flooding in heavy rain (RESCCUE, Barcelona only; null outside): water-at-the-door severity 0–1
  street_t10?: number | null // 10-year rain
  street_t100?: number | null // 100-year rain
}

export interface FloodZonePenalties {
  t10: number
  t100: number
  t500: number
}

export interface RiskStrengths {
  flood: number // river flooding, 0–10
  fire: number // 0–10
  street: number // street flooding in heavy rain, 0–10
}

export interface Risks {
  flood: number // 0–1
  fire: number // 0–1
  street: number // 0–1
}

/**
 * Penalty in each (exclusive) flood band, in proportion to the chance of at least one flood within 30 years
 * (TODO-073): 10-year 96%, 100-year 26%, 500-year 6% → 1 / 0.27 / 0.06. Also used for the 10- and 100-year rain
 * of street flooding (037).
 */
export const FLOOD_ZONE_PENALTIES: FloodZonePenalties = {
  t10: Number(import.meta.env.VITE_FLOOD_PENALTY_T10 ?? 1),
  t100: Number(import.meta.env.VITE_FLOOD_PENALTY_T100 ?? 0.27),
  t500: Number(import.meta.env.VITE_FLOOD_PENALTY_T500 ?? 0.06),
}

export const DEFAULT_RISK_STRENGTHS: RiskStrengths = {
  flood: Number(import.meta.env.VITE_RISK_STRENGTH_FLOOD ?? 5),
  fire: Number(import.meta.env.VITE_RISK_STRENGTH_FIRE ?? 5),
  // Commercial use (TODO-066): the RESCCUE data has no licence, so it costs no points (docs/DATA_LICENSES.md).
  street: import.meta.env.VITE_COMMERCIAL_USE === 'true' ? 0 : Number(import.meta.env.VITE_RISK_STRENGTH_STREET ?? 5),
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** River-flood risk 0–1: exposure in each exclusive band × that band's penalty. */
export function floodRisk(p: ClimateRiskProps, penalties: FloodZonePenalties = FLOOD_ZONE_PENALTIES): number {
  const t10 = p.flood_t10 ?? 0
  const t100 = Math.max(p.flood_t100 ?? 0, t10)
  const t500 = Math.max(p.flood_t500 ?? 0, t100)
  return clamp01(t10 * penalties.t10 + (t100 - t10) * penalties.t100 + (t500 - t100) * penalties.t500)
}

/** Wildfire risk 0–1: the WUI gates the forest hazard, so urban parks outside it carry no risk. */
export function fireRisk(p: ClimateRiskProps): number {
  return clamp01((p.fire_wui ?? 0) * (p.fire_hazard ?? 0))
}

/**
 * Street-flooding risk 0–1 (feature 037): each return period's severity with the same exclusive-band
 * weighting as river zones (T10 fully, extra T100 part less).
 */
export function streetFloodRisk(p: ClimateRiskProps, penalties: FloodZonePenalties = FLOOD_ZONE_PENALTIES): number {
  if (import.meta.env.VITE_COMMERCIAL_USE === 'true') return 0
  const r10 = clamp01(p.street_t10 ?? 0)
  const r100 = Math.max(clamp01(p.street_t100 ?? 0), r10)
  return clamp01(r10 * penalties.t10 + (r100 - r10) * penalties.t100)
}

/**
 * Applies the risks as multiplicative penalties: score = base × Π (1 − strength/10 · risk).
 * Returns the final score and the points lost to each risk (river flood, then fire, then street flooding).
 */
export function applyRiskPenalties(
  base: number,
  risks: Risks,
  strengths: RiskStrengths,
): { score: number; floodPenalty: number; firePenalty: number; streetPenalty: number } {
  const factor = (k: keyof Risks) => 1 - clamp01(strengths[k] / 10) * clamp01(risks[k])
  const afterFlood = base * factor('flood')
  const afterFire = afterFlood * factor('fire')
  const final = afterFire * factor('street')
  return {
    score: Math.round(final),
    floodPenalty: Math.round(base - afterFlood),
    firePenalty: Math.round(afterFlood - afterFire),
    streetPenalty: Math.round(afterFire - final),
  }
}
