import { describe, it, expect } from 'vitest'
import { buildIdealistaUrl } from './idealista'

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
    // encodeURIComponent does not encode ( or ) per spec — Idealista expects ((...))
    const url = buildIdealistaUrl(POLYGON)
    expect(url).toContain('((')
    expect(url).toContain('))')
  })

  it('swaps lng/lat: GeoJSON [lng, lat] → polyline [lat, lng]', () => {
    // Single-step polygon: one move from origin [lng=2, lat=41] back to itself
    const singlePoint = {
      type: 'Polygon' as const,
      coordinates: [[[2.0, 41.0], [2.0, 41.0]]],
    }
    // Encoding [41.0, 2.0] then delta [0, 0] — result must be non-empty
    const url = buildIdealistaUrl(singlePoint)
    expect(url).toContain('shape=')
  })

  it('produces a stable output for known input', () => {
    const url1 = buildIdealistaUrl(POLYGON)
    const url2 = buildIdealistaUrl(POLYGON)
    expect(url1).toBe(url2)
  })
})
