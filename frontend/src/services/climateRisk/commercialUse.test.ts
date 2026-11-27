import { afterEach, describe, expect, it, vi } from 'vitest'

// VITE_COMMERCIAL_USE=true (TODO-066): the RESCCUE street-flooding data has no licence, so it must cost no points.
describe('commercial use switch', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('keeps the street-flooding penalty in the personal build', async () => {
    vi.stubEnv('VITE_COMMERCIAL_USE', 'false')
    vi.resetModules()
    const m = await import('./climateRisk')
    expect(m.streetFloodRisk({ street_t10: 1 })).toBeGreaterThan(0)
    expect(m.DEFAULT_RISK_STRENGTHS.street).toBeGreaterThan(0)
  })

  it('zeroes the street-flooding risk and its default strength', async () => {
    vi.stubEnv('VITE_COMMERCIAL_USE', 'true')
    vi.resetModules()
    const m = await import('./climateRisk')
    expect(m.streetFloodRisk({ street_t10: 1, street_t100: 1 })).toBe(0)
    expect(m.DEFAULT_RISK_STRENGTHS.street).toBe(0)
  })

  it('leaves river flood and wildfire risks alone', async () => {
    vi.stubEnv('VITE_COMMERCIAL_USE', 'true')
    vi.resetModules()
    const m = await import('./climateRisk')
    expect(m.floodRisk({ flood_t10: 1 })).toBeGreaterThan(0)
  })
})
