import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadBundles, loadPriceMap, resetCompositeCaches } from './compositeData'

vi.mock('../livability/livabilityData', () => ({
  loadLivabilityGrid: vi.fn().mockResolvedValue({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        properties: { h3: 'aaa', walk: 75, lden: 55 },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 0]]] },
        properties: { h3: 'bbb', walk: 50, lden: null },
      },
    ],
  }),
}))

vi.mock('../cityCore/cityCoreData', () => ({
  loadCityCoreGrid: vi.fn().mockResolvedValue({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: {
          h3: 'aaa',
          sagrada: 10, placa_cat: 5, barceloneta: 20, barri_gotic: 15,
          pg_gracia: 8, arc_triomf: 12, montjuic: 18, placa_espanya: 22,
          glories: 25, poblenou: 30, parc_guell: 45, eixample: 0, waterfront: 35,
        },
      },
      // 'bbb' has no city core entry → should get empty props
    ],
  }),
}))

vi.mock('../idealista/idealistaRawData', () => ({
  loadIdealistaFeatures: vi.fn().mockResolvedValue([
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.17, 41.39] },
      properties: { price: 350_000 },
    },
  ]),
}))

// aggregateToH3 needs h3-js which isn't available in test env — stub it
vi.mock('../../components/IdealistaPricesLayer/h3Index', () => ({
  aggregateToH3: vi.fn().mockReturnValue([
    { h3Index: 'aaa', medianPrice: 350_000, count: 1 },
  ]),
}))

describe('loadBundles', () => {
  beforeEach(() => {
    resetCompositeCaches()
  })

  it('joins livability and city core by h3 key', async () => {
    const bundles = await loadBundles()
    expect(bundles).toHaveLength(2)
    const aaa = bundles.find((b) => b.h3 === 'aaa')!
    expect(aaa.walk).toBe(75)
    expect(aaa.lden).toBe(55)
    expect(aaa.cityCoreProps.sagrada).toBe(10)
  })

  it('uses empty city core props for cells without a city core entry', async () => {
    const bundles = await loadBundles()
    const bbb = bundles.find((b) => b.h3 === 'bbb')!
    expect(bbb.cityCoreProps.sagrada).toBeNull()
  })

  it('caches the result on second call', async () => {
    const a = await loadBundles()
    const b = await loadBundles()
    expect(a).toBe(b)
  })
})

describe('loadPriceMap', () => {
  beforeEach(() => {
    resetCompositeCaches()
  })

  it('returns a map from h3 index to median price', async () => {
    const map = await loadPriceMap()
    expect(map.get('aaa')).toBe(350_000)
    expect(map.get('bbb')).toBeUndefined()
  })

  it('caches the result on second call', async () => {
    const a = await loadPriceMap()
    const b = await loadPriceMap()
    expect(a).toBe(b)
  })
})
