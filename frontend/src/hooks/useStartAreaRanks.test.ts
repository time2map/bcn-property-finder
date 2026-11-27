import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AreaRank } from '../services/areas/areaRank'

const loadAreaStart = vi.fn()
vi.mock('../services/areas/areaStart', () => ({ loadAreaStart: () => loadAreaStart() }))

import { scoreSettingsOf, useStore } from '../store'
import { firstVisitSettings, settingsKey } from '../services/buildings/firstVisit'
import { DEFAULT_CONDITIONS } from '../services/buildings/conditions'
import { useStartAreaRanks } from './useStartAreaRanks'

const RANKS = [{ index: 0, name: 'el Raval', mean: 61 }] as unknown as AreaRank[]
const firstVisit = () => useStore.setState({ ...settingsState(), areaRanks: null, contrastBoost: false })
function settingsState() {
  const s = firstVisitSettings()
  return {
    compositeWeights: s.weights, conditions: s.conditions, enabledLandmarkIds: s.enabledLandmarkIds,
    enabledWalkCategories: s.enabledCategories, compositeRiskStrengths: s.riskStrengths, ageEras: s.ageEras,
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('useStartAreaRanks (058)', () => {
  beforeEach(() => {
    firstVisit()
    loadAreaStart.mockReset().mockResolvedValue({ key: settingsKey(firstVisitSettings()), ranks: RANKS })
  })

  it('colours the areas from the file on a first visit', async () => {
    renderHook(() => useStartAreaRanks())
    await waitFor(() => expect(useStore.getState().areaRanks).toBe(RANKS))
  })

  it('leaves the areas alone with other settings, Boost contrast, ranks already there, or no file', async () => {
    useStore.setState({ conditions: { ...DEFAULT_CONDITIONS, walkMaxMin: DEFAULT_CONDITIONS.walkMaxMin + 5 } })
    renderHook(() => useStartAreaRanks())
    await flush()
    expect(useStore.getState().areaRanks).toBeNull()

    firstVisit()
    useStore.setState({ contrastBoost: true })
    renderHook(() => useStartAreaRanks())
    await flush()
    expect(useStore.getState().areaRanks).toBeNull()

    firstVisit()
    const scored = [{ index: 0, mean: 70 }] as unknown as AreaRank[]
    useStore.setState({ areaRanks: scored })
    renderHook(() => useStartAreaRanks())
    await flush()
    expect(useStore.getState().areaRanks).toBe(scored)

    firstVisit()
    loadAreaStart.mockResolvedValue(null)
    renderHook(() => useStartAreaRanks())
    await flush()
    expect(useStore.getState().areaRanks).toBeNull()
  })
})

describe('first-visit settings', () => {
  it('a store with nothing saved starts from them (the build precomputes the areas for these)', async () => {
    localStorage.clear()
    vi.resetModules()
    const fresh = await import('../store')
    const { firstVisitSettings: fv, settingsKey: key } = await import('../services/buildings/firstVisit')
    expect(key(fresh.scoreSettingsOf(fresh.useStore.getState()))).toBe(key(fv()))
  })

  it('the key ignores the order of ids and keys, and sees every value', () => {
    const s = firstVisitSettings()
    expect(settingsKey({ ...s, enabledLandmarkIds: [...s.enabledLandmarkIds].reverse() })).toBe(settingsKey(s))
    expect(settingsKey({ ...s, weights: { ...s.weights, age: 1 } })).not.toBe(settingsKey(s))
    expect(settingsKey({ ...s, enabledCategories: s.enabledCategories.slice(1) })).not.toBe(settingsKey(s))
    expect(settingsKey(scoreSettingsOf(useStore.getState()))).toBe(settingsKey(s))
  })
})
