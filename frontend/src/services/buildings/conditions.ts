/**
 * Livability conditions in real units (049): what is OK for the user ("up to 65 dB", "up to €4,000/m²"). A
 * building that meets a condition scores 100 on that component; beyond the limit the score falls linearly to 0
 * over the fall-off. The index is the mean over the conditions that are on.
 */
export interface Conditions {
  noiseMaxDb: number
  priceMaxEurM2: number
  /** Walking minutes to each chosen City Core place. */
  cityCoreMaxMin: number
  /** Walking minutes to each chosen everyday service. */
  walkMaxMin: number
  /** Residents' satisfaction with their barri, 0–10. */
  localsMin: number
}

export const DEFAULT_CONDITIONS: Conditions = {
  noiseMaxDb: Number(import.meta.env.VITE_COND_NOISE_MAX_DB ?? 65),
  priceMaxEurM2: Number(import.meta.env.VITE_COND_PRICE_MAX_EUR_M2 ?? 4000),
  cityCoreMaxMin: Number(import.meta.env.VITE_COND_CITY_CORE_MAX_MIN ?? 30),
  walkMaxMin: Number(import.meta.env.VITE_COND_WALK_MAX_MIN ?? 10),
  localsMin: Number(import.meta.env.VITE_COND_LOCALS_MIN ?? 7.5),
}

export const NOISE_FALLOFF_DB = Number(import.meta.env.VITE_COND_NOISE_FALLOFF_DB ?? 10)
export const PRICE_FALLOFF_PCT = Number(import.meta.env.VITE_COND_PRICE_FALLOFF_PCT ?? 25)
export const MINUTES_FALLOFF_FACTOR = Number(import.meta.env.VITE_COND_MINUTES_FALLOFF_FACTOR ?? 2)
export const SATISF_FALLOFF = Number(import.meta.env.VITE_COND_SATISF_FALLOFF ?? 1)

/** Slider ranges of the panel. */
export const CONDITION_RANGES: Record<keyof Conditions, { min: number; max: number; step: number }> = {
  noiseMaxDb: { min: 45, max: 75, step: 1 },
  priceMaxEurM2: { min: 1500, max: 8000, step: 100 },
  cityCoreMaxMin: { min: 10, max: 60, step: 5 },
  walkMaxMin: { min: 5, max: 15, step: 1 },
  localsMin: { min: 6.5, max: 8.5, step: 0.1 },
}

/** 100 at or below the limit, falling linearly to 0 at `zeroAt` (> limit). */
export function atMost(value: number, limit: number, zeroAt: number): number {
  if (value <= limit) return 100
  if (value >= zeroAt) return 0
  return Math.round((100 * (zeroAt - value)) / (zeroAt - limit))
}

/** 100 at or above the limit, falling linearly to 0 at `zeroAt` (< limit). */
export function atLeast(value: number, limit: number, zeroAt: number): number {
  if (value >= limit) return 100
  if (value <= zeroAt) return 0
  return Math.round((100 * (value - zeroAt)) / (limit - zeroAt))
}

export function noiseCondition(lden: number | null, c: Conditions): number | null {
  return lden === null ? null : atMost(lden, c.noiseMaxDb, c.noiseMaxDb + NOISE_FALLOFF_DB)
}

/** How far over the budget, in whole percent; 0 at or under it, and also when the overshoot rounds to 0%. */
export function priceOverPct(eurM2: number, budget: number): number {
  return eurM2 <= budget ? 0 : Math.round((100 * (eurM2 - budget)) / budget)
}

/** Up to this many percent over the budget the card says "almost fits" instead of the percentage (display only). */
export const ALMOST_FITS_PCT = 3

export function priceCondition(eurM2: number | null, c: Conditions): number | null {
  if (eurM2 !== null && priceOverPct(eurM2, c.priceMaxEurM2) === 0) return 100
  return eurM2 === null ? null : atMost(eurM2, c.priceMaxEurM2, c.priceMaxEurM2 * (1 + PRICE_FALLOFF_PCT / 100))
}

export function localsCondition(satisf: number, c: Conditions): number {
  return atLeast(satisf, c.localsMin, c.localsMin - SATISF_FALLOFF)
}

/**
 * Where a "within N minutes" score reaches 0: `factor` × the limit, but never beyond the reach of the data
 * (`capMin`; beyond it a place has no value and scores 0, so a later zero would be a cliff, TODO-073). Never at or
 * below the limit itself.
 */
export function minutesZeroAt(maxMin: number, capMin = Infinity, factor = MINUTES_FALLOFF_FACTOR): number {
  return Math.max(maxMin + 1, Math.min(maxMin * factor, capMin))
}

/** Mean over the chosen places of the "within N minutes" score; a place out of reach (null) scores 0. */
export function minutesShare(minutes: readonly (number | null)[], maxMin: number, capMin = Infinity): number {
  if (minutes.length === 0) return 0
  const zeroAt = minutesZeroAt(maxMin, capMin)
  const sum = minutes.reduce<number>((s, m) => s + (m === null ? 0 : atMost(m, maxMin, zeroAt)), 0)
  return Math.round(sum / minutes.length)
}

/** What a noise level sounds like outside the window. */
export function noiseAnchor(db: number): string {
  if (db <= 47) return 'a quiet courtyard'
  if (db <= 57) return 'a calm street'
  if (db <= 67) return 'a busy street'
  return 'a main road'
}
