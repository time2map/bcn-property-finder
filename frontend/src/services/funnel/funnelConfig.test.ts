import { describe, it, expect } from 'vitest'
import { DEFAULT_FUNNEL_CONFIG, parseFunnelConfig } from './funnelConfig'

describe('parseFunnelConfig', () => {
  it('gives the defaults when nothing is set', () => {
    expect(parseFunnelConfig({})).toEqual(DEFAULT_FUNNEL_CONFIG)
    expect(DEFAULT_FUNNEL_CONFIG).toEqual({ steps: 5, target: 2, strictness: [3, 2.5, 2, 1.5, 1], minDwellings: 4 })
  })

  it('reads every value', () => {
    expect(parseFunnelConfig({ steps: '4', target: '3', strictness: '4, 3,2,1', minDwellings: '2' }))
      .toEqual({ steps: 4, target: 3, strictness: [4, 3, 2, 1], minDwellings: 2 })
  })

  it('pads a short strictness list with its last value and cuts a long one to the steps', () => {
    expect(parseFunnelConfig({ steps: '4', strictness: '3,2' }).strictness).toEqual([3, 2, 2, 2])
    expect(parseFunnelConfig({ steps: '2', strictness: '3,2,1' }).strictness).toEqual([3, 2])
  })

  it('falls back to the defaults on values that make no sense', () => {
    const c = parseFunnelConfig({ steps: '0', target: '-1', strictness: 'a,b', minDwellings: 'x' })
    expect(c.steps).toBe(5)
    expect(c.target).toBe(2)
    expect(c.strictness).toEqual([3, 2.5, 2, 1.5, 1])
    expect(c.minDwellings).toBe(4)
  })

  it('without a strictness list for other steps uses equal steps', () => {
    expect(parseFunnelConfig({ steps: '3' }).strictness).toEqual([1, 1, 1])
  })
})
