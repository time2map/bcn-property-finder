import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchOtpIsochrone, fetchOtpDuration, getNextMondayMadridISO } from './otp'

const MULTIPOLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [[[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]]],
}

describe('getNextMondayMadridISO', () => {
  it('returns a string matching ISO-8601 with offset', () => {
    const result = getNextMondayMadridISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00[+-]\d{2}:\d{2}$/)
  })

  it('returns a Monday', () => {
    const result = getNextMondayMadridISO()
    const dateStr = result.slice(0, 10)
    const date = new Date(`${dateStr}T12:00:00Z`)
    const weekday = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Madrid',
      weekday: 'short',
    }).format(date)
    expect(weekday).toBe('Mon')
  })

  it('returns a date strictly in the future', () => {
    const result = getNextMondayMadridISO()
    const dateStr = result.slice(0, 10)
    const future = new Date(`${dateStr}T09:00:00Z`)
    expect(future.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('fetchOtpIsochrone', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls the OTP isochrone endpoint with correct parameters', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: MULTIPOLYGON }] }),
    } as Response)

    await fetchOtpIsochrone([2.1687, 41.3874], 30)

    expect(fetch).toHaveBeenCalledTimes(1)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('/otp/traveltime/isochrone')
    expect(url).toContain('location=41.3874%2C2.1687')
    expect(url).toContain('cutoff=PT30M')
    expect(url).toContain('modes=WALK%2CTRANSIT')
    expect(url).toMatch(/time=\d{4}-\d{2}-\d{2}T09%3A00%3A00/)
  })

  it('uses VITE_OTP_URL env var as base', async () => {
    vi.stubEnv('VITE_OTP_URL', 'http://otp.example.com')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: MULTIPOLYGON }] }),
    } as Response)

    await fetchOtpIsochrone([2.17, 41.38], 60)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('http://otp.example.com')
  })

  it('returns the first feature geometry as MultiPolygon', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: MULTIPOLYGON }] }),
    } as Response)

    const result = await fetchOtpIsochrone([2.1687, 41.3874], 30)
    expect(result).toEqual(MULTIPOLYGON)
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)
    await expect(fetchOtpIsochrone([2.17, 41.38], 30)).rejects.toThrow('OTP 503')
  })
})

describe('fetchOtpDuration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls the OTP plan endpoint with WALK mode for foot', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { itineraries: [{ duration: 1800 }] } }),
    } as Response)

    await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'foot')

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('/otp/routers/default/plan')
    expect(url).toContain('fromPlace=41.38%2C2.17')
    expect(url).toContain('toPlace=41.4%2C2.19')
    expect(url).toContain('mode=WALK')
  })

  it('uses BICYCLE mode for cycling', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { itineraries: [{ duration: 600 }] } }),
    } as Response)

    await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'cycling')

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('mode=BICYCLE')
  })

  it('uses CAR mode for driving', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { itineraries: [{ duration: 300 }] } }),
    } as Response)

    await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'driving')

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('mode=CAR')
  })

  it('uses explicit transit submodes for transit and requests 3 itineraries', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: { itineraries: [{ duration: 2460 }, { duration: 1140 }, { duration: 1140 }] },
      }),
    } as Response)

    await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'transit')

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('SUBWAY')
    expect(url).toContain('BUS')
    expect(url).toContain('numItineraries=3')
  })

  it('returns the minimum duration across itineraries for transit', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: { itineraries: [{ duration: 2460 }, { duration: 1140 }, { duration: 1140 }] },
      }),
    } as Response)

    const result = await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'transit')
    expect(result).toBe(1140)
  })

  it('returns duration in seconds', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { itineraries: [{ duration: 1800 }] } }),
    } as Response)

    const result = await fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'foot')
    expect(result).toBe(1800)
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)
    await expect(fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'foot')).rejects.toThrow('OTP 503')
  })

  it('throws when no itineraries returned', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: { itineraries: [] } }),
    } as Response)
    await expect(fetchOtpDuration([2.17, 41.38], [2.19, 41.40], 'foot')).rejects.toThrow('no itineraries')
  })
})
