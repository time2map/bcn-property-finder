import { describe, it, expect } from 'vitest'
import {
  BUDGET_OPTIONS, BUDGET_RANGE, CENTRE_OPTIONS, DEFAULT_FLAT_AREA_M2, FLAT_AREA_OPTIONS, FLAT_AREA_RANGE, LOCALS_OPTIONS,
  NOISE_OPTIONS, WALK_OPTIONS,
  activeConditions, budgetFor, formatEuro, formatEuroM2, optionFor, parseNumberList, priceAfterAreaChange,
  priceForBudget, profileToPatch, riskLevel, shareUnder, sortedPrices, strengthsFor,
} from './conditionOptions'
import { CONDITION_RANGES, DEFAULT_CONDITIONS } from './buildings/conditions'
import { DEFAULT_COMPOSITE_WEIGHTS } from '../store'
import type { BuildingData } from './buildings/buildingData'

describe('parseNumberList', () => {
  it('reads a comma list', () => expect(parseNumberList('50, 58,65', [1])).toEqual([50, 58, 65]))
  it('falls back on missing, empty or broken input', () => {
    expect(parseNumberList(undefined, [1, 2])).toEqual([1, 2])
    expect(parseNumberList('', [1, 2])).toEqual([1, 2])
    expect(parseNumberList('5,x', [1, 2])).toEqual([1, 2])
  })
})

describe('option sets', () => {
  const sets = {
    noiseMaxDb: NOISE_OPTIONS, walkMaxMin: WALK_OPTIONS, cityCoreMaxMin: CENTRE_OPTIONS, localsMin: LOCALS_OPTIONS,
  } as const

  it.each(Object.entries(sets))('%s: values are unique, ascending and inside the slider range', (key, options) => {
    const values = options.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    const range = CONDITION_RANGES[key as keyof typeof CONDITION_RANGES]
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(range.min)
      expect(v).toBeLessThanOrEqual(range.max)
    }
  })

  it('names the noise steps in words', () => {
    expect(NOISE_OPTIONS.map((o) => o.label)).toEqual(['a courtyard', 'a calm street', 'normal city noise'])
    expect(NOISE_OPTIONS[1].hint).toBe('58 dB')
  })

  it('optionFor finds a step and returns null for a custom value', () => {
    expect(optionFor(NOISE_OPTIONS, 58)?.label).toBe('a calm street')
    expect(optionFor(NOISE_OPTIONS, 62)).toBeNull()
  })
})

describe('flat budget (area × average price per m²)', () => {
  it('the default flat is 70 m²', () => expect(DEFAULT_FLAT_AREA_M2).toBe(70))

  it('budget and flat-size steps are ascending, unique and inside their custom ranges', () => {
    for (const [options, range] of [[BUDGET_OPTIONS, BUDGET_RANGE], [FLAT_AREA_OPTIONS, FLAT_AREA_RANGE]] as const) {
      const values = options.map((o) => o.value)
      expect(new Set(values).size).toBe(values.length)
      expect([...values].sort((a, b) => a - b)).toEqual(values)
      for (const v of values) { expect(v).toBeGreaterThanOrEqual(range.min); expect(v).toBeLessThanOrEqual(range.max) }
    }
  })

  it('labels: €250,000 and 70 m²', () => {
    expect(BUDGET_OPTIONS.map((o) => o.label)).toContain('€250,000')
    expect(FLAT_AREA_OPTIONS.map((o) => o.label)).toContain('70 m²')
    expect(formatEuro(1250000)).toBe('€1,250,000')
  })

  it('a budget for a flat of a given size is a price per m²', () => {
    expect(priceForBudget(245000, 70)).toBe(3500)
    expect(priceForBudget(250000, 70)).toBe(3571.43)
  })

  it('and back: the budget shown is the price per m² times the size, to the nearest €1,000', () => {
    expect(budgetFor(3500, 70)).toBe(245000)
    expect(budgetFor(priceForBudget(250000, 70), 70)).toBe(250000)
    expect(budgetFor(4000, 70)).toBe(280000)
    expect(budgetFor(3555, 70)).toBe(249000) // 248,850
  })

  it('changing the size keeps the budget: a bigger flat for the same money is a lower price per m²', () => {
    const price = priceAfterAreaChange(3500, 70, 90)
    expect(price).toBeCloseTo(2722.22, 2)
    expect(budgetFor(price, 90)).toBe(245000)
  })

  it('stays put when the size does not change, and survives a round trip through other sizes', () => {
    expect(priceAfterAreaChange(3571.43, 70, 70)).toBe(3571.43)
    const there = priceAfterAreaChange(3571.43, 70, 120)
    const back = priceAfterAreaChange(there, 120, 70)
    expect(budgetFor(back, 70)).toBe(250000)
  })
})

describe('formatEuroM2', () => {
  it('groups thousands with a comma', () => expect(formatEuroM2(3500)).toBe('€3,500/m²'))
  it('handles millions of digits sanely', () => expect(formatEuroM2(12000)).toBe('€12,000/m²'))
})

describe('risk levels', () => {
  it('maps a level to strengths and back', () => {
    for (const level of ['avoid', 'strong', 'off'] as const) {
      expect(riskLevel(strengthsFor(level))).toBe(level)
    }
  })
  it('strong is stronger than avoid; off is zero', () => {
    expect(strengthsFor('strong').flood).toBeGreaterThan(strengthsFor('avoid').flood)
    expect(strengthsFor('off')).toEqual({ flood: 0, fire: 0, street: 0 })
  })
  it('anything else is custom', () => expect(riskLevel({ flood: 5, fire: 8, street: 0 })).toBe('custom'))
})

describe('activeConditions', () => {
  const off = strengthsFor('off')
  it('follows the stored order and appends the rest in the default order', () => {
    const weights = { ...DEFAULT_COMPOSITE_WEIGHTS, noise: 1, poiAccess: 1, cityCore: 1, openPrice: 1 }
    expect(activeConditions(weights, off, ['openPrice', 'noise'])).toEqual(['openPrice', 'noise', 'poiAccess', 'cityCore'])
  })
  it('drops conditions that are off and duplicates', () => {
    const weights = { ...DEFAULT_COMPOSITE_WEIGHTS, noise: 1, poiAccess: 0, cityCore: 0, openPrice: 0 }
    expect(activeConditions(weights, off, ['poiAccess', 'noise', 'noise'])).toEqual(['noise'])
  })
  it('lists risk when any strength is above zero', () => {
    const weights = { ...DEFAULT_COMPOSITE_WEIGHTS, noise: 0, poiAccess: 0, cityCore: 0, openPrice: 0 }
    expect(activeConditions(weights, strengthsFor('avoid'), [])).toEqual(['risk'])
  })
})

describe('profileToPatch', () => {
  it('turns on exactly the conditions of the profile and keeps their order', () => {
    const patch = profileToPatch({ id: 'x', name: 'X', blurb: '', order: ['openPrice', 'noise'] })
    expect(patch.order).toEqual(['openPrice', 'noise'])
    expect(patch.weights).toMatchObject({ openPrice: 1, noise: 1, poiAccess: 0, cityCore: 0, age: 0 })
    expect(patch.riskStrengths).toEqual(strengthsFor('off'))
  })
  it('merges limits over the defaults', () => {
    const patch = profileToPatch({ id: 'x', name: 'X', blurb: '', order: ['noise'], conditions: { noiseMaxDb: 58 } })
    expect(patch.conditions).toEqual({ ...DEFAULT_CONDITIONS, noiseMaxDb: 58 })
  })
  it('turns risks on when the profile lists them', () => {
    const patch = profileToPatch({ id: 'x', name: 'X', blurb: '', order: ['noise', 'risk'], risk: 'strong' })
    expect(patch.riskStrengths).toEqual(strengthsFor('strong'))
  })
  it('uses the default services and places and all eras unless the profile narrows them (TODO-073)', () => {
    const wide = profileToPatch({ id: 'x', name: 'X', blurb: '', order: ['poiAccess'] })
    const narrow = profileToPatch({ id: 'x', name: 'X', blurb: '', order: ['poiAccess'], walkCategories: ['park'] })
    expect(wide.walkCategories!.length).toBeGreaterThan(1)
    expect(narrow.walkCategories).toEqual(['park'])
    expect(wide.walkCategories).not.toContain('beach')
    expect(wide.landmarkIds).toEqual(['placa_cat', 'barri_gotic', 'pg_gracia'])
    expect(wide.eras!.length).toBe(5)
  })
})

describe('budget shares', () => {
  const data = {
    count: 6,
    meta: { areas: [{ price: 2000 }, { price: 3000 }, { price: 5000 }, { price: null }] },
    cols: { area: Float32Array.from([0, 0, 1, 2, 3, NaN]) },
  } as unknown as BuildingData

  it('sorts the prices of the buildings that have one', () => {
    expect(Array.from(sortedPrices(data).prices)).toEqual([2000, 2000, 3000, 5000])
  })
  it('counts homes, not buildings (TODO-073)', () => {
    const withHomes = { ...data, cols: { ...data.cols, dwellings: Float32Array.from([1, 1, 6, 0, 1, 1]) } } as unknown as BuildingData
    // homes by price: 2000 → 2, 3000 → 6, 5000 → 1 (0 dwellings counts as one home)
    expect(Array.from(sortedPrices(withHomes).cum)).toEqual([1, 2, 8, 9])
    expect(shareUnder(sortedPrices(withHomes), 2000)).toBe(22)
    expect(shareUnder(sortedPrices(withHomes), 3000)).toBe(89)
  })
  it('share under a limit is the fraction at or below it, in percent', () => {
    const prices = sortedPrices(data)
    expect(shareUnder(prices, 1000)).toBe(0)
    expect(shareUnder(prices, 2000)).toBe(50)
    expect(shareUnder(prices, 3000)).toBe(75)
    expect(shareUnder(prices, 9000)).toBe(100)
  })
  it('is monotonic and 0 for no data', () => {
    expect(shareUnder({ prices: new Float32Array(), cum: new Float64Array() }, 3000)).toBe(0)
    const prices = sortedPrices(data)
    const shares = [1500, 2500, 3500, 4500, 6000].map((v) => shareUnder(prices, v))
    expect([...shares].sort((a, b) => a - b)).toEqual(shares)
  })
})
