/**
 * Climate-risk penalties for the Livability Index (feature 036).
 *
 * The grid pipeline (scripts/climate_risk.py) stores raw exposure per H3 cell; this module turns it into
 * risks 0–1 and applies them as multiplicative penalties on the composite score, so safe cells keep
 * their score and only exposed cells lose points.
 */

/** Raw per-cell exposure baked into livability-h3.geojson. Null / missing = no data (no penalty). */
export interface ClimateRiskProps {
  flood_t10?: number | null // share of cell in ACA river flood zone, 10-year return period (0–1)
  flood_t100?: number | null // … 100-year (nested: ≥ t10)
  flood_t500?: number | null // … 500-year (nested: ≥ t100)
  fire_wui?: number | null // share of cell in the wildland–urban interface (0–1)
  fire_hazard?: number | null // distance-decayed forest hazard class / 10 (0–1)
  fire_class?: number | null // hazard class 1–10 of the strongest nearby forest pixel
  fire_dist_m?: number | null // distance to that pixel (m)
}

export interface FloodZonePenalties {
  t10: number
  t100: number
  t500: number
}

export interface RiskStrengths {
  flood: number // 0–10
  fire: number // 0–10
}

export interface Risks {
  flood: number // 0–1
  fire: number // 0–1
}

export type FloodZone = 't10' | 't100' | 't500'

/** Penalty per unit of cell area in each (exclusive) flood band. */
export const FLOOD_ZONE_PENALTIES: FloodZonePenalties = {
  t10: Number(import.meta.env.VITE_FLOOD_PENALTY_T10 ?? 1),
  t100: Number(import.meta.env.VITE_FLOOD_PENALTY_T100 ?? 0.6),
  t500: Number(import.meta.env.VITE_FLOOD_PENALTY_T500 ?? 0.25),
}

export const DEFAULT_RISK_STRENGTHS: RiskStrengths = {
  flood: Number(import.meta.env.VITE_RISK_STRENGTH_FLOOD ?? 5),
  fire: Number(import.meta.env.VITE_RISK_STRENGTH_FIRE ?? 5),
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** River-flood risk 0–1: share of the cell in each exclusive band × that band's penalty. */
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
 * Applies both risks as multiplicative penalties: score = base × (1 − sF/10·flood) × (1 − sW/10·fire).
 * Returns the final score and the points lost to each risk (flood first, then fire).
 */
export function applyRiskPenalties(
  base: number,
  risks: Risks,
  strengths: RiskStrengths,
): { score: number; floodPenalty: number; firePenalty: number } {
  const floodFactor = 1 - clamp01(strengths.flood / 10) * clamp01(risks.flood)
  const fireFactor = 1 - clamp01(strengths.fire / 10) * clamp01(risks.fire)
  const afterFlood = base * floodFactor
  const final = afterFlood * fireFactor
  return {
    score: Math.round(final),
    floodPenalty: Math.round(base - afterFlood),
    firePenalty: Math.round(afterFlood - final),
  }
}

/** Most severe flood zone touching the cell and its area share — for the detail card. */
export function mostSevereFloodZone(p: ClimateRiskProps): { zone: FloodZone; share: number } | null {
  for (const zone of ['t10', 't100', 't500'] as const) {
    const share = p[`flood_${zone}`] ?? 0
    if (share > 0) return { zone, share }
  }
  return null
}
