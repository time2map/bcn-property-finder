import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cityFixture, VIBE } from './funnelFixture'

const buildings = cityFixture(50)
const loadBuildings = vi.fn()
const loadBarriVibe = vi.fn()
vi.mock('../buildings/buildingData', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadBuildings: () => loadBuildings(),
}))
vi.mock('../localsOpinion/localsOpinion', () => ({ loadBarriVibe: () => loadBarriVibe() }))

const { loadFunnelData, resetFunnelDataCache } = await import('./funnelData')

describe('loadFunnelData', () => {
  beforeEach(() => {
    resetFunnelDataCache()
    loadBuildings.mockReset().mockResolvedValue(buildings)
    loadBarriVibe.mockReset().mockResolvedValue(VIBE)
  })

  it('loads the buildings and the survey once and builds the funnel data', async () => {
    const a = await loadFunnelData()
    const b = await loadFunnelData()
    expect(a).toBe(b)
    expect(loadBuildings).toHaveBeenCalledTimes(1)
    expect(a.buildings).toBe(buildings)
    expect(a.fd.wishes).toContain('locals') // the locals flag is on in the tests
    expect(a.fd.rows.length).toBeGreaterThan(0)
  })

  it('tries again after a failed load', async () => {
    loadBuildings.mockRejectedValueOnce(new Error('offline'))
    await expect(loadFunnelData()).rejects.toThrow('offline')
    await expect(loadFunnelData()).resolves.toMatchObject({ buildings })
    expect(loadBuildings).toHaveBeenCalledTimes(2)
  })
})
