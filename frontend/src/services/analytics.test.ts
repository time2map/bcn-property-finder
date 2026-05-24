import { describe, it, expect } from 'vitest'
import { computeTravelIndex } from './analytics'
import type { PinAnalytics } from '../types/pins'

function analytics(overrides: Partial<PinAnalytics> = {}): PinAnalytics {
  return { calculatedAt: '2026-01-01T00:00:00Z', ...overrides }
}

describe('computeTravelIndex', () => {
  it('returns undefined when no modes are available', () => {
    expect(computeTravelIndex(analytics())).toBeUndefined()
  })

  it('returns 100 when all modes are 0 minutes', () => {
    expect(
      computeTravelIndex(
        analytics({ walkingMinutes: 0, publicTransportMinutes: 0, cyclingMinutes: 0, drivingMinutes: 0 }),
      ),
    ).toBe(100)
  })

  it('returns 0 when all modes are at or above cap (60 min)', () => {
    expect(
      computeTravelIndex(
        analytics({ walkingMinutes: 60, publicTransportMinutes: 60, cyclingMinutes: 60, drivingMinutes: 60 }),
      ),
    ).toBe(0)
  })

  it('clamps times above 60 to 0 contribution', () => {
    const result = computeTravelIndex(
      analytics({ walkingMinutes: 120, publicTransportMinutes: 120, cyclingMinutes: 120, drivingMinutes: 120 }),
    )
    expect(result).toBe(0)
  })

  it('computes correct index with typical values', () => {
    // walk=10→norm=0.833, pt=15→norm=0.75, cycle=12→norm=0.8, car=8→norm=0.867
    // totalWeight=10, weightedSum=0.833*4+0.75*3+0.8*2+0.867*1 = 3.333+2.25+1.6+0.867 = 8.05
    // index = round(8.05/10*100) = 81
    const result = computeTravelIndex(
      analytics({ walkingMinutes: 10, publicTransportMinutes: 15, cyclingMinutes: 12, drivingMinutes: 8 }),
    )
    expect(result).toBe(81)
  })

  it('excludes undefined modes from weights', () => {
    // Only walk available: walk=30→norm=0.5, weight=4, total=4
    // index = round(0.5*4/4*100) = 50
    const result = computeTravelIndex(analytics({ walkingMinutes: 30 }))
    expect(result).toBe(50)
  })

  it('applies correct weight priority (walking > pt > cycling > car)', () => {
    // walk=0 (best), car=59 (worst), others undefined
    // walk: norm=1, weight=4 → contributes 4
    // car: norm≈0.017, weight=1 → contributes 0.017
    const walkOnly = computeTravelIndex(analytics({ walkingMinutes: 0 }))
    const carOnly = computeTravelIndex(analytics({ drivingMinutes: 0 }))
    // Same time (0), but walk index should equal car index since both normalize to 1.0
    expect(walkOnly).toBe(100)
    expect(carOnly).toBe(100)

    // Now test that walk at 30min scores higher than car at 30min (because of weight priority)
    // Actually weights affect combination, not single-mode. Test multi-mode:
    // walk=0, car=60 → walk dominates (weight 4 vs 1): index = round((1*4+0*1)/5*100) = round(400/500) = 80
    const result = computeTravelIndex(analytics({ walkingMinutes: 0, drivingMinutes: 60 }))
    expect(result).toBe(80)
  })

  it('handles partial analytics (only ORS modes, no OTP2)', () => {
    const result = computeTravelIndex(
      analytics({ walkingMinutes: 20, cyclingMinutes: 15, drivingMinutes: 10 }),
    )
    // norm: walk=0.667, cycle=0.75, car=0.833; weights: 4,2,1; total=7
    // weighted = 0.667*4+0.75*2+0.833*1 = 2.667+1.5+0.833 = 5.0
    // index = round(5.0/7*100) = round(71.4) = 71
    expect(result).toBe(71)
  })
})
