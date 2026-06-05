import type { CityCoreCellProps } from './cityCoreData'

/**
 * Score (0–100) for a single landmark given walking minutes from that cell.
 *   ≤ 15 min → 100
 *   15–30    → linear 100 → 75
 *   30–45    → linear 75  → 50
 *   45–90    → linear 50  → 25
 *   > 90 / null → 0
 */
export function landmarkScore(minutes: number | null | undefined): number {
  if (minutes === null || minutes === undefined) return 0
  if (minutes <= 15) return 100
  if (minutes <= 30) return Math.round(100 - ((minutes - 15) * 25) / 15)
  if (minutes <= 45) return Math.round(75 - ((minutes - 30) * 25) / 15)
  if (minutes <= 90) return Math.round(50 - ((minutes - 45) * 25) / 45)
  return 0
}

/**
 * City Core Access index (0–100) for one H3 cell.
 * Average of landmarkScore() over the enabled landmark IDs.
 * Returns 0 if no landmarks are enabled.
 */
export function cellCityCoreIndex(
  props: CityCoreCellProps,
  enabledIds: readonly string[],
): number {
  if (enabledIds.length === 0) return 0
  const scores = enabledIds.map((id) =>
    landmarkScore(props[id as keyof CityCoreCellProps] as number | null | undefined),
  )
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
