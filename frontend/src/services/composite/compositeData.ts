import type { Polygon } from 'geojson'
import { loadLivabilityGrid } from '../livability/livabilityData'
import { loadCityCoreGrid, type CityCoreCellProps } from '../cityCore/cityCoreData'
import { loadIdealistaFeatures } from '../idealista/idealistaRawData'
import { aggregateToH3 } from '../../components/IdealistaPricesLayer/h3Index'
import type { OpenPriceBounds } from './compositeScore'

export interface CellBundle {
  h3: string
  geometry: Polygon
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
  saleEurM2: number | null
}

/** Populated after loadBundles() resolves — keyed by h3 index for O(1) card lookups. */
export const hexBundleMap = new Map<string, CellBundle>()
/** Populated after loadPriceMap() resolves — Idealista median price per h3. */
export const hexPriceMap = new Map<string, number>()
/** Populated after loadOpenPriceMeta() resolves — INCASOL normalisation bounds. */
export let hexOpenPriceBounds: OpenPriceBounds | null = null

const EMPTY_CITY_CORE: Omit<CityCoreCellProps, 'h3'> = {
  sagrada: null, placa_cat: null, barceloneta: null, barri_gotic: null,
  pg_gracia: null, arc_triomf: null, montjuic: null, placa_espanya: null,
  glories: null, poblenou: null, parc_guell: null, eixample: null, waterfront: null,
}

let bundleCache: Promise<CellBundle[]> | null = null

/** Loads and joins livability + city-core grids into per-cell bundles (module cache). */
export function loadBundles(): Promise<CellBundle[]> {
  if (bundleCache) return bundleCache
  bundleCache = Promise.all([loadLivabilityGrid(), loadCityCoreGrid()])
    .then(([livGrid, cityCoreGrid]) => {
      const cityCoreMap = new Map<string, CityCoreCellProps>()
      for (const f of cityCoreGrid.features) {
        cityCoreMap.set(f.properties.h3, f.properties)
      }
      const bundles = livGrid.features.map((f) => ({
        h3: f.properties.h3,
        geometry: f.geometry,
        walk: f.properties.walk,
        lden: f.properties.lden,
        saleEurM2: f.properties.sale_eur_m2 ?? null,
        cityCoreProps: cityCoreMap.get(f.properties.h3) ?? {
          h3: f.properties.h3,
          ...EMPTY_CITY_CORE,
        },
      }))
      hexBundleMap.clear()
      for (const b of bundles) hexBundleMap.set(b.h3, b)
      return bundles
    })
    .catch((err) => {
      bundleCache = null
      throw err
    })
  return bundleCache
}

let priceMapCache: Promise<Map<string, number>> | null = null

/**
 * Loads Idealista features and aggregates to H3 res-9 median price map.
 * All listings included (no price filter) — normalization happens in computeComposite.
 */
export function loadPriceMap(): Promise<Map<string, number>> {
  if (priceMapCache) return priceMapCache
  priceMapCache = loadIdealistaFeatures()
    .then((features) => {
      const cells = aggregateToH3(features, 1, Number.MAX_SAFE_INTEGER)
      const map = new Map<string, number>()
      for (const cell of cells) {
        map.set(cell.h3Index, cell.medianPrice)
        hexPriceMap.set(cell.h3Index, cell.medianPrice)
      }
      return map
    })
    .catch((err) => {
      priceMapCache = null
      throw err
    })
  return priceMapCache
}

let openPriceMetaCache: Promise<OpenPriceBounds> | null = null

/** Loads precomputed p5/p95 normalisation bounds for INCASOL open price data. */
export function loadOpenPriceMeta(): Promise<OpenPriceBounds> {
  if (openPriceMetaCache) return openPriceMetaCache
  openPriceMetaCache = fetch('/data/open-price-meta.json')
    .then((r) => r.json() as Promise<{ sale_p5: number; sale_p95: number }>)
    .then((d) => {
      const bounds = { p5: d.sale_p5, p95: d.sale_p95 }
      hexOpenPriceBounds = bounds
      return bounds
    })
    .catch((err) => {
      openPriceMetaCache = null
      throw err
    })
  return openPriceMetaCache
}

export function resetCompositeCaches(): void {
  bundleCache = null
  priceMapCache = null
  openPriceMetaCache = null
  hexBundleMap.clear()
  hexPriceMap.clear()
  hexOpenPriceBounds = null
}
