import { describe, it, expect } from 'vitest'
import type { AreaFeature, AreaKind } from './areas'
import { normalizeName, searchAreas, areaIdsBounds } from './areaSearch'

function area(id: string, name: string, kind: AreaKind, box: [number, number, number, number]): AreaFeature {
  const [w, s, e, n] = box
  return {
    type: 'Feature',
    properties: { id, name, kind },
    geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  }
}

const areas: AreaFeature[] = [
  area('district-06', 'Gràcia', 'district', [2.14, 41.4, 2.17, 41.43]),
  area('barri-0631', 'la Vila de Gràcia', 'barri', [2.15, 41.4, 2.16, 41.41]),
  area('barri-0104', 'Sant Pere, Santa Caterina i la Ribera', 'barri', [2.17, 41.38, 2.19, 41.39]),
  area('barri-1068', 'el Poblenou', 'barri', [2.19, 41.4, 2.21, 41.41]),
  area('barri-1067', 'la Vila Olímpica del Poblenou', 'barri', [2.19, 41.39, 2.21, 41.4]),
  area('muni-lhospitalet-de-llobregat', "L'Hospitalet de Llobregat", 'municipality', [2.08, 41.34, 2.13, 41.37]),
  area('barri-0311', 'el Poble-sec', 'barri', [2.15, 41.37, 2.17, 41.38]),
]

describe('normalizeName', () => {
  it('lowercases, strips diacritics, punctuation and articles', () => {
    expect(normalizeName("l'Hospitalet de Llobregat")).toBe('hospitalet llobregat')
    expect(normalizeName('Sant Gervasi - la Bonanova')).toBe('sant gervasi bonanova')
    expect(normalizeName('Gràcia')).toBe('gracia')
  })
})

describe('searchAreas', () => {
  it('returns nothing for a blank query', () => {
    expect(searchAreas(areas, '   ')).toEqual([])
  })

  it('matches ignoring accents and articles', () => {
    const r = searchAreas(areas, 'gracia')
    expect(r.map((m) => m.areaIds[0])).toEqual(['district-06', 'barri-0631'])
  })

  it('ranks an exact match before a prefix match, and barri before district on ties', () => {
    const r = searchAreas(areas, 'poblenou')
    expect(r[0].areaIds).toEqual(['barri-1068'])
    expect(r.some((m) => m.areaIds[0] === 'barri-1067')).toBe(true)
  })

  it('matches every query word by prefix', () => {
    expect(searchAreas(areas, 'vila olim').map((m) => m.areaIds[0])).toEqual(['barri-1067'])
    expect(searchAreas(areas, 'hospi')[0].areaIds).toEqual(['muni-lhospitalet-de-llobregat'])
  })

  it('finds colloquial names and points them at several barris', () => {
    const r = searchAreas(areas, 'el born')
    expect(r[0].label).toBe('El Born')
    expect(r[0].areaIds).toEqual(['barri-0104'])
    const p = searchAreas(areas, 'poble nou')
    expect(p[0].areaIds).toEqual(['barri-1068', 'barri-1067'])
  })

  it('drops alias ids that are not in the dataset', () => {
    const r = searchAreas([areas[3]], 'poblenou')
    expect(r.every((m) => m.areaIds.every((id) => id === 'barri-1068'))).toBe(true)
  })

  it('respects the limit', () => {
    expect(searchAreas(areas, 's', 2)).toHaveLength(2)
  })
})

describe('areaIdsBounds', () => {
  it('merges the bounds of several areas', () => {
    expect(areaIdsBounds(areas, ['barri-1068', 'barri-1067'])).toEqual([2.19, 41.39, 2.21, 41.41])
  })

  it('returns null when no id is found', () => {
    expect(areaIdsBounds(areas, ['nope'])).toBeNull()
  })
})
