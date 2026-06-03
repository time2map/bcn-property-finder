import { describe, it, expect } from 'vitest'
import type { Polygon } from 'geojson'
import { subtractExclusions, isPointInExclusions } from './exclusions'
import type { ExclusionZone } from '../types/exclusions'

const BASE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
}

function zone(id: string, coords: number[][]): ExclusionZone {
  return {
    id,
    name: id,
    source: 'drawn',
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

const INTERIOR = zone('interior', [
  [3, 3],
  [5, 3],
  [5, 5],
  [3, 5],
  [3, 3],
])

describe('subtractExclusions', () => {
  it('returns the base unchanged when there are no zones', () => {
    expect(subtractExclusions(BASE, [])).toEqual(BASE)
  })

  it('returns null when base is null', () => {
    expect(subtractExclusions(null, [INTERIOR])).toBeNull()
  })

  it('cuts an interior hole (outer ring + inner ring)', () => {
    const result = subtractExclusions(BASE, [INTERIOR])
    expect(result).not.toBeNull()
    expect(result!.type).toBe('Polygon')
    // one outer ring + one hole
    expect((result as Polygon).coordinates).toHaveLength(2)
  })

  it('unions overlapping zones before subtracting', () => {
    const a = zone('a', [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
      [2, 2],
    ])
    const b = zone('b', [
      [3, 3],
      [5, 3],
      [5, 5],
      [3, 5],
      [3, 3],
    ])
    const result = subtractExclusions(BASE, [a, b])
    expect(result).not.toBeNull()
    // overlapping zones merge into a single hole
    expect((result as Polygon).coordinates).toHaveLength(2)
  })

  it('shrinks the outer ring when a zone clips the boundary', () => {
    const clip = zone('clip', [
      [-1, -1],
      [5, -1],
      [5, 5],
      [-1, 5],
      [-1, -1],
    ])
    const result = subtractExclusions(BASE, [clip])
    expect(result).not.toBeNull()
    // boundary clip → still a single ring, no hole
    expect((result as Polygon).coordinates).toHaveLength(1)
  })

  it('returns null when a zone fully covers the base', () => {
    const cover = zone('cover', [
      [-1, -1],
      [11, -1],
      [11, 11],
      [-1, 11],
      [-1, -1],
    ])
    expect(subtractExclusions(BASE, [cover])).toBeNull()
  })
})

describe('isPointInExclusions', () => {
  it('is true for a point inside a zone', () => {
    expect(isPointInExclusions([4, 4], [INTERIOR])).toBe(true)
  })

  it('is false for a point outside every zone', () => {
    expect(isPointInExclusions([1, 1], [INTERIOR])).toBe(false)
  })

  it('is false when there are no zones', () => {
    expect(isPointInExclusions([4, 4], [])).toBe(false)
  })
})
