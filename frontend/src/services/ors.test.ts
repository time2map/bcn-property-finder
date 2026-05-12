import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchIsochrone, getOrsProfile } from './ors'
import type { TransportMode } from '../store'

describe('getOrsProfile', () => {
  it.each<[TransportMode, string]>([
    ['foot', 'foot-walking'],
    ['cycling', 'cycling-regular'],
    ['driving', 'driving-car'],
  ])('%s → %s', (mode, profile) => {
    expect(getOrsProfile(mode)).toBe(profile)
  })
})

describe('fetchIsochrone', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls correct ORS endpoint with foot-walking profile', async () => {
    const polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: polygon }] }),
    } as Response)

    const result = await fetchIsochrone([2.17, 41.38], 'foot', 30)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openrouteservice.org/v2/isochrones/foot-walking',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(polygon)
  })

  it('uses cycling-regular for cycling mode', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: 'Polygon', coordinates: [] } }] }),
    } as Response)

    await fetchIsochrone([2.17, 41.38], 'cycling', 30)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openrouteservice.org/v2/isochrones/cycling-regular',
      expect.anything(),
    )
  })

  it('uses driving-car for driving mode', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: 'Polygon', coordinates: [] } }] }),
    } as Response)

    await fetchIsochrone([2.17, 41.38], 'driving', 30)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openrouteservice.org/v2/isochrones/driving-car',
      expect.anything(),
    )
  })

  it('sends range in seconds and correct location', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: 'Polygon', coordinates: [] } }] }),
    } as Response)

    await fetchIsochrone([2.17, 41.38], 'foot', 30)
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.range).toEqual([1800])
    expect(body.locations).toEqual([[2.17, 41.38]])
  })

  it('sends correct range for 2-hour commute', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: 'Polygon', coordinates: [] } }] }),
    } as Response)

    await fetchIsochrone([2.17, 41.38], 'driving', 120)
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.range).toEqual([7200])
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429 } as Response)
    await expect(fetchIsochrone([2.17, 41.38], 'foot', 15)).rejects.toThrow('ORS 429')
  })

  it('returns the first feature geometry', async () => {
    const polygon = { type: 'Polygon', coordinates: [[[1, 2], [3, 4], [1, 2]]] }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: polygon }, { geometry: { type: 'Polygon', coordinates: [] } }],
      }),
    } as Response)

    const result = await fetchIsochrone([2.17, 41.38], 'foot', 15)
    expect(result).toEqual(polygon)
  })
})
