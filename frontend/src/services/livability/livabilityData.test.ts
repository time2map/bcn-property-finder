import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import {
  loadLivabilityGrid,
  resetLivabilityCache,
  withIndex,
  type LivabilityCellProps,
  type LivabilityGrid,
} from './livabilityData'

function cell(props: LivabilityCellProps): Feature<Polygon, LivabilityCellProps> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }
}

function grid(...cells: LivabilityCellProps[]): LivabilityGrid {
  return { type: 'FeatureCollection', features: cells.map(cell) }
}

afterEach(() => {
  resetLivabilityCache()
  vi.restoreAllMocks()
})

describe('withIndex', () => {
  it('adds walkability-only index when considerNoise is off', () => {
    const result = withIndex(grid({ h3: 'a', walk: 80, lden: 45 }), false)
    expect(result.features[0].properties.index).toBe(80)
  })

  it('adds composite index when considerNoise is on', () => {
    const result = withIndex(grid({ h3: 'a', walk: 80, lden: 45 }), true)
    expect(result.features[0].properties.index).toBe(88)
  })

  it('preserves original properties and geometry', () => {
    const result = withIndex(grid({ h3: 'a', walk: 80, lden: 45 }), false)
    expect(result.features[0].properties.h3).toBe('a')
    expect(result.features[0].properties.walk).toBe(80)
    expect(result.features[0].geometry.type).toBe('Polygon')
  })

  it('does not mutate the input grid', () => {
    const input = grid({ h3: 'a', walk: 80, lden: 45 })
    withIndex(input, true)
    expect('index' in input.features[0].properties).toBe(false)
  })
})

describe('loadLivabilityGrid', () => {
  it('fetches and caches the grid (one fetch for repeated calls)', async () => {
    const fc = grid({ h3: 'a', walk: 50, lden: 60 })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(fc) } as Response)

    const a = await loadLivabilityGrid()
    const b = await loadLivabilityGrid()

    expect(a).toEqual(fc)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on a non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(loadLivabilityGrid()).rejects.toThrow(/404/)
  })

  it('does not cache a failed load — a later call retries and can succeed', async () => {
    const fc = grid({ h3: 'a', walk: 50, lden: 60 })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fc) } as Response)

    await expect(loadLivabilityGrid()).rejects.toThrow(/503/)
    const retry = await loadLivabilityGrid()

    expect(retry).toEqual(fc)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
