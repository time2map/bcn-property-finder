import { noiseScore } from '../noise/noiseScore'

// Reuse the same composite weights as the per-pin composite (feature 010), so the city-wide
// livability map and the per-pin score stay methodologically consistent.
const W_WALK = Number(import.meta.env.VITE_COMPOSITE_WEIGHT_WALKABILITY ?? 3)
const W_NOISE = Number(import.meta.env.VITE_COMPOSITE_WEIGHT_NOISE ?? 2)

/** Noise score (0–100) for a cell, or undefined when the cell has no Lden data. */
export function cellNoiseScore(lden: number | null | undefined): number | undefined {
  return lden === null || lden === undefined ? undefined : noiseScore(lden)
}

/**
 * Livability index (0–100) for one H3 cell.
 * - "Consider noise" off → walkability only.
 * - "Consider noise" on  → weighted composite of walkability + noise.
 * - If noise data is missing for the cell, falls back to walkability (mirrors the per-pin rule).
 */
export function livabilityIndex(
  walk: number,
  lden: number | null | undefined,
  considerNoise: boolean,
): number {
  if (!considerNoise) return walk
  const noise = cellNoiseScore(lden)
  if (noise === undefined) return walk
  return Math.round((walk * W_WALK + noise * W_NOISE) / (W_WALK + W_NOISE))
}
