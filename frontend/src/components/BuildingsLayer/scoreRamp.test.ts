import { describe, it, expect } from 'vitest'
import { buildStateColorForRange, fitScoreRange, FIXED_RANGE } from './scoreRamp'

describe('scoreRamp (TODO-050, 077)', () => {
  it('the colour scale is the fixed 0–100, transparent until a score is set', () => {
    expect(FIXED_RANGE).toEqual([0, 100])
    const color = buildStateColorForRange(...FIXED_RANGE) as unknown[]
    expect((color[2] as unknown[]).slice(3).filter((_, i) => i % 2 === 0)).toEqual([0, 25, 50, 75, 100])
    expect(color[3]).toBe('rgba(0,0,0,0)')
  })
})

describe('fitScoreRange (the commute zone, 077)', () => {
  it('spans the lowest to the highest score', () => {
    expect(fitScoreRange([60, 45.5, 70, 80.2], 0, 0)).toEqual([45, 81])
  })

  it('ignores the extreme trimPct% on each side — one outlier does not stretch the scale', () => {
    const scores = [...Array.from({ length: 98 }, (_, i) => 50 + (i * 30) / 97), 5, 99]
    expect(fitScoreRange(scores, 2, 0)).toEqual([50, 80])
    expect(fitScoreRange(scores, 0, 0)).toEqual([5, 99])
  })

  it('widens a narrow range around its middle to minSpan, inside 0–100', () => {
    expect(fitScoreRange([70, 71, 72, 73, 74], 0, 20)).toEqual([62, 82])
    expect(fitScoreRange([95, 96, 97, 98], 0, 20)).toEqual([80, 100])
    expect(fitScoreRange([1, 2, 3], 0, 20)).toEqual([0, 20])
  })

  it('takes typed arrays, and returns null when there is nothing to fit', () => {
    expect(fitScoreRange(Uint8Array.from([40, 90]), 0, 0)).toEqual([40, 90])
    expect(fitScoreRange([], 2, 20)).toBeNull()
  })
})
