import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readUrlParams, readWorkplaceFromStorage, useStore, DEFAULT_CENTER } from './index'

describe('layer visibility defaults', () => {
  it('defaults Livability ON and Noise OFF for a fresh visitor (no localStorage)', async () => {
    localStorage.clear()
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    expect(freshStore.getState().compositeVisible).toBe(true)
    expect(freshStore.getState().noiseLayerVisible).toBe(false)
  })

  it('respects an explicit stored Livability OFF', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_composite_visible', 'false')
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    expect(freshStore.getState().compositeVisible).toBe(false)
  })
})

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    configurable: true,
  })
}

describe('readUrlParams', () => {
  it('returns defaults when URL is empty', () => {
    setSearch('')
    expect(readUrlParams()).toEqual({ mapCenter: DEFAULT_CENTER, minutes: 60, zoom: 12 })
  })

  it('does not read workplace from URL (lng/lat ignored)', () => {
    setSearch('?lng=2.1734&lat=41.3851')
    expect(readUrlParams()).not.toHaveProperty('workplace')
  })

  it('reads valid minutes within range', () => {
    setSearch('?minutes=60')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('reads boundary max minutes (120)', () => {
    setSearch('?minutes=120')
    expect(readUrlParams().minutes).toBe(120)
  })

  it('falls back to default for minutes above 120', () => {
    setSearch('?minutes=150')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to default for minutes below 15', () => {
    setSearch('?minutes=10')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to default for non-multiple-of-5 minutes', () => {
    setSearch('?minutes=17')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to default for out-of-range minutes', () => {
    setSearch('?minutes=99')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('reads map center from cx/cy', () => {
    setSearch('?cx=2.19&cy=41.40')
    expect(readUrlParams().mapCenter).toEqual([2.19, 41.40])
  })

  it('falls back to default center when cx/cy are absent', () => {
    setSearch('')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('falls back to default center when cx/cy are invalid', () => {
    setSearch('?cx=abc&cy=def')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('falls back to default center when only cx is present', () => {
    setSearch('?cx=2.19')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('reads zoom from URL', () => {
    setSearch('?zoom=14.5')
    expect(readUrlParams().zoom).toBe(14.5)
  })

  it('falls back to default zoom for out-of-range value', () => {
    setSearch('?zoom=25')
    expect(readUrlParams().zoom).toBe(12)
  })

  it('falls back to default zoom for NaN', () => {
    setSearch('?zoom=abc')
    expect(readUrlParams().zoom).toBe(12)
  })
})

describe('readWorkplaceFromStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing stored', () => {
    expect(readWorkplaceFromStorage()).toBeNull()
  })

  it('returns stored coordinates', () => {
    localStorage.setItem('bcn_workplace', JSON.stringify([2.1734, 41.3851]))
    expect(readWorkplaceFromStorage()).toEqual([2.1734, 41.3851])
  })

  it('returns null for malformed JSON', () => {
    localStorage.setItem('bcn_workplace', 'not-json')
    expect(readWorkplaceFromStorage()).toBeNull()
  })

  it('returns null for array with wrong length', () => {
    localStorage.setItem('bcn_workplace', JSON.stringify([2.1734]))
    expect(readWorkplaceFromStorage()).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    localStorage.setItem('bcn_workplace', JSON.stringify(['a', 'b']))
    expect(readWorkplaceFromStorage()).toBeNull()
  })
})

describe('store setters', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ workplace: null, minutes: 60, resultPolygon: null })
  })

  it('setWorkplace updates store', () => {
    useStore.getState().setWorkplace([2.17, 41.38])
    expect(useStore.getState().workplace).toEqual([2.17, 41.38])
  })

  it('setWorkplace persists to localStorage', () => {
    useStore.getState().setWorkplace([2.17, 41.38])
    expect(JSON.parse(localStorage.getItem('bcn_workplace')!)).toEqual([2.17, 41.38])
  })

  it('setWorkplace(null) removes from localStorage', () => {
    useStore.getState().setWorkplace([2.17, 41.38])
    useStore.getState().setWorkplace(null)
    expect(useStore.getState().workplace).toBeNull()
    expect(localStorage.getItem('bcn_workplace')).toBeNull()
  })

  it('setMinutes updates minutes', () => {
    useStore.getState().setMinutes(45)
    expect(useStore.getState().minutes).toBe(45)
  })

  it('setResultPolygon updates resultPolygon', () => {
    const polygon = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    useStore.getState().setResultPolygon(polygon)
    expect(useStore.getState().resultPolygon).toEqual(polygon)
  })
})

describe('climate risk state (036)', () => {
  it('defaults: risk strengths from env (5/5/5), climate layers hidden, street layer on T10', async () => {
    localStorage.clear()
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    expect(freshStore.getState().compositeRiskStrengths).toEqual({ flood: 5, fire: 5, street: 5 })
    expect(freshStore.getState().floodLayerVisible).toBe(false)
    expect(freshStore.getState().wildfireLayerVisible).toBe(false)
    expect(freshStore.getState().streetFloodingLayerVisible).toBe(false)
    expect(freshStore.getState().streetFloodingReturnPeriod).toBe('t10')
  })

  it('restores stored strengths and fills missing keys with defaults', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_composite_risk_strengths', JSON.stringify({ flood: 0 }))
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    // strengths stored before feature 037 have no `street` key → default
    expect(freshStore.getState().compositeRiskStrengths).toEqual({ flood: 0, fire: 5, street: 5 })
  })

  it('falls back to defaults on corrupt storage', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_composite_risk_strengths', '{oops')
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    expect(freshStore.getState().compositeRiskStrengths).toEqual({ flood: 5, fire: 5, street: 5 })
  })

  it('setters update and persist', () => {
    localStorage.clear()
    useStore.getState().setCompositeRiskStrengths({ flood: 8, fire: 2, street: 4 })
    useStore.getState().setStreetFloodingLayerVisible(true)
    useStore.getState().setStreetFloodingReturnPeriod('t100')
    useStore.getState().setFloodLayerVisible(true)
    useStore.getState().setWildfireLayerVisible(true)
    const s = useStore.getState()
    expect(s.compositeRiskStrengths).toEqual({ flood: 8, fire: 2, street: 4 })
    expect(s.streetFloodingLayerVisible).toBe(true)
    expect(s.streetFloodingReturnPeriod).toBe('t100')
    expect(localStorage.getItem('bcn_street_flooding_layer_visible')).toBe('true')
    expect(s.floodLayerVisible).toBe(true)
    expect(s.wildfireLayerVisible).toBe(true)
    expect(JSON.parse(localStorage.getItem('bcn_composite_risk_strengths')!)).toEqual({ flood: 8, fire: 2, street: 4 })
    expect(localStorage.getItem('bcn_flood_layer_visible')).toBe('true')
    expect(localStorage.getItem('bcn_wildfire_layer_visible')).toBe('true')
  })
})
