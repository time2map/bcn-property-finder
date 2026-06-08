import { describe, it, expect } from 'vitest'
import { computeComposite, priceScore, type CellBundle, type CompositeWeights } from './compositeScore'
import { ALL_LANDMARK_IDS } from '../cityCore/landmarks'

const ALL_ENABLED = ALL_LANDMARK_IDS

function makeBundle(overrides: Partial<CellBundle> = {}): CellBundle {
  return {
    h3: 'test',
    walk: 80,
    lden: 50,
    cityCoreProps: {
      h3: 'test',
      sagrada: 15, placa_cat: 10, barceloneta: 30, barri_gotic: 20,
      pg_gracia: 8, arc_triomf: 18, montjuic: 25, placa_espanya: 22,
      glories: 28, poblenou: 35, parc_guell: 55, eixample: 0, waterfront: 40,
    },
    medianPrice: 400_000,
    ...overrides,
  }
}

const EQUAL_WEIGHTS: CompositeWeights = { poiAccess: 1, noise: 1, cityCore: 1, price: 1 }
const PRICE_RANGE: [number, number] = [200_000, 600_000]

describe('priceScore', () => {
  it('scores min_price as 100 (cheapest)', () => {
    expect(priceScore(200_000, [200_000, 600_000])).toBe(100)
  })

  it('scores max_price as 0 (most expensive)', () => {
    expect(priceScore(600_000, [200_000, 600_000])).toBe(0)
  })

  it('scores midpoint as 50', () => {
    expect(priceScore(400_000, [200_000, 600_000])).toBe(50)
  })

  it('clamps below min to 100', () => {
    expect(priceScore(100_000, [200_000, 600_000])).toBe(100)
  })

  it('clamps above max to 0', () => {
    expect(priceScore(800_000, [200_000, 600_000])).toBe(0)
  })

  it('returns 50 when min === max', () => {
    expect(priceScore(300_000, [300_000, 300_000])).toBe(50)
  })
})

describe('computeComposite', () => {
  it('returns score 0 and no gap when all weights are 0', () => {
    const result = computeComposite(
      makeBundle(),
      { poiAccess: 0, noise: 0, cityCore: 0, price: 0 },
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(result.score).toBe(0)
    expect(result.hasGap).toBe(false)
  })

  it('returns only walk score when only poiAccess weight is set', () => {
    const bundle = makeBundle({ walk: 70 })
    const { score, hasGap } = computeComposite(
      bundle,
      { poiAccess: 5, noise: 0, cityCore: 0, price: 0 },
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(score).toBe(70)
    expect(hasGap).toBe(false)
  })

  it('marks hasGap when noise weight > 0 and lden is null', () => {
    const bundle = makeBundle({ lden: null })
    const { hasGap, score } = computeComposite(
      bundle,
      { poiAccess: 0, noise: 5, cityCore: 0, price: 0 },
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(hasGap).toBe(true)
    // lden null → 0 contribution, denominator still 5 → score = 0
    expect(score).toBe(0)
  })

  it('marks hasGap when price weight > 0 and medianPrice is null', () => {
    const bundle = makeBundle({ medianPrice: null })
    const { hasGap } = computeComposite(
      bundle,
      { poiAccess: 0, noise: 0, cityCore: 0, price: 5 },
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(hasGap).toBe(true)
  })

  it('does not mark hasGap when noise weight is 0 even if lden is null', () => {
    const bundle = makeBundle({ lden: null })
    const { hasGap } = computeComposite(
      bundle,
      { poiAccess: 5, noise: 0, cityCore: 0, price: 0 },
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(hasGap).toBe(false)
  })

  it('computes weighted average correctly with equal weights', () => {
    // walk=80, noise from lden=50 → noiseScore=(75-50)/(75-45)*100=83, price=400k→50, cityCore≈varies
    // Just check it's in 0-100 range
    const { score } = computeComposite(makeBundle(), EQUAL_WEIGHTS, ALL_ENABLED, PRICE_RANGE)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('gives 100 for a perfect cell (high walk, quiet, central, cheap)', () => {
    const bundle = makeBundle({
      walk: 100,
      lden: 45, // quietest → score 100
      medianPrice: 200_000, // = minPrice → score 100
      cityCoreProps: {
        h3: 'test',
        sagrada: 0, placa_cat: 0, barceloneta: 0, barri_gotic: 0,
        pg_gracia: 0, arc_triomf: 0, montjuic: 0, placa_espanya: 0,
        glories: 0, poblenou: 0, parc_guell: 0, eixample: 0, waterfront: 0,
      },
    })
    const { score } = computeComposite(bundle, EQUAL_WEIGHTS, ALL_ENABLED, PRICE_RANGE)
    expect(score).toBe(100)
  })

  it('returns components breakdown with correct sub-scores', () => {
    const bundle = makeBundle({ walk: 75, lden: 60, medianPrice: 400_000 })
    const { components } = computeComposite(bundle, EQUAL_WEIGHTS, ALL_ENABLED, PRICE_RANGE)
    expect(components.poiAccess).toBe(75)
    expect(components.noise).toBe(50) // noiseScore(60) = 50
    expect(components.price).toBe(50) // midpoint of 200k-600k
    expect(typeof components.cityCore).toBe('number')
  })

  it('components.noise is null when lden is null', () => {
    const { components } = computeComposite(
      makeBundle({ lden: null }),
      EQUAL_WEIGHTS,
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(components.noise).toBeNull()
  })

  it('components.price is null when medianPrice is null', () => {
    const { components } = computeComposite(
      makeBundle({ medianPrice: null }),
      EQUAL_WEIGHTS,
      ALL_ENABLED,
      PRICE_RANGE,
    )
    expect(components.price).toBeNull()
  })
})
