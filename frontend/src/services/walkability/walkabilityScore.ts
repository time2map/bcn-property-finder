import { SERVICE_CATEGORIES } from './serviceCategories'
import type { ServiceResult } from './walkabilityTypes'

// Straight-line threshold for "reachable within 15 min":
// 15 min × 80 m/min / 1.3 detour ≈ 923 m — rounded to 1200 m for a generous threshold
export const WALKABILITY_THRESHOLD_M = 1200

export function computeWalkabilityScore(services: ServiceResult[]): number {
  const coveredIds = new Set(
    services
      .filter((s) => s.distanceMeters <= WALKABILITY_THRESHOLD_M)
      .map((s) => s.categoryId),
  )
  return Math.round((coveredIds.size / SERVICE_CATEGORIES.length) * 100)
}
