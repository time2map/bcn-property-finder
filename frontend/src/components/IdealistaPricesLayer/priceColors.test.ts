import { describe, it, expect } from 'vitest'
import { buildPriceColorExpression, priceToColor, PRICE_RAMP } from './priceColors'

describe('priceToColor', () => {
  it('returns first color for minimum price', () => {
    expect(priceToColor(100_000, 100_000, 500_000)).toBe(PRICE_RAMP[0])
  })

  it('returns last color for maximum price', () => {
    expect(priceToColor(500_000, 100_000, 500_000)).toBe(PRICE_RAMP[PRICE_RAMP.length - 1])
  })

  it('returns middle color for middle price', () => {
    const mid = priceToColor(300_000, 100_000, 500_000)
    const midIdx = Math.floor(PRICE_RAMP.length / 2)
    expect(PRICE_RAMP.indexOf(mid)).toBeGreaterThanOrEqual(midIdx - 1)
    expect(PRICE_RAMP.indexOf(mid)).toBeLessThanOrEqual(midIdx + 1)
  })

  it('clamps below min to first color', () => {
    expect(priceToColor(50_000, 100_000, 500_000)).toBe(PRICE_RAMP[0])
  })

  it('clamps above max to last color', () => {
    expect(priceToColor(999_999, 100_000, 500_000)).toBe(PRICE_RAMP[PRICE_RAMP.length - 1])
  })

  it('handles degenerate range (min === max)', () => {
    expect(priceToColor(200_000, 200_000, 200_000)).toBe(PRICE_RAMP[0])
  })
})

describe('buildPriceColorExpression', () => {
  it('returns a step expression with correct structure', () => {
    const expr = buildPriceColorExpression(100_000, 800_000)
    expect(expr[0]).toBe('step')
    expect(expr[1]).toEqual(['get', 'price'])
    // fallback color
    expect(expr[2]).toBe(PRICE_RAMP[0])
    // 6 break/color pairs after the fallback (for 7-color ramp)
    expect(expr.length).toBe(3 + (PRICE_RAMP.length - 1) * 2)
  })

  it('break values are ascending', () => {
    const expr = buildPriceColorExpression(100_000, 800_000)
    const breaks: number[] = []
    for (let i = 3; i < expr.length; i += 2) {
      breaks.push(expr[i] as number)
    }
    for (let i = 1; i < breaks.length; i++) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1])
    }
  })

  it('handles degenerate range', () => {
    const expr = buildPriceColorExpression(300_000, 300_000)
    expect(expr).toEqual([PRICE_RAMP[0]])
  })
})
