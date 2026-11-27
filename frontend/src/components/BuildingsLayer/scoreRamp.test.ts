import { describe, it, expect } from 'vitest'
import { colorRange, fitScoreRange, FIXED_RANGE } from './scoreRamp'

describe('fitScoreRange', () => {
  it('spans the lowest to the highest score', () => {
    expect(fitScoreRange([60, 45.5, 70, 80.2], 0, 0)).toEqual([45, 81])
  })

  it('ignores the extreme trimPct% on each side — one outlier does not stretch the scale', () => {
    const scores = [...Array.from({ length: 98 }, (_, i) => 50 + (i * 30) / 97), 5, 99]
    expect(fitScoreRange(scores, 2, 0)).toEqual([50, 80])
    expect(fitScoreRange(scores, 0, 0)).toEqual([5, 99])
  })

  it('widens a narrow range around its middle to minSpan', () => {
    expect(fitScoreRange([70, 71, 72, 73, 74], 0, 20)).toEqual([62, 82])
    expect(fitScoreRange([55], 0, 20)).toEqual([45, 65])
  })

  it('keeps the widened range inside 0–100', () => {
    expect(fitScoreRange([95, 96, 97, 98], 0, 20)).toEqual([80, 100])
    expect(fitScoreRange([1, 2, 3], 0, 20)).toEqual([0, 20])
  })

  it('returns null when no building is in view', () => {
    expect(fitScoreRange([], 2, 20)).toBeNull()
  })
})

describe('colorRange (TODO-050)', () => {
  const scores = [60, 62, 64, 66, 68]
  it('is the fixed 0–100 scale with contrast boost off', () => {
    expect(FIXED_RANGE).toEqual([0, 100])
    expect(colorRange(false, scores)).toEqual([0, 100])
    expect(colorRange(false, [])).toEqual([0, 100])
  })
  it('fits the visible buildings with contrast boost on', () => {
    expect(colorRange(true, scores)).toEqual(fitScoreRange(scores))
  })
  it('keeps the current scale with boost on and nothing in view', () => {
    expect(colorRange(true, [])).toBeNull()
  })
})
