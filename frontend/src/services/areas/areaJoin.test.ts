import { describe, it, expect } from 'vitest'
import { joinAreas, pointInFeature } from './areaJoin'
import type { AreaFeature } from '../areas'
import type { BuildingArea } from '../buildings/buildingData'

const square = (id: string, kind: 'barri' | 'municipality', x: number, y: number, size = 1): AreaFeature => ({
  type: 'Feature',
  properties: { id, name: id, kind },
  geometry: { type: 'Polygon', coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] },
})

const AREAS: BuildingArea[] = [
  { code: '01', name: 'A', kind: 'barri', price: 1 },
  { code: '02', name: 'B', kind: 'barri', price: 1 },
  { code: '08101', name: 'M', kind: 'muni', price: 1 },
]

// Barri A in the unit square at (0,0); barri B at (2,0); a municipality at (4,0). A district covers all of them.
const FEATURES: AreaFeature[] = [
  { ...square('district-01', 'barri', 0, 0, 10), properties: { id: 'district-01', name: 'D', kind: 'district' } },
  square('barri-A', 'barri', 0, 0),
  square('barri-B', 'barri', 2, 0),
  square('muni-M', 'municipality', 4, 0),
]

describe('pointInFeature', () => {
  it('is true inside a polygon and false outside', () => {
    expect(pointInFeature(0.5, 0.5, FEATURES[1])).toBe(true)
    expect(pointInFeature(1.5, 0.5, FEATURES[1])).toBe(false)
  })
})

describe('joinAreas', () => {
  it('joins each area to the polygon its buildings stand in, by position and kind, not by name', () => {
    const areaCol = Float32Array.from([0, 0, 1, 1, 2, 2])
    const lng = Float32Array.from([0.2, 0.8, 2.2, 2.8, 4.5, 4.1])
    const lat = Float32Array.from([0.2, 0.8, 0.5, 0.5, 0.5, 0.9])
    const join = joinAreas(AREAS, areaCol, lng, lat, FEATURES)
    expect(join.get(0)?.properties.id).toBe('barri-A')
    expect(join.get(1)?.properties.id).toBe('barri-B')
    expect(join.get(2)?.properties.id).toBe('muni-M')
  })

  it('takes the polygon most buildings stand in when a few are misplaced', () => {
    const areaCol = Float32Array.from([0, 0, 0])
    const lng = Float32Array.from([0.2, 0.5, 2.5]) // one building lies in barri B
    const lat = Float32Array.from([0.2, 0.5, 0.5])
    expect(joinAreas(AREAS, areaCol, lng, lat, FEATURES).get(0)?.properties.id).toBe('barri-A')
  })

  it('leaves an area out when none of its buildings is in a polygon of its kind', () => {
    const areaCol = Float32Array.from([2])
    const lng = Float32Array.from([0.5]) // inside barri A, but area 2 is a municipality
    const lat = Float32Array.from([0.5])
    expect(joinAreas(AREAS, areaCol, lng, lat, FEATURES).has(2)).toBe(false)
  })

  it('gives a polygon to one area only: the one with more buildings when stray buildings of another area stand in it', () => {
    const areas: BuildingArea[] = [...AREAS, { code: '08019', name: 'Barcelona', kind: 'muni', price: 1 }]
    // area 2 (M) has three buildings in muni-M; area 3 (stray) has one there, at the border
    const areaCol = Float32Array.from([2, 2, 2, 3])
    const lng = Float32Array.from([4.2, 4.5, 4.8, 4.9])
    const lat = Float32Array.from([0.5, 0.5, 0.5, 0.5])
    const join = joinAreas(areas, areaCol, lng, lat, FEATURES)
    expect(join.get(2)?.properties.id).toBe('muni-M')
    expect(join.has(3)).toBe(false)
  })

  it('ignores buildings without an area and works with no polygons', () => {
    expect(joinAreas(AREAS, Float32Array.from([NaN]), Float32Array.from([0.5]), Float32Array.from([0.5]), FEATURES).size).toBe(0)
    expect(joinAreas(AREAS, Float32Array.from([0]), Float32Array.from([0.5]), Float32Array.from([0.5]), []).size).toBe(0)
  })

  it('samples a bounded number of buildings per area', () => {
    const n = 5000
    const areaCol = new Float32Array(n)
    const lng = new Float32Array(n).fill(0.5)
    const lat = new Float32Array(n).fill(0.5)
    expect(joinAreas(AREAS, areaCol, lng, lat, FEATURES, 10).get(0)?.properties.id).toBe('barri-A')
  })
})
