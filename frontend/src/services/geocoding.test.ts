import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geocodeAddress } from './geocoding'

function mockFetch(results: object[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(results),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('geocodeAddress', () => {
  it('returns null for null input', async () => {
    const result = await geocodeAddress(null)
    expect(result).toBeNull()
  })

  it('returns null for empty string', async () => {
    const result = await geocodeAddress('')
    expect(result).toBeNull()
  })

  it('returns null when Nominatim returns empty array', async () => {
    global.fetch = mockFetch([])
    const result = await geocodeAddress('Some Street, Barcelona')
    expect(result).toBeNull()
  })

  it('returns [lng, lat] on valid Nominatim result', async () => {
    global.fetch = mockFetch([{ lon: '2.1734', lat: '41.3851' }])
    const result = await geocodeAddress('Carrer d\'Aragó, Barcelona')
    expect(result).toEqual([2.1734, 41.3851])
  })

  it('returns null on network error (no throw)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    const result = await geocodeAddress('Carrer d\'Aragó, Barcelona')
    expect(result).toBeNull()
  })
})
