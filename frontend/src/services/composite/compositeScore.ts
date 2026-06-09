import { noiseScore } from '../noise/noiseScore'
import { cellCityCoreIndex } from '../cityCore/cityCoreScore'
import type { CityCoreCellProps } from '../cityCore/cityCoreData'

export interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  openPrice: number
}

export interface CellBundle {
  h3: string
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
  saleEurM2: number | null
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
}

export function computeComposite(
  bundle: CellBundle,
  weights: CompositeWeights,
  enabledLandmarkIds: readonly string[],
  openPriceBounds: OpenPriceBounds,
): { score: number; hasGap: boolean; components: ComponentScores } {
  const noiseVal = bundle.lden !== null ? noiseScore(bundle.lden) : null
  const cityVal = cellCityCoreIndex(bundle.cityCoreProps, enabledLandmarkIds)
  const openPriceVal = bundle.saleEurM2 !== null
    ? openPriceScore(bundle.saleEurM2, openPriceBounds)
    : null

  const components: ComponentScores = {
    poiAccess: bundle.walk,
    noise: noiseVal,
    cityCore: cityVal,
    openPrice: openPriceVal,
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

  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight)
  return { score, hasGap, components }
}
