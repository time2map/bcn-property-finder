import type { Polygon } from 'geojson'
import { loadLivabilityGrid } from '../livability/livabilityData'
import { loadCityCoreGrid, type CityCoreCellProps } from '../cityCore/cityCoreData'
import { loadIdealistaFeatures } from '../idealista/idealistaRawData'
import { aggregateToH3 } from '../../components/IdealistaPricesLayer/h3Index'

export interface CellBundle {
  h3: string
  geometry: Polygon
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
}

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
      return livGrid.features.map((f) => ({
        h3: f.properties.h3,
        geometry: f.geometry,
        walk: f.properties.walk,
        lden: f.properties.lden,
        cityCoreProps: cityCoreMap.get(f.properties.h3) ?? {
          h3: f.properties.h3,
          ...EMPTY_CITY_CORE,
        },
      }))
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
      }
      return map
    })
    .catch((err) => {
      priceMapCache = null
      throw err
    })
  return priceMapCache
}

export function resetCompositeCaches(): void {
  bundleCache = null
  priceMapCache = null
}
