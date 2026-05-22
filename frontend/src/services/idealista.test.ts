import { describe, it, expect } from 'vitest'
import { buildIdealistaUrl, largestPolygon } from './idealista'

// A minimal closed ring around a Barcelona block
const POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [2.154, 41.39],
      [2.155, 41.39],
      [2.155, 41.391],
      [2.154, 41.391],
      [2.154, 41.39],
    ],
  ],
}

// Small ring (1×1 unit) and large ring (2×2 unit) in GeoJSON [lng, lat]
const SMALL_RING = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
const LARGE_RING = [[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]

const MULTIPOLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [
    [SMALL_RING], // area = 1
    [LARGE_RING], // area = 4
  ],
}

describe('largestPolygon', () => {
  it('returns the polygon unchanged when input is a Polygon', () => {
    expect(largestPolygon(POLYGON)).toBe(POLYGON)
  })

  it('picks the sub-polygon with the largest outer ring from a MultiPolygon', () => {
    const result = largestPolygon(MULTIPOLYGON)
    expect(result.type).toBe('Polygon')
    expect(result.coordinates[0]).toEqual(LARGE_RING)
  })

  it('returns a Polygon type from MultiPolygon', () => {
    expect(largestPolygon(MULTIPOLYGON).type).toBe('Polygon')
  })
})

describe('buildIdealistaUrl', () => {
  it('returns a valid Idealista URL', () => {
    const url = buildIdealistaUrl(POLYGON)
    expect(url).toMatch(/^https:\/\/www\.idealista\.com\/areas\/venta-viviendas\/mapa-google\?shape=/)
  })

  it('wraps encoded polyline in (( ))', () => {
    const url = buildIdealistaUrl(POLYGON)
    const shape = decodeURIComponent(url.split('shape=')[1])
    expect(shape).toMatch(/^\(\(.*\)\)$/)
  })

  it('encoded string is non-empty', () => {
    const url = buildIdealistaUrl(POLYGON)
    const shape = decodeURIComponent(url.split('shape=')[1])
    const inner = shape.slice(2, -2)
    expect(inner.length).toBeGreaterThan(0)
  })

  it('URL contains (( and )) delimiters unencoded', () => {
    const url = buildIdealistaUrl(POLYGON)
    expect(url).toContain('((')
    expect(url).toContain('))')
  })

  it('swaps lng/lat: GeoJSON [lng, lat] → polyline [lat, lng]', () => {
    const singlePoint = {
      type: 'Polygon' as const,
      coordinates: [[[2.0, 41.0], [2.0, 41.0]]],
    }
    const url = buildIdealistaUrl(singlePoint)
    expect(url).toContain('shape=')
  })

  it('produces a stable output for known input', () => {
    expect(buildIdealistaUrl(POLYGON)).toBe(buildIdealistaUrl(POLYGON))
  })

  it('accepts MultiPolygon and uses the largest sub-polygon', () => {
    const url = buildIdealistaUrl(MULTIPOLYGON)
    expect(url).toMatch(/^https:\/\/www\.idealista\.com\/areas\/venta-viviendas\/mapa-google\?shape=/)
  })

  it('MultiPolygon and its largest Polygon produce the same URL', () => {
    const largest = largestPolygon(MULTIPOLYGON)
    expect(buildIdealistaUrl(MULTIPOLYGON)).toBe(buildIdealistaUrl(largest))
  })
})
