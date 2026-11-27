import { describe, it, expect } from 'vitest'
import { percentiles } from './percentile'

describe('percentiles', () => {
  it('spreads distinct values from 0 to 1, higher is better', () => {
    expect(Array.from(percentiles([30, 10, 20]))).toEqual([1, 0, 0.5])
  })

  it('gives tied values their mean rank', () => {
    // ranks 0,1,2,3 → the two 5s share (1 + 2) / 2 = 1.5 → 1.5 / 3
    expect(Array.from(percentiles([1, 5, 5, 9]))).toEqual([0, 0.5, 0.5, 1])
  })

  it('puts missing values at 0 and ranks only the others', () => {
    expect(Array.from(percentiles([NaN, 2, 4]))).toEqual([0, 0, 1])
  })

  it('handles one value and no values', () => {
    expect(Array.from(percentiles([7]))).toEqual([0])
    expect(Array.from(percentiles([]))).toEqual([])
  })
})
