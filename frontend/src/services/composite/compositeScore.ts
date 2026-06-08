import { noiseScore } from '../noise/noiseScore'
import { cellCityCoreIndex } from '../cityCore/cityCoreScore'
import type { CityCoreCellProps } from '../cityCore/cityCoreData'

export interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  openPrice: number
  price: number
}

export interface CellBundle {
  h3: string
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
  saleEurM2: number | null
  medianPrice: number | null
}

export interface OpenPriceBounds {
  p5: number
  p95: number
}

/**
 * Normalises INCASOL sale price (EUR/m²) to 0–100 using dataset p5/p95 bounds.
 * Lower price → higher score (cheaper is better).
 */
export function openPriceScore(
  saleEurM2: number,
  bounds: OpenPriceBounds,
): number {
  const { p5, p95 } = bounds
  if (p95 === p5) return 50
  return Math.max(0, Math.min(100, Math.round(((p95 - saleEurM2) / (p95 - p5)) * 100)))
}

/**
 * Normalises an Idealista median price to 0–100 relative to the user's price filter range.
 * Lower price → higher score (cheaper is better).
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
export interface ComponentScores {
  poiAccess: number
  noise: number | null
  cityCore: number
  openPrice: number | null
  price: number | null
}

export function computeComposite(
  bundle: CellBundle,
  weights: CompositeWeights,
  enabledLandmarkIds: readonly string[],
  priceRange: [number, number],
  openPriceBounds: OpenPriceBounds,
): { score: number; hasGap: boolean; components: ComponentScores } {
  const noiseVal = bundle.lden !== null ? noiseScore(bundle.lden) : null
  const cityVal = cellCityCoreIndex(bundle.cityCoreProps, enabledLandmarkIds)
  const openPriceVal = bundle.saleEurM2 !== null
    ? openPriceScore(bundle.saleEurM2, openPriceBounds)
    : null
  const priceVal = bundle.medianPrice !== null ? priceScore(bundle.medianPrice, priceRange) : null

  const components: ComponentScores = {
    poiAccess: bundle.walk,
    noise: noiseVal,
    cityCore: cityVal,
    openPrice: openPriceVal,
    price: priceVal,
  }

  let weightedSum = 0
  let totalWeight = 0
  let hasGap = false

  if (weights.poiAccess > 0) {
    weightedSum += bundle.walk * weights.poiAccess
    totalWeight += weights.poiAccess
  }

  if (weights.noise > 0) {
    if (noiseVal === null) {
      hasGap = true
    } else {
      weightedSum += noiseVal * weights.noise
    }
    totalWeight += weights.noise
  }

  if (weights.cityCore > 0) {
    weightedSum += cityVal * weights.cityCore
    totalWeight += weights.cityCore
  }

  if (weights.openPrice > 0) {
    if (openPriceVal === null) {
      hasGap = true
    } else {
      weightedSum += openPriceVal * weights.openPrice
    }
    totalWeight += weights.openPrice
  }

  if (weights.price > 0) {
    if (priceVal === null) {
      hasGap = true
    } else {
      weightedSum += priceVal * weights.price
    }
    totalWeight += weights.price
  }

  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight)
  return { score, hasGap, components }
}
