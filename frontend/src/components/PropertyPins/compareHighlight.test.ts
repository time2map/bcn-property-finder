import { describe, it, expect } from 'vitest'
import { computeBests } from './compareHighlight'
import type { PropertyPin } from '../../types/pins'

const makePin = (id: string, overrides: Partial<PropertyPin> = {}): PropertyPin => ({
  id,
  coordinates: [2.17, 41.38],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const analytics = (over: Partial<NonNullable<PropertyPin['analytics']>>) => ({
  calculatedAt: '2026-01-01T00:00:00Z',
  ...over,
})

describe('computeBests', () => {
  it('returns undefined for every metric when fewer than two pins have data', () => {
    const bests = computeBests([makePin('a', { price: 300000 })])
    expect(bests.price).toBeUndefined()
    expect(bests.area).toBeUndefined()
  })

  it('picks the lowest value for min-direction metrics (price)', () => {
    const pins = [
      makePin('a', { price: 320000 }),
      makePin('b', { price: 290000 }),
      makePin('c', { price: 410000 }),
    ]
    expect(computeBests(pins).price).toBe(290000)
  })

  it('picks the highest value for max-direction metrics (area)', () => {
    const pins = [
      makePin('a', { area: 75 }),
      makePin('b', { area: 92 }),
    ]
    expect(computeBests(pins).area).toBe(92)
  })

  it('computes best €/m² from price and area', () => {
    const pins = [
      makePin('a', { price: 320000, area: 75 }), // 4267
      makePin('b', { price: 290000, area: 68 }), // 4265
    ]
    expect(computeBests(pins).pricePerM2).toBe(4265)
  })

  it('picks the shortest commute for each travel mode', () => {
    const pins = [
      makePin('a', { analytics: analytics({ walkingMinutes: 12, drivingMinutes: 18 }) }),
      makePin('b', { analytics: analytics({ walkingMinutes: 14, drivingMinutes: 6 }) }),
    ]
    const bests = computeBests(pins)
    expect(bests.walking).toBe(12)
    expect(bests.driving).toBe(6)
  })

  it('picks the lowest noise and highest walkability', () => {
    const pins = [
      makePin('a', { analytics: analytics({ noiseLden: 55, walkabilityScore: 82 }) }),
      makePin('b', { analytics: analytics({ noiseLden: 61, walkabilityScore: 70 }) }),
    ]
    const bests = computeBests(pins)
    expect(bests.noise).toBe(55)
    expect(bests.walkability).toBe(82)
  })

  it('ignores pins missing a metric when comparing the rest', () => {
    const pins = [
      makePin('a', { price: 300000 }),
      makePin('b'),
      makePin('c', { price: 280000 }),
    ]
    expect(computeBests(pins).price).toBe(280000)
  })
})
