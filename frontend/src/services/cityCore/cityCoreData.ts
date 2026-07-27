import type { FeatureCollection, Polygon } from 'geojson'
import { cellCityCoreIndex } from './cityCoreScore'

const GRID_URL = `${import.meta.env.BASE_URL}data/city-core-access.geojson`

/** Per-cell properties baked by scripts/prepare-city-core-access.py. */
export interface CityCoreCellProps {
  h3: string
  sagrada: number | null
  placa_cat: number | null
  barceloneta: number | null
  barri_gotic: number | null
  pg_gracia: number | null
  arc_triomf: number | null
  montjuic: number | null
  placa_espanya: number | null
  glories: number | null
  poblenou: number | null
  parc_guell: number | null
  eixample: number | null
  waterfront: number | null
}

/** Same props plus the computed index for the current enabled landmark set. */
export type ScoredCityCoreCellProps = CityCoreCellProps & { index: number }

export type CityCoreGrid = FeatureCollection<Polygon, CityCoreCellProps>
export type ScoredCityCoreGrid = FeatureCollection<Polygon, ScoredCityCoreCellProps>

let cache: Promise<CityCoreGrid> | null = null

export function loadCityCoreGrid(): Promise<CityCoreGrid> {
  if (!cache) {
    cache = fetch(GRID_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load city core grid: ${r.status}`)
        return r.json() as Promise<CityCoreGrid>
      })
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

export function resetCityCoreCache(): void {
  cache = null
}

/**
 * Returns a copy of the grid with each feature's `index` set for the given enabled landmark set.
 * Pure — the layer calls this and setData whenever the enabled set changes.
 */
export function withCityCoreIndex(
  grid: CityCoreGrid,
  enabledIds: readonly string[],
): ScoredCityCoreGrid {
  return {
    ...grid,
    features: grid.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        index: cellCityCoreIndex(f.properties, enabledIds),
      },
    })),
  }
}
