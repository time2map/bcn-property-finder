import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadBundles, loadPriceMap, loadOpenPriceMeta, resetCompositeCaches } from './compositeData'

vi.mock('../livability/livabilityData', () => ({
  loadLivabilityGrid: vi.fn().mockResolvedValue({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        properties: {
          h3: 'aaa', walk: 75, lden: 55, sale_eur_m2: 3500,
          flood_t10: 0, flood_t100: 0.2, flood_t500: 0.6,
          fire_wui: 1, fire_hazard: 0.4, fire_class: 8, fire_dist_m: 120,
          street_t10: 0.02, street_t100: 0.07,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 0]]] },
        properties: { h3: 'bbb', walk: 50, lden: null, sale_eur_m2: null },
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

  it('carries climate-risk exposure into the bundle (036)', async () => {
    const bundles = await loadBundles()
    const aaa = bundles.find((b) => b.h3 === 'aaa')!
    expect(aaa.climate).toEqual({
      flood_t10: 0, flood_t100: 0.2, flood_t500: 0.6,
      fire_wui: 1, fire_hazard: 0.4, fire_class: 8, fire_dist_m: 120,
      street_t10: 0.02, street_t100: 0.07,
    })
    const bbb = bundles.find((b) => b.h3 === 'bbb')!
    expect(bbb.climate).toEqual({
      flood_t10: null, flood_t100: null, flood_t500: null,
      fire_wui: null, fire_hazard: null, fire_class: null, fire_dist_m: null,
      street_t10: null, street_t100: null,
    })
  })

  it('reads saleEurM2 from sale_eur_m2 property', async () => {
    const bundles = await loadBundles()
    const aaa = bundles.find((b) => b.h3 === 'aaa')!
    expect(aaa.saleEurM2).toBe(3500)
  })

  it('sets saleEurM2 to null when sale_eur_m2 is missing', async () => {
    const bundles = await loadBundles()
    const bbb = bundles.find((b) => b.h3 === 'bbb')!
    expect(bbb.saleEurM2).toBeNull()
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

describe('loadOpenPriceMeta', () => {
  beforeEach(() => {
    resetCompositeCaches()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ sale_p5: 2088, sale_p95: 5816 }),
    }))
  })

  it('fetches and maps p5/p95 from open-price-meta.json', async () => {
    const meta = await loadOpenPriceMeta()
    expect(meta.p5).toBe(2088)
    expect(meta.p95).toBe(5816)
  })

  it('caches the result on second call', async () => {
    const a = await loadOpenPriceMeta()
    const b = await loadOpenPriceMeta()
    expect(a).toBe(b)
  })
})
