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
    expect(readUrlParams()).toEqual({ mapCenter: DEFAULT_CENTER, minutes: 30, zoom: 12 }) // the daily trip default (078)
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
    expect(readUrlParams().minutes).toBe(30)
  })

  it('falls back to default for minutes below 15', () => {
    setSearch('?minutes=10')
    expect(readUrlParams().minutes).toBe(30)
  })

  it('falls back to default for non-multiple-of-5 minutes', () => {
    setSearch('?minutes=17')
    expect(readUrlParams().minutes).toBe(30)
  })

  it('falls back to default for out-of-range minutes', () => {
    setSearch('?minutes=99')
    expect(readUrlParams().minutes).toBe(30)
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

describe('building age state (TODO-047)', () => {
  it('weight off and every era liked by default', async () => {
    localStorage.clear()
    vi.resetModules()
    const { useStore: freshStore } = await import('./index')
    expect(freshStore.getState().compositeWeights.age).toBe(0)
    expect(freshStore.getState().ageEras).toEqual(['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'])
  })

  it('restores stored eras and weight; unknown era ids are dropped, none left → all eras', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_age_eras', JSON.stringify(['2007-on', '1850-1899']))
    localStorage.setItem('bcn_composite_weights', JSON.stringify({ age: 7 }))
    vi.resetModules()
    let fresh = (await import('./index')).useStore
    expect(fresh.getState().ageEras).toEqual(['2007-on'])
    expect(fresh.getState().compositeWeights.age).toBe(1)

    localStorage.setItem('bcn_age_eras', JSON.stringify(['1850-1899']))
    vi.resetModules()
    fresh = (await import('./index')).useStore
    expect(fresh.getState().ageEras).toHaveLength(5)
    fresh.getState().setAgeEras(['1900-1939'])
    expect(JSON.parse(localStorage.getItem('bcn_age_eras')!)).toEqual(['1900-1939'])
  })
})

describe('conditions (049)', () => {
  it('defaults: conditions from env; services, noise, City Core and price on, the rest off', async () => {
    localStorage.clear()
    vi.resetModules()
    const { useStore: fresh } = await import('./index')
    expect(fresh.getState().conditions).toEqual({
      noiseMaxDb: 65, priceMaxEurM2: 4000, cityCoreMaxMin: 30, walkMaxMin: 10, localsMin: 7.5,
    })
    expect(fresh.getState().compositeWeights).toEqual({
      poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1, localsOpinion: 0, age: 0,
    })
  })

  it('weights stored before 049 (1–10) read as on, 0 as off', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_composite_weights', JSON.stringify({ poiAccess: 6, noise: 0, cityCore: 8, openPrice: 10 }))
    vi.resetModules()
    const { useStore: fresh } = await import('./index')
    expect(fresh.getState().compositeWeights).toMatchObject({ poiAccess: 1, noise: 0, cityCore: 1, openPrice: 1 })
  })

  it('restores stored conditions key by key and persists changes', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_conditions', JSON.stringify({ noiseMaxDb: 55, priceMaxEurM2: 'x' }))
    vi.resetModules()
    const { useStore: fresh } = await import('./index')
    expect(fresh.getState().conditions).toMatchObject({ noiseMaxDb: 55, priceMaxEurM2: 4000 })
    fresh.getState().setConditions({ ...fresh.getState().conditions, walkMaxMin: 7 })
    expect(JSON.parse(localStorage.getItem('bcn_conditions')!).walkMaxMin).toBe(7)
  })
})

describe('selected building and area (TODO-064)', () => {
  it('keeps only the one picked last', () => {
    const s = useStore.getState()
    s.setSelectedBuilding(5)
    s.setSelectedArea(3)
    expect(useStore.getState()).toMatchObject({ selectedArea: 3, selectedBuilding: null })
    useStore.getState().setSelectedBuilding(7)
    expect(useStore.getState()).toMatchObject({ selectedArea: null, selectedBuilding: 7 })
    useStore.getState().setSelectedBuilding(null)
    expect(useStore.getState().selectedBuilding).toBeNull()
  })
})

describe('default services and City Core places (TODO-073)', () => {
  beforeEach(() => localStorage.clear())

  it('reads a saved list; a saved list of every id was the old default and reads as the new one', async () => {
    const { loadIds } = await import('./index')
    const all = ['a', 'b', 'c', 'd']
    const dflt = ['b', 'c']
    expect(loadIds('k', all, dflt, true)).toEqual(dflt)
    localStorage.setItem('k', JSON.stringify(['d', 'a']))
    expect(loadIds('k', all, dflt, true)).toEqual(['d', 'a'])
    localStorage.setItem('k', JSON.stringify(['a', 'b', 'c', 'd']))
    expect(loadIds('k', all, dflt, true)).toEqual(dflt)
    // Without the migration (building eras), "all" stays a choice.
    expect(loadIds('k', all, all)).toEqual(all)
    localStorage.setItem('k', JSON.stringify(['zz']))
    expect(loadIds('k', all, dflt, true)).toEqual(dflt)
  })

  it('a first visit starts without the beach and with three central places', async () => {
    const { DEFAULT_LANDMARK_IDS, DEFAULT_WALK_CATEGORY_IDS, firstVisitSettings } = await import('../services/buildings/firstVisit')
    expect(DEFAULT_WALK_CATEGORY_IDS).not.toContain('beach')
    expect(DEFAULT_WALK_CATEGORY_IDS).toHaveLength(9)
    expect(DEFAULT_LANDMARK_IDS).toEqual(['placa_cat', 'barri_gotic', 'pg_gracia'])
    expect(firstVisitSettings().enabledLandmarkIds).toEqual(DEFAULT_LANDMARK_IDS)
    expect(firstVisitSettings().enabledCategories).toEqual(DEFAULT_WALK_CATEGORY_IDS)
  })
})

describe('funnel (TODO-076)', () => {
  beforeEach(() => useStore.setState({ funnelOpen: true, funnelPicks: [], funnelSea: false, selectedBuilding: null }))

  it('keeps the picks in order, each wish once', () => {
    const s = useStore.getState()
    s.pickFunnelWish('quiet')
    s.pickFunnelWish('metro')
    s.pickFunnelWish('quiet')
    expect(useStore.getState().funnelPicks).toEqual(['quiet', 'metro'])
  })

  it('Back drops the last pick; Start again drops the picks, the sea and the open card', () => {
    const s = useStore.getState()
    s.pickFunnelWish('quiet')
    s.pickFunnelWish('metro')
    s.undoFunnelWish()
    expect(useStore.getState().funnelPicks).toEqual(['quiet'])
    s.setFunnelSea(true)
    s.setSelectedBuilding(12)
    s.resetFunnel()
    expect(useStore.getState()).toMatchObject({ funnelPicks: [], funnelSea: false, selectedBuilding: null })
  })

  it('opens and closes', () => {
    useStore.getState().setFunnelOpen(false)
    expect(useStore.getState().funnelOpen).toBe(false)
  })
})

describe('daily trip state (078)', () => {
  it('removing the place removes its commute zone too; picking on the map is a flag', () => {
    useStore.setState({ workplace: [2.17, 41.387], resultPolygon: { type: 'Polygon', coordinates: [[[2, 41], [2.1, 41], [2, 41.1], [2, 41]]] } })
    useStore.getState().setWorkplace(null)
    expect(useStore.getState().resultPolygon).toBeNull()
    useStore.getState().setCommutePicking(true)
    expect(useStore.getState().commutePicking).toBe(true)
  })
})
