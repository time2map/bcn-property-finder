import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchOtpIsochrone, getNextMondayMadridISO } from './otp'
import type { TransportMode } from '../store'

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
    const dateStr = result.slice(0, 10) // "YYYY-MM-DD"
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: MULTIPOLYGON }] }),
    } as Response)
  })

  it('calls the OTP isochrone endpoint with location, cutoff and time', async () => {
    await fetchOtpIsochrone([2.1687, 41.3874], 'public_transport', 30)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('/otp/traveltime/isochrone')
    expect(url).toContain('location=41.3874%2C2.1687')
    expect(url).toContain('cutoff=PT30M')
    expect(url).toMatch(/time=\d{4}-\d{2}-\d{2}T09%3A00%3A00/)
  })

  it.each<[TransportMode, string]>([
    ['public_transport', 'WALK%2CTRANSIT'],
    ['foot', 'WALK'],
    ['cycling', 'BIKE'],
    ['driving', 'CAR'],
  ])('maps mode %s → modes=%s in URL', async (mode, expectedModes) => {
    await fetchOtpIsochrone([2.17, 41.38], mode, 30)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain(`modes=${expectedModes}`)
  })

  it('uses VITE_OTP_URL env var as base', async () => {
    vi.stubEnv('VITE_OTP_URL', 'http://otp.example.com')
    await fetchOtpIsochrone([2.17, 41.38], 'foot', 60)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('http://otp.example.com')
  })

  it('returns the first feature geometry as MultiPolygon', async () => {
    const result = await fetchOtpIsochrone([2.1687, 41.3874], 'public_transport', 30)
    expect(result).toEqual(MULTIPOLYGON)
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)
    await expect(fetchOtpIsochrone([2.17, 41.38], 'foot', 30)).rejects.toThrow('OTP 503')
  })
})
