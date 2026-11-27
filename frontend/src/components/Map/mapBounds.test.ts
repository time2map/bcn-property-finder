import { describe, it, expect } from 'vitest'
import { LngLat } from 'maplibre-gl'
import { MAP_MIN_ZOOM, clampCenter, constrainToBounds, parseBounds, type Bounds } from './mapBounds'

const B: Bounds = [1.88, 41.25, 2.31, 41.59]

describe('clampCenter', () => {
  it('leaves a centre inside the zone as it is', () => {
    expect(clampCenter(2.17, 41.39, B)).toEqual([2.17, 41.39])
  })
  it('lets the edge of the zone be the centre', () => {
    expect(clampCenter(2.31, 41.25, B)).toEqual([2.31, 41.25])
  })
  it('pulls a centre that left the zone back to its edge', () => {
    expect(clampCenter(10, 50, B)).toEqual([2.31, 41.59])
    expect(clampCenter(-70, 0, B)).toEqual([1.88, 41.25])
  })
})

describe('constrainToBounds', () => {
  it('clamps the centre and keeps a zoom in range', () => {
    const r = constrainToBounds(new LngLat(5, 41.4), 12)
    expect(r.zoom).toBe(12)
    expect(r.center.lat).toBe(41.4)
    expect(r.center.lng).toBeLessThan(2.4)
  })
})

describe('constrainToBounds zoom', () => {
  it('does not zoom out past the minimum or in past 22', () => {
    expect(constrainToBounds(new LngLat(2.17, 41.39), -3).zoom).toBe(MAP_MIN_ZOOM)
    expect(constrainToBounds(new LngLat(2.17, 41.39), 30).zoom).toBe(22)
  })
})

describe('parseBounds', () => {
  it('reads west,south,east,north', () => {
    expect(parseBounds('1,40,3,42')).toEqual([1, 40, 3, 42])
  })
  it('falls back on a missing or broken value', () => {
    expect(parseBounds(undefined, B)).toEqual(B)
    expect(parseBounds('1,2,3', B)).toEqual(B)
    expect(parseBounds('3,40,1,42', B)).toEqual(B)
    expect(parseBounds('a,b,c,d', B)).toEqual(B)
  })
})
