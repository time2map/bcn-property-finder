import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import {
  loadCityCoreGrid,
  resetCityCoreCache,
  withCityCoreIndex,
  type CityCoreCellProps,
  type CityCoreGrid,
} from './cityCoreData'

function makeProps(overrides: Partial<CityCoreCellProps> = {}): CityCoreCellProps {
  return {
    h3: 'abc',
    sagrada: 10, placa_cat: 5, barceloneta: 30, barri_gotic: 20, pg_gracia: 15,
    arc_triomf: 25, montjuic: 50, placa_espanya: 45, glories: 35, poblenou: 40,
    parc_guell: 60, eixample: 17, waterfront: 55,
    ...overrides,
  }
}

function cell(props: CityCoreCellProps): Feature<Polygon, CityCoreCellProps> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }
}

function grid(...cells: CityCoreCellProps[]): CityCoreGrid {
  return { type: 'FeatureCollection', features: cells.map(cell) }
}

afterEach(() => {
  resetCityCoreCache()
  vi.restoreAllMocks()
})

describe('withCityCoreIndex', () => {
  it('adds index based on enabled landmarks', () => {
    const g = grid(makeProps({ sagrada: 10, placa_cat: 5 }))
    const result = withCityCoreIndex(g, ['sagrada', 'placa_cat'])
    // both ≤15 min → score 100 each → avg 100
    expect(result.features[0].properties.index).toBe(100)
  })

  it('returns 0 index when no landmarks are enabled', () => {
    const g = grid(makeProps())
    expect(withCityCoreIndex(g, []).features[0].properties.index).toBe(0)
  })

  it('preserves original properties and geometry', () => {
    const g = grid(makeProps())
    const result = withCityCoreIndex(g, ['sagrada'])
    expect(result.features[0].properties.h3).toBe('abc')
    expect(result.features[0].properties.sagrada).toBe(10)
    expect(result.features[0].geometry.type).toBe('Polygon')
  })

  it('does not mutate the input grid', () => {
    const g = grid(makeProps())
    withCityCoreIndex(g, ['sagrada'])
    expect('index' in g.features[0].properties).toBe(false)
  })
})

describe('loadCityCoreGrid', () => {
  it('fetches and caches the grid (one fetch for repeated calls)', async () => {
    const g = grid(makeProps())
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(g) } as Response)

    const a = await loadCityCoreGrid()
    const b = await loadCityCoreGrid()

    expect(a).toEqual(g)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on a non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(loadCityCoreGrid()).rejects.toThrow(/404/)
  })

  it('does not cache a failed load — a later call retries and can succeed', async () => {
    const g = grid(makeProps())
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(g) } as Response)

    await expect(loadCityCoreGrid()).rejects.toThrow(/503/)
    const retry = await loadCityCoreGrid()

    expect(retry).toEqual(g)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
