import { SERVICE_CATEGORIES } from './serviceCategories'

// Walkability via distance-decay + per-category saturation (feature 010/017).
//
// For each category we sum a distance-decayed contribution of every nearby object
// (closer counts more, more objects add up but with diminishing returns), then squash to 0–1 with
// a per-category saturation constant, and aggregate the categories with weights.
//
//   access_c  = Σ exp(-d_i / D0)        over objects with d_i ≤ RMAX_M
//   sub_c     = 1 − exp(-access_c / S_c)
//   score     = 100 · Σ (w_c · sub_c) / Σ w_c
//
// This replaces the old binary "category covered within 1200 m" rule, which saturated to green
// across dense Barcelona and ignored how many / how close the services were.

// Distance at which an object's contribution decays to 1/e (~0.37). Smaller = proximity matters more.
export const WALK_DECAY_M = Number(import.meta.env.VITE_WALK_DECAY_M ?? 400)
// Hard cutoff: objects beyond this contribute nothing.
export const WALK_RMAX_M = Number(import.meta.env.VITE_WALK_RMAX_M ?? 1500)

/** Distance-decayed access of one category from a list of object distances (metres). */
export function categoryAccess(distancesM: number[]): number {
  let sum = 0
  for (const d of distancesM) {
    if (d <= WALK_RMAX_M) sum += Math.exp(-d / WALK_DECAY_M)
  }
  return sum
}

/** Category sub-score 0–1 with diminishing returns (saturation S). */
export function categorySubScore(distancesM: number[], saturation: number): number {
  return 1 - Math.exp(-categoryAccess(distancesM) / saturation)
}

/**
 * Walkability score 0–100 from per-category object distances (metres).
 * `distancesByCategory` maps a category id to the distances of *all* matching objects within range.
 */
export function computeWalkabilityScore(distancesByCategory: Map<string, number[]>): number {
  let weighted = 0
  let totalWeight = 0
  for (const cat of SERVICE_CATEGORIES) {
    const sub = categorySubScore(distancesByCategory.get(cat.id) ?? [], cat.saturation)
    weighted += sub * cat.weight
    totalWeight += cat.weight
  }
  return Math.round((weighted / totalWeight) * 100)
}
