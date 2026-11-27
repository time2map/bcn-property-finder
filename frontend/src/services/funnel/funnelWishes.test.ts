import { describe, it, expect } from 'vitest'
import { buildFunnelData, displayValue, formatValue } from './funnelWishes'
import { VIBE, base, fixture } from './funnelFixture'

describe('buildFunnelData', () => {
  it('keeps Barcelona buildings with at least the minimum of dwellings', () => {
    const fd = buildFunnelData(fixture(base), VIBE, 4)
    expect(Array.from(fd.rows)).toEqual([0, 1]) // 2 is Badalona, 3 too small, 4 no dwellings count
  })

  it('turns every wish into "higher is better"', () => {
    const fd = buildFunnelData(fixture(base), VIBE, 4)
    expect(Array.from(fd.values.quiet!)).toEqual([-60, -52]) // street side, else the mean of the facades
    expect(Array.from(fd.values.cheap!)).toEqual([-3000, -5000])
    expect(Array.from(fd.values.centre!)).toEqual([-10, -5]) // the nearest of the three centre places
    expect(Array.from(fd.values.metro!)).toEqual([-2, -3])
    expect(Array.from(fd.values.new!)).toEqual([1900, 2010])
    expect(Array.from(fd.values.locals!)).toEqual([6, 8])
  })

  it('a wish of two services counts the farther one, and out of reach is missing', () => {
    const fd = buildFunnelData(fixture(base), VIBE, 4)
    expect(fd.values.shops![0]).toBe(-4)
    expect(Number.isNaN(fd.values.shops![1])).toBe(true) // no pharmacy in reach
  })

  it('marks the buildings within reach of the sea', () => {
    expect(Array.from(buildFunnelData(fixture(base), VIBE, 4).seaOk)).toEqual([0, 1])
  })

  it('computes percentiles among the buildings that take part', () => {
    const fd = buildFunnelData(fixture(base), VIBE, 4)
    expect(Array.from(fd.pct.quiet!)).toEqual([0, 1])
    expect(Array.from(fd.pct.park!)).toEqual([0, 0]) // the only other one has no park: a single ranked value
  })

  it('offers "locals" only with the locals data', () => {
    expect(buildFunnelData(fixture(base), VIBE, 4).wishes).toContain('locals')
    const fd = buildFunnelData(fixture(base), null, 4)
    expect(fd.wishes).not.toContain('locals')
    expect(fd.values.locals).toBeUndefined()
  })
})

describe('displayValue', () => {
  it('turns a goodness back into the unit people read', () => {
    expect(displayValue('quiet', -52.3)).toBe(52)
    expect(displayValue('cheap', -4321)).toBe(4321)
    expect(displayValue('metro', -3)).toBe(3)
    expect(displayValue('new', 1987)).toBe(1987)
    expect(displayValue('locals', 7.46)).toBe(7.5)
  })
})

describe('formatValue', () => {
  it('writes years without a thousands separator', () => {
    expect(formatValue('new', 1950, 'en')).toBe('1950')
  })
  it('writes zero walking minutes as "<1"', () => {
    expect(formatValue('bars', -0, 'en')).toBe('<1')
    expect(formatValue('bars', -3, 'en')).toBe('3')
  })
  it('uses the separators of the language for other numbers', () => {
    expect(formatValue('cheap', -4321, 'en')).toBe('4,321')
    expect(formatValue('cheap', -4321, 'es')).toMatch(/^4.?321$/)
  })
})
