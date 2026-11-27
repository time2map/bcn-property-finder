import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadBarriVibe, resetBarriVibeCache, topProblems, type BarriVibe,
} from './localsOpinion'
import * as mod from './localsOpinion'

const barri = (problems: Partial<BarriVibe['problems']>): BarriVibe => ({
  name: 'x', n: 300, lowN: false, satisf: 7, satisfAdj: 7, stay: 50, delta: 0,
  problems: {
    insecurity: null, cleanliness: null, noise: null, housing: null, tourism: null,
    incivility: null, drugs_squats: null, maintenance: null, parking: null, traffic: null,
    ...problems,
  },
})

describe('topProblems', () => {
  it('returns the largest shares first and skips missing ones', () => {
    const b = barri({ insecurity: 43.7, cleanliness: 10.4, noise: 8.4, drugs_squats: 8.5, parking: 0.3 })
    expect(topProblems(b)).toEqual([
      { id: 'insecurity', pct: 43.7 },
      { id: 'cleanliness', pct: 10.4 },
      { id: 'drugs_squats', pct: 8.5 },
    ])
  })

  it('returns fewer when fewer are known', () => {
    expect(topProblems(barri({ noise: 14 }))).toEqual([{ id: 'noise', pct: 14 }])
  })
})

describe('loadBarriVibe', () => {
  const data = { years: '2022–2026', city: {}, barris: {} }

  beforeEach(() => {
    resetBarriVibeCache()
  })

  it('fetches once, caches, and exposes the data for synchronous lookups', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
    vi.stubGlobal('fetch', fetchMock)
    expect(mod.barriVibeData).toBeNull()
    const a = await loadBarriVibe()
    const b = await loadBarriVibe()
    expect(a).toBe(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/data\/barri-vibe\.json\?v=[0-9a-f]{10}$/)
    expect(mod.barriVibeData).toBe(a)
  })

  it('does not cache a failed load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) }))
    await expect(loadBarriVibe()).rejects.toThrow('404')
    await expect(loadBarriVibe()).resolves.toEqual(data)
  })
})
