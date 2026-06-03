import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Polygon } from 'geojson'
import {
  getAreaGeometry,
  listAreaOptions,
  loadAreas,
  resetAreasCache,
  type AreaFeature,
} from './areas'

const square = (): Polygon => ({
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
})

function area(id: string, name: string, kind: AreaFeature['properties']['kind'], parent?: string): AreaFeature {
  return { type: 'Feature', properties: { id, name, kind, parent }, geometry: square() }
}

const AREAS: AreaFeature[] = [
  area('d-gracia', 'Gràcia', 'district'),
  area('b-vila', 'Vila de Gràcia', 'barri', 'd-gracia'),
  area('b-camp', "Camp d'en Grassot", 'barri', 'd-gracia'),
  area('m-hospitalet', "L'Hospitalet de Llobregat", 'municipality'),
]

describe('getAreaGeometry', () => {
  it('returns the geometry for a known id', () => {
    expect(getAreaGeometry(AREAS, 'b-vila')).toEqual(square())
  })

  it('returns undefined for an unknown id', () => {
    expect(getAreaGeometry(AREAS, 'nope')).toBeUndefined()
  })
})

describe('listAreaOptions', () => {
  it('groups barris under their district, with the whole district first', () => {
    const groups = listAreaOptions(AREAS)
    const gracia = groups.find((g) => g.group === 'Gràcia')!
    expect(gracia.items[0]).toEqual({ value: 'd-gracia', label: 'Gràcia (whole district)' })
    expect(gracia.items.map((i) => i.value)).toEqual(['d-gracia', 'b-vila', 'b-camp'])
  })

  it('puts municipalities in their own group', () => {
    const groups = listAreaOptions(AREAS)
    const metro = groups.find((g) => g.group === 'Metro municipalities')!
    expect(metro.items).toEqual([{ value: 'm-hospitalet', label: "L'Hospitalet de Llobregat" }])
  })

  it('omits the municipalities group when there are none', () => {
    const groups = listAreaOptions([area('d-gracia', 'Gràcia', 'district')])
    expect(groups.some((g) => g.group === 'Metro municipalities')).toBe(false)
  })
})

describe('loadAreas', () => {
  beforeEach(() => resetAreasCache())

  it('fetches features from the dataset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ type: 'FeatureCollection', features: AREAS }),
      }),
    )
    const result = await loadAreas('/data/areas.geojson')
    expect(result).toHaveLength(4)
  })

  it('returns [] when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    expect(await loadAreas('/data/areas.geojson')).toEqual([])
  })
})
