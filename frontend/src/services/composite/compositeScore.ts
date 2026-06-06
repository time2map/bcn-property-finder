import { noiseScore } from '../noise/noiseScore'
import { cellCityCoreIndex } from '../cityCore/cityCoreScore'
import type { CityCoreCellProps } from '../cityCore/cityCoreData'

export interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  price: number
}

export interface CellBundle {
  h3: string
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
  medianPrice: number | null
}

/**
 * Normalises a median price to a 0–100 score relative to the user's price filter range.
 * Lower price → higher score (cheaper is better).
 * Cells below min_price score 100; cells above max_price score 0.
 */
export function priceScore(
  medianPrice: number,
  priceRange: [number, number],
): number {
  const [minP, maxP] = priceRange
  if (maxP === minP) return 50
  return Math.max(0, Math.min(100, Math.round(((maxP - medianPrice) / (maxP - minP)) * 100)))
}

/**
 * Computes the composite livability score (0–100) for a single H3 cell.
 *
 * Missing-data rule: if a component has weight > 0 but no data (null),
 * it contributes 0 to the numerator while its weight still counts in the denominator.
 * hasGap is set true so the cell can be rendered with a black outline.
 */
export function computeComposite(
  bundle: CellBundle,
  weights: CompositeWeights,
  enabledLandmarkIds: readonly string[],
  priceRange: [number, number],
): { score: number; hasGap: boolean } {
  let weightedSum = 0
  let totalWeight = 0
  let hasGap = false

  if (weights.poiAccess > 0) {
    weightedSum += bundle.walk * weights.poiAccess
    totalWeight += weights.poiAccess
  }

  if (weights.noise > 0) {
    if (bundle.lden === null) {
      hasGap = true
    } else {
      weightedSum += noiseScore(bundle.lden) * weights.noise
    }
    totalWeight += weights.noise
  }

  if (weights.cityCore > 0) {
    const score = cellCityCoreIndex(bundle.cityCoreProps, enabledLandmarkIds)
    weightedSum += score * weights.cityCore
    totalWeight += weights.cityCore
  }

  if (weights.price > 0) {
    if (bundle.medianPrice === null) {
      hasGap = true
    } else {
      weightedSum += priceScore(bundle.medianPrice, priceRange) * weights.price
    }
    totalWeight += weights.price
  }

  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight)
  return { score, hasGap }
}
