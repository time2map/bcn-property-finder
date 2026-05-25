import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geocodeAddress, buildQueries, toBarcelonaCatalan } from './geocoding'

function mockFetch(results: object[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(results),
  })
}

function mockFetchSequence(...responses: object[][]) {
  let call = 0
  return vi.fn().mockImplementation(() => {
    const results = responses[call] ?? []
    call++
    return Promise.resolve({ ok: true, json: () => Promise.resolve(results) })
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('toBarcelonaCatalan', () => {
  it('converts Calle del → Carrer del', () => {
    expect(toBarcelonaCatalan('Calle del Consell de Cent')).toBe('Carrer del Consell de Cent')
  })
  it('converts Calle de la → Carrer de la', () => {
    expect(toBarcelonaCatalan('Calle de la Marina')).toBe('Carrer de la Marina')
  })
  it('converts Calle → Carrer', () => {
    expect(toBarcelonaCatalan('Calle Valencia')).toBe('Carrer Valencia')
  })
  it('converts Avenida → Avinguda', () => {
    expect(toBarcelonaCatalan('Avenida Diagonal')).toBe('Avinguda Diagonal')
  })
  it('converts Plaza → Plaça', () => {
    expect(toBarcelonaCatalan('Plaza Catalunya')).toBe('Plaça Catalunya')
  })
  it('converts Paseo → Passeig', () => {
    expect(toBarcelonaCatalan('Paseo de Gracia')).toBe('Passeig de Gracia')
  })
  it('leaves Catalan names unchanged', () => {
    expect(toBarcelonaCatalan("Carrer d'Aragó")).toBe("Carrer d'Aragó")
  })
})

describe('buildQueries', () => {
  it('returns full address with Barcelona appended when absent', () => {
    const q = buildQueries('Calle del Consell de Cent, La Dreta de l\'Eixample')
    expect(q[0]).toBe("Calle del Consell de Cent, La Dreta de l'Eixample, Barcelona")
  })

  it('includes street-only fallback when address has multiple parts', () => {
    const q = buildQueries('Calle del Consell de Cent, Eixample')
    expect(q).toContain('Calle del Consell de Cent, Barcelona')
  })

  it('includes Catalan translation as additional fallback', () => {
    const q = buildQueries('Calle del Consell de Cent, Eixample')
    expect(q).toContain('Carrer del Consell de Cent, Barcelona')
  })

  it('does not duplicate Barcelona when already present', () => {
    const q = buildQueries('Carrer d\'Aragó, Barcelona')
    expect(q.every(s => (s.match(/barcelona/gi) ?? []).length === 1)).toBe(true)
  })

  it('deduplicates identical queries', () => {
    const q = buildQueries("Carrer d'Aragó, Barcelona")
    const unique = new Set(q)
    expect(unique.size).toBe(q.length)
  })
})

describe('geocodeAddress', () => {
  it('returns null for null input', async () => {
    expect(await geocodeAddress(null)).toBeNull()
  })

  it('returns null for empty string', async () => {
    expect(await geocodeAddress('')).toBeNull()
  })

  it('returns coords on first query success', async () => {
    global.fetch = mockFetch([{ lon: '2.1734', lat: '41.3851' }])
    const result = await geocodeAddress("Carrer d'Aragó, Barcelona")
    expect(result?.coords).toEqual([2.1734, 41.3851])
  })

  it('falls back to street-only query when full address returns nothing', async () => {
    global.fetch = mockFetchSequence(
      [],                                        // full address: no result
      [{ lon: '2.17', lat: '41.39' }],           // street only: success
    )
    const result = await geocodeAddress('Calle del Consell de Cent, La Dreta de l\'Eixample')
    expect(result?.coords).toEqual([2.17, 41.39])
  })

  it('falls back to Catalan translation when Spanish query fails', async () => {
    global.fetch = mockFetchSequence(
      [],                                        // full Spanish address: no result
      [],                                        // street-only Spanish: no result
      [{ lon: '2.18', lat: '41.38' }],           // Catalan translation: success
    )
    const result = await geocodeAddress('Calle del Consell de Cent, Eixample')
    expect(result?.coords).toEqual([2.18, 41.38])
  })

  it('returns null when all queries fail', async () => {
    global.fetch = mockFetch([])
    const result = await geocodeAddress('Calle del Consell de Cent, La Dreta de l\'Eixample')
    expect(result).toBeNull()
  })

  it('returns null on network error (no throw)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    expect(await geocodeAddress("Carrer d'Aragó, Barcelona")).toBeNull()
  })

  it('returns accuracyPolygon when addresstype is road and geojson is LineString', async () => {
    global.fetch = mockFetch([{
      lon: '2.17', lat: '41.38',
      addresstype: 'road',
      geojson: {
        type: 'LineString',
        coordinates: [[2.16, 41.37], [2.18, 41.39]],
      },
    }])
    const result = await geocodeAddress('Carrer del Consell de Cent, Barcelona')
    expect(result?.accuracyPolygon).toBeDefined()
    expect(result?.accuracyPolygon?.type).toBe('Polygon')
  })

  it('does not return accuracyPolygon for non-road addresstype', async () => {
    global.fetch = mockFetch([{
      lon: '2.17', lat: '41.38',
      addresstype: 'house',
      geojson: { type: 'Point', coordinates: [2.17, 41.38] },
    }])
    const result = await geocodeAddress('Carrer del Consell de Cent 42, Barcelona')
    expect(result?.accuracyPolygon).toBeUndefined()
  })
})
