import { describe, it, expect } from 'vitest'
import { DEFAULT_MINUTES_CAP } from './buildingData'
import {
  CONDITION_RANGES, DEFAULT_CONDITIONS, minutesZeroAt, atLeast, atMost, localsCondition, minutesShare, noiseAnchor, noiseCondition, priceCondition,
} from './conditions'

const C = DEFAULT_CONDITIONS

describe('conditions in real units (049)', () => {
  it('defaults from env', () => {
    expect(C).toEqual({ noiseMaxDb: 65, priceMaxEurM2: 4000, cityCoreMaxMin: 30, walkMaxMin: 10, localsMin: 7.5 })
  })

  it('atMost / atLeast: 100 within the limit, linear to 0 at the far end', () => {
    expect(atMost(65, 65, 75)).toBe(100)
    expect(atMost(70, 65, 75)).toBe(50)
    expect(atMost(80, 65, 75)).toBe(0)
    expect(atLeast(7.5, 7.5, 6.5)).toBe(100)
    expect(atLeast(7, 7.5, 6.5)).toBe(50)
    expect(atLeast(6, 7.5, 6.5)).toBe(0)
  })

  it('noise: 0 at 10 dB over the limit; price: 0 at 25 % over the budget; unknown → null', () => {
    expect(noiseCondition(62, C)).toBe(100)
    expect(noiseCondition(70, C)).toBe(50)
    expect(noiseCondition(75, C)).toBe(0)
    expect(noiseCondition(null, C)).toBeNull()
    expect(priceCondition(3900, C)).toBe(100)
    expect(priceCondition(4010, C)).toBe(100) // 0.25% over rounds to 0%: it fits
    expect(priceCondition(4500, C)).toBe(50)
    expect(priceCondition(5000, C)).toBe(0)
    expect(priceCondition(null, C)).toBeNull()
  })

  it("locals: 0 one point under the user's minimum", () => {
    expect(localsCondition(7.8, C)).toBe(100)
    expect(localsCondition(7.0, C)).toBe(50)
    expect(localsCondition(6.4, C)).toBe(0)
  })

  it('minutes: the share of places within the limit, 0 at twice the limit, out of reach counts 0', () => {
    expect(minutesShare([3, 8, 10], 10)).toBe(100)
    expect(minutesShare([5, 15], 10)).toBe(75)
    expect(minutesShare([5, null], 10)).toBe(50)
    expect(minutesShare([25], 10)).toBe(0)
    expect(minutesShare([], 10)).toBe(0)
  })

  it('noise anchors in plain words', () => {
    expect(noiseAnchor(45)).toBe('a quiet courtyard')
    expect(noiseAnchor(55)).toBe('a calm street')
    expect(noiseAnchor(65)).toBe('a busy street')
    expect(noiseAnchor(72)).toBe('a main road')
  })
})

describe('no cliff at the reach of the data (TODO-073)', () => {
  it('reaches 0 at twice the limit, or earlier at the reach of the data', () => {
    expect(minutesZeroAt(10, Infinity, 2)).toBe(20)
    expect(minutesZeroAt(15, 18.75, 2)).toBe(18.75)
    expect(minutesZeroAt(60, 90, 2)).toBe(90)
    // A reach at or under the limit still leaves a fall-off of one minute.
    expect(minutesZeroAt(20, 18.75, 2)).toBe(21)
  })

  it('a service just inside the reach scores almost nothing, so dropping to "out of reach" is no jump', () => {
    const cap = DEFAULT_MINUTES_CAP.walk
    const max = CONDITION_RANGES.walkMaxMin.max
    expect(minutesShare([19], max)).toBeGreaterThan(70) // the cliff before 073: 73 points, then 0
    expect(minutesShare([19], max, cap)).toBe(0)
    expect(minutesShare([18], max, cap)).toBeLessThanOrEqual(25)
    expect(minutesShare([null], max, cap)).toBe(0)
  })

  it('every slider limit of the minutes conditions reaches 0 within the reach of the data', () => {
    const cases = [
      [CONDITION_RANGES.walkMaxMin, DEFAULT_MINUTES_CAP.walk],
      [CONDITION_RANGES.cityCoreMaxMin, DEFAULT_MINUTES_CAP.cityCore],
    ] as const
    for (const [range, cap] of cases) {
      for (let limit = range.min; limit <= range.max; limit += range.step) {
        const zeroAt = minutesZeroAt(limit, cap)
        expect(zeroAt).toBeLessThanOrEqual(Math.max(cap, limit + 1))
        expect(minutesShare([Math.ceil(zeroAt)], limit, cap)).toBe(0)
      }
    }
  })
})
