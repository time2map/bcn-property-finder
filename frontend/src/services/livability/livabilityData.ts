import type { FeatureCollection, Polygon } from 'geojson'
import { livabilityIndex } from './livabilityScore'

const GRID_URL = '/data/livability-h3.geojson'

/** Per-cell properties baked by scripts/prepare-livability-grid.py. */
export interface LivabilityCellProps {
  h3: string
  walk: number // walkability index 0–100
  lden: number | null // representative Lden (dB) or null when no noise data
  // Per-category walkability sub-scores 0–100 (present after pipeline v2+)
  walk_supermarket?: number
  walk_pharmacy?: number
  walk_park?: number
  walk_school?: number
  walk_kindergarten?: number
  walk_clinic?: number
  walk_metro?: number
  walk_cafe?: number
  walk_restaurant?: number
  walk_beach?: number
}

/** Same props plus the computed index for the current "consider noise" setting. */
export type ScoredCellProps = LivabilityCellProps & { index: number }

export type LivabilityGrid = FeatureCollection<Polygon, LivabilityCellProps>
export type ScoredGrid = FeatureCollection<Polygon, ScoredCellProps>

let cache: Promise<LivabilityGrid> | null = null

/** Loads the static H3 livability grid (module-cached, like loadAreas). */
export function loadLivabilityGrid(): Promise<LivabilityGrid> {
  if (!cache) {
    cache = fetch(GRID_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load livability grid: ${r.status}`)
        return r.json() as Promise<LivabilityGrid>
      })
      .catch((err) => {
        // Don't cache a failed load (e.g. an aborted request) — let a later call retry.
        cache = null
        throw err
      })
  }
  return cache
}

/** For tests: clears the module cache. */
export function resetLivabilityCache(): void {
  cache = null
}

/**
 * Returns a copy of the grid with each feature's `index` set for the given "consider noise"
 * setting. Pure — the layer recomputes this and calls `setData` whenever the toggle changes.
 */
export function withIndex(grid: LivabilityGrid, considerNoise: boolean): ScoredGrid {
  return {
    ...grid,
    features: grid.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        index: livabilityIndex(f.properties.walk, f.properties.lden, considerNoise),
      },
    })),
  }
}
