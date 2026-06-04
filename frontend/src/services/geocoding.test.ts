import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geocodeAddress, buildQueries } from './geocoding'

function geoapifyResult(lon: number, lat: number, result_type = 'building', street?: string) {
  return {
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { result_type, street: street ?? null },
    }],
  }
}

function mockFetch(body: object) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
}

function mockFetchSequence(...bodies: object[]) {
  let call = 0
  return vi.fn().mockImplementation(() => {
    const body = bodies[call] ?? { features: [] }
    call++
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('buildQueries', () => {
  it('returns the address as first query', () => {
    const q = buildQueries('Riera de la Creu 54, Centre, Hospitalet de Llobregat')
    expect(q[0]).toBe('Riera de la Creu 54, Centre, Hospitalet de Llobregat')
  })

  it('includes street-only fallback when address has multiple parts', () => {
    const q = buildQueries('Carrer de Llull, Poblenou, Barcelona')
    expect(q).toContain('Carrer de Llull')
  })

  it('deduplicates identical queries', () => {
    const q = buildQueries("Carrer d'Aragó")
    expect(new Set(q).size).toBe(q.length)
  })
})

describe('geocodeAddress', () => {
  it('returns null for null input', async () => {
    expect(await geocodeAddress(null)).toBeNull()
  })

  it('returns null for empty string', async () => {
    expect(await geocodeAddress('')).toBeNull()
  })

  it('returns coords from Geoapify response', async () => {
    global.fetch = mockFetch(geoapifyResult(2.1734, 41.3851))
    const result = await geocodeAddress("Carrer d'Aragó, Barcelona")
    expect(result?.coords).toEqual([2.1734, 41.3851])
  })

  it('returns coords for Hospitalet address without appending Barcelona', async () => {
    global.fetch = mockFetch(geoapifyResult(2.105, 41.361))
    const result = await geocodeAddress('Riera de la Creu 54, Centre, Hospitalet de Llobregat')
    expect(result?.coords).toEqual([2.105, 41.361])
  })

  it('falls back to street-only query when full address returns nothing', async () => {
    global.fetch = mockFetchSequence(
      { features: [] },
      geoapifyResult(2.17, 41.39),
    )
    const result = await geocodeAddress('Carrer del Consell de Cent, La Dreta de l\'Eixample')
    expect(result?.coords).toEqual([2.17, 41.39])
  })

  it('returns null when all queries fail', async () => {
    global.fetch = mockFetch({ features: [] })
    const result = await geocodeAddress('Carrer del Consell de Cent, La Dreta de l\'Eixample')
    expect(result).toBeNull()
  })

  it('returns null on network error (no throw)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    expect(await geocodeAddress("Carrer d'Aragó, Barcelona")).toBeNull()
  })

  it('fetches full street from Overpass and returns accuracyPolygon when result_type is street', async () => {
    let call = 0
    global.fetch = vi.fn().mockImplementation(() => {
      call++
      if (call === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(
          geoapifyResult(2.17, 41.38, 'street', 'Carrer del Consell de Cent'),
        ) })
      }
      // Overpass
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ elements: [
        { type: 'way', geometry: [{ lat: 41.37, lon: 2.15 }, { lat: 41.38, lon: 2.17 }] },
        { type: 'way', geometry: [{ lat: 41.38, lon: 2.17 }, { lat: 41.39, lon: 2.19 }] },
      ] }) })
    })
    const result = await geocodeAddress('Carrer del Consell de Cent, Barcelona')
    expect(result?.accuracyPolygon).toBeDefined()
    expect(result?.accuracyPolygon?.type).toBe('Polygon')
  })

  it('does not return accuracyPolygon for non-street result_type', async () => {
    global.fetch = mockFetch(geoapifyResult(2.17, 41.38, 'building'))
    const result = await geocodeAddress('Carrer del Consell de Cent 42, Barcelona')
    expect(result?.accuracyPolygon).toBeUndefined()
  })

  it('returns coords without accuracyPolygon when Overpass fails', async () => {
    let call = 0
    global.fetch = vi.fn().mockImplementation(() => {
      call++
      if (call === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(
          geoapifyResult(2.17, 41.38, 'street', 'Carrer del Consell de Cent'),
        ) })
      }
      return Promise.resolve({ ok: false })
    })
    const result = await geocodeAddress('Carrer del Consell de Cent, Barcelona')
    expect(result?.coords).toEqual([2.17, 41.38])
    expect(result?.accuracyPolygon).toBeUndefined()
  })
})
