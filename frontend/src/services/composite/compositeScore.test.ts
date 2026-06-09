import { describe, it, expect } from 'vitest'
import { computeComposite, openPriceScore, type CellBundle, type CompositeWeights, type OpenPriceBounds } from './compositeScore'
import { ALL_LANDMARK_IDS } from '../cityCore/landmarks'

const ALL_ENABLED = ALL_LANDMARK_IDS

const DEFAULT_OPEN_PRICE_BOUNDS: OpenPriceBounds = { p5: 2000, p95: 6000 }

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
    saleEurM2: null,
    ...overrides,
  }
}

const EQUAL_WEIGHTS: CompositeWeights = { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 0 }

describe('openPriceScore', () => {
  it('scores p5 price as 100 (cheapest)', () => {
    expect(openPriceScore(2000, { p5: 2000, p95: 6000 })).toBe(100)
  })

  it('scores p95 price as 0 (most expensive)', () => {
    expect(openPriceScore(6000, { p5: 2000, p95: 6000 })).toBe(0)
  })

  it('scores midpoint as 50', () => {
    expect(openPriceScore(4000, { p5: 2000, p95: 6000 })).toBe(50)
  })

  it('clamps below p5 to 100', () => {
    expect(openPriceScore(1000, { p5: 2000, p95: 6000 })).toBe(100)
  })

  it('clamps above p95 to 0', () => {
    expect(openPriceScore(8000, { p5: 2000, p95: 6000 })).toBe(0)
  })

  it('returns 50 when p5 === p95', () => {
    expect(openPriceScore(3000, { p5: 3000, p95: 3000 })).toBe(50)
  })
})

describe('computeComposite', () => {
  it('returns score 0 and no gap when all weights are 0', () => {
    const result = computeComposite(
      makeBundle(),
      { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(result.score).toBe(0)
    expect(result.hasGap).toBe(false)
  })

  it('returns only walk score when only poiAccess weight is set', () => {
    const bundle = makeBundle({ walk: 70 })
    const { score, hasGap } = computeComposite(
      bundle,
      { poiAccess: 5, noise: 0, cityCore: 0, openPrice: 0 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(score).toBe(70)
    expect(hasGap).toBe(false)
  })

  it('marks hasGap when noise weight > 0 and lden is null', () => {
    const bundle = makeBundle({ lden: null })
    const { hasGap, score } = computeComposite(
      bundle,
      { poiAccess: 0, noise: 5, cityCore: 0, openPrice: 0 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(hasGap).toBe(true)
    expect(score).toBe(0)
  })

  it('marks hasGap when openPrice weight > 0 and saleEurM2 is null', () => {
    const bundle = makeBundle({ saleEurM2: null })
    const { hasGap } = computeComposite(
      bundle,
      { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 5 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(hasGap).toBe(true)
  })

  it('does not mark hasGap when noise weight is 0 even if lden is null', () => {
    const bundle = makeBundle({ lden: null })
    const { hasGap } = computeComposite(
      bundle,
      { poiAccess: 5, noise: 0, cityCore: 0, openPrice: 0 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(hasGap).toBe(false)
  })

  it('does not mark hasGap when openPrice weight is 0 even if saleEurM2 is null', () => {
    const bundle = makeBundle({ saleEurM2: null })
    const { hasGap } = computeComposite(
      bundle,
      { poiAccess: 5, noise: 0, cityCore: 0, openPrice: 0 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(hasGap).toBe(false)
  })

  it('computes weighted average in 0-100 range', () => {
    const { score } = computeComposite(makeBundle(), EQUAL_WEIGHTS, ALL_ENABLED, DEFAULT_OPEN_PRICE_BOUNDS)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('gives 100 for a perfect cell (high walk, quiet, central)', () => {
    const bundle = makeBundle({
      walk: 100,
      lden: 45,
      cityCoreProps: {
        h3: 'test',
        sagrada: 0, placa_cat: 0, barceloneta: 0, barri_gotic: 0,
        pg_gracia: 0, arc_triomf: 0, montjuic: 0, placa_espanya: 0,
        glories: 0, poblenou: 0, parc_guell: 0, eixample: 0, waterfront: 0,
      },
    })
    const { score } = computeComposite(bundle, EQUAL_WEIGHTS, ALL_ENABLED, DEFAULT_OPEN_PRICE_BOUNDS)
    expect(score).toBe(100)
  })

  it('returns components breakdown with correct sub-scores', () => {
    const bundle = makeBundle({ walk: 75, lden: 60 })
    const { components } = computeComposite(bundle, EQUAL_WEIGHTS, ALL_ENABLED, DEFAULT_OPEN_PRICE_BOUNDS)
    expect(components.poiAccess).toBe(75)
    expect(components.noise).toBe(50) // noiseScore(60) = 50
    expect(typeof components.cityCore).toBe('number')
  })

  it('components.noise is null when lden is null', () => {
    const { components } = computeComposite(
      makeBundle({ lden: null }),
      EQUAL_WEIGHTS,
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(components.noise).toBeNull()
  })

  it('components.openPrice is null when saleEurM2 is null', () => {
    const { components } = computeComposite(
      makeBundle({ saleEurM2: null }),
      { ...EQUAL_WEIGHTS, openPrice: 1 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(components.openPrice).toBeNull()
  })

  it('components.openPrice is computed when saleEurM2 is set', () => {
    const { components } = computeComposite(
      makeBundle({ saleEurM2: 4000 }), // midpoint of p5=2000, p95=6000 → score 50
      { ...EQUAL_WEIGHTS, openPrice: 1 },
      ALL_ENABLED,
      DEFAULT_OPEN_PRICE_BOUNDS,
    )
    expect(components.openPrice).toBe(50)
  })
})
