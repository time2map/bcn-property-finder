import type { PropertyPin } from '../../types/pins'
import { computeCompositeScore } from '../../services/analytics'

export type Direction = 'min' | 'max'

export interface MetricDef {
  key: string
  direction: Direction
  get: (pin: PropertyPin) => number | undefined
}

function pricePerM2(pin: PropertyPin): number | undefined {
  if (!pin.price || !pin.area) return undefined
  return Math.round(pin.price / pin.area)
}

/**
 * Comparable metrics used for "best in column" highlighting.
 * `min` → lower is better (price, commute, noise); `max` → higher is better.
 */
export const COMPARE_METRICS: MetricDef[] = [
  { key: 'score',       direction: 'max', get: (p) => (p.analytics ? computeCompositeScore(p.analytics) : undefined) },
  { key: 'price',       direction: 'min', get: (p) => p.price },
  { key: 'area',        direction: 'max', get: (p) => p.area },
  { key: 'pricePerM2',  direction: 'min', get: pricePerM2 },
  { key: 'walking',     direction: 'min', get: (p) => p.analytics?.walkingMinutes },
  { key: 'transit',     direction: 'min', get: (p) => p.analytics?.publicTransportMinutes },
  { key: 'cycling',     direction: 'min', get: (p) => p.analytics?.cyclingMinutes },
  { key: 'driving',     direction: 'min', get: (p) => p.analytics?.drivingMinutes },
  { key: 'noise',       direction: 'min', get: (p) => p.analytics?.noiseLden },
  { key: 'walkability', direction: 'max', get: (p) => p.analytics?.walkabilityScore },
]

/**
 * For every comparable metric, returns the winning value across pins —
 * or `undefined` when fewer than two pins have data (nothing to compare).
 */
export function computeBests(pins: PropertyPin[]): Record<string, number | undefined> {
  const bests: Record<string, number | undefined> = {}
  for (const def of COMPARE_METRICS) {
    const values = pins
      .map(def.get)
      .filter((v): v is number => v !== undefined)
    if (values.length < 2) {
      bests[def.key] = undefined
      continue
    }
    bests[def.key] = def.direction === 'min' ? Math.min(...values) : Math.max(...values)
  }
  return bests
}
