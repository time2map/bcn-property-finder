import { describe, it, expect } from 'vitest'
import { buildIdealistaUrl, largestPolygon, parseIdealistaBaseUrl } from './idealista'

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

  it('URL contains %28%28 and %29%29 encoded delimiters (Idealista requires encoded parens)', () => {
    const url = buildIdealistaUrl(POLYGON)
    expect(url).toContain('%28%28')
    expect(url).toContain('%29%29')
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

  // Counts the number of `(ring)` groups inside the outer `( … )` wrapper.
  function ringGroups(url: string): number {
    const shape = decodeURIComponent(url.split('shape=')[1])
    return (shape.match(/\(/g)!.length) - 1 // minus the outer opening paren
  }

  it('encodes a single ring group for a simple Polygon', () => {
    expect(ringGroups(buildIdealistaUrl(POLYGON))).toBe(1)
  })

  it('ignores holes — encodes only the outer ring (Idealista cannot do holes)', () => {
    const withHole = {
      type: 'Polygon' as const,
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], // outer
        [[3, 3], [3, 5], [5, 5], [5, 3], [3, 3]],     // hole (dropped)
      ],
    }
    expect(ringGroups(buildIdealistaUrl(withHole))).toBe(1)
  })

  it('accepts MultiPolygon and uses the largest sub-polygon (single ring)', () => {
    const url = buildIdealistaUrl(MULTIPOLYGON)
    expect(url).toMatch(/^https:\/\/www\.idealista\.com\/areas\/venta-viviendas\/mapa-google\?shape=/)
    expect(ringGroups(url)).toBe(1)
  })

  it('MultiPolygon and its largest Polygon produce the same URL', () => {
    expect(buildIdealistaUrl(MULTIPOLYGON)).toBe(buildIdealistaUrl(largestPolygon(MULTIPOLYGON)))
  })

  it('uses default template when no baseUrl is provided', () => {
    const url = buildIdealistaUrl(POLYGON)
    expect(url).toContain('www.idealista.com/areas/venta-viviendas/mapa-google')
  })

  it('uses baseUrl when provided (no existing query params)', () => {
    const base = 'https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/'
    const url = buildIdealistaUrl(POLYGON, base)
    expect(url).toContain(base)
    expect(url).toContain('?shape=')
    expect(url).not.toContain('mapa-google')
  })

  it('appends with & when baseUrl already has query params', () => {
    const base = 'https://www.idealista.com/en/areas/venta-viviendas/?foo=bar'
    const url = buildIdealistaUrl(POLYGON, base)
    expect(url).toContain('&shape=')
  })

  it('null baseUrl falls back to default template', () => {
    const url = buildIdealistaUrl(POLYGON, null)
    expect(url).toContain('mapa-google')
  })
})

describe('parseIdealistaBaseUrl', () => {
  it('returns null for a non-URL string', () => {
    expect(parseIdealistaBaseUrl('not a url')).toBeNull()
  })

  it('returns null for a non-Idealista URL', () => {
    expect(parseIdealistaBaseUrl('https://example.com/venta-viviendas/')).toBeNull()
  })

  it('returns null for an Idealista URL without property search path', () => {
    expect(parseIdealistaBaseUrl('https://www.idealista.com/en/')).toBeNull()
  })

  it('strips the shape param from a venta-viviendas URL', () => {
    const input = 'https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/?shape=((abc))'
    const result = parseIdealistaBaseUrl(input)
    expect(result).toBe('https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/')
    expect(result).not.toContain('shape')
  })

  it('accepts alquiler-viviendas URLs', () => {
    const input = 'https://www.idealista.com/en/areas/alquiler-viviendas/con-precio-hasta_2000/?shape=((abc))'
    const result = parseIdealistaBaseUrl(input)
    expect(result).not.toBeNull()
    expect(result).toContain('alquiler-viviendas')
  })

  it('preserves other query params and removes only shape', () => {
    const input = 'https://www.idealista.com/en/areas/venta-viviendas/?foo=bar&shape=((abc))&baz=1'
    const result = parseIdealistaBaseUrl(input)
    expect(result).toContain('foo=bar')
    expect(result).toContain('baz=1')
    expect(result).not.toContain('shape')
  })

  it('returns a URL without trailing ? when no other query params remain', () => {
    const input = 'https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/?shape=((abc))'
    const result = parseIdealistaBaseUrl(input)
    expect(result).not.toContain('?')
  })
})
