import { describe, it, expect, vi, afterEach } from 'vitest'

/** A fresh store, loaded at the given address (the store reads `c` once, when it is created). */
async function loadStoreAt(search: string) {
  vi.resetModules()
  window.history.replaceState(null, '', `/${search}`)
  return (await import('./index')).useStore
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('settings in the URL (TODO-053)', () => {
  it('c wins over what was saved, and is saved for the next visit', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_conditions', JSON.stringify({ noiseMaxDb: 70, walkMaxMin: 5, cityCoreMaxMin: 45, priceMaxEurM2: 6000, localsMin: 8 }))
    localStorage.setItem('bcn_walk_categories', JSON.stringify(['beach']))
    const s = await loadStoreAt('?c=n:55;w:12;svc:park,school')
    const st = s.getState()
    expect(st.conditions.noiseMaxDb).toBe(55)
    expect(st.conditions.walkMaxMin).toBe(12)
    expect(st.conditions.priceMaxEurM2).toBe(4000) // not in the link: the default, not the saved 6000
    expect(st.enabledWalkCategories).toEqual(['park', 'school'])
    expect(JSON.parse(localStorage.getItem('bcn_conditions')!).noiseMaxDb).toBe(55)
    expect(JSON.parse(localStorage.getItem('bcn_walk_categories')!)).toEqual(['park', 'school'])
  })

  it('reads the conditions that are on, their order, the risks and the flat size; an old cb key is ignored (077)', async () => {
    localStorage.clear()
    const s = await loadStoreAt('?c=on:price,noise,risk;r:5,8,0;fa:90;cb:1')
    const st = s.getState()
    expect(st.conditionOrder).toEqual(['openPrice', 'noise', 'risk'])
    expect(st.compositeWeights).toMatchObject({ openPrice: 1, noise: 1, poiAccess: 0, cityCore: 0 })
    expect(st.compositeRiskStrengths).toEqual({ flood: 5, fire: 8, street: 0 })
    expect(st.flatAreaM2).toBe(90)
    expect(localStorage.getItem('bcn_flat_area_m2')).toBe('90')
    expect(JSON.parse(localStorage.getItem('bcn_condition_order')!)).toEqual(['openPrice', 'noise', 'risk'])
  })

  it('a profile link opens that profile', async () => {
    localStorage.clear()
    const s = await loadStoreAt('?c=preset:city')
    expect(s.getState().conditions.cityCoreMaxMin).toBe(25)
    expect(s.getState().conditionOrder).toEqual(['cityCore', 'poiAccess', 'noise'])
  })

  it('"default" means the defaults, whatever was saved', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_conditions', JSON.stringify({ noiseMaxDb: 50, walkMaxMin: 5, cityCoreMaxMin: 10, priceMaxEurM2: 2000, localsMin: 8 }))
    const s = await loadStoreAt('?c=default')
    expect(s.getState().conditions.noiseMaxDb).toBe(65)
    expect(s.getState().conditions.priceMaxEurM2).toBe(4000)
  })

  it('a link does not open the onboarding', async () => {
    localStorage.clear()
    expect((await loadStoreAt('?c=n:55')).getState().onboardingOpen).toBe(false)
    localStorage.clear() // the link's settings were saved; start again as a first-time visitor
    expect((await loadStoreAt('')).getState().onboardingOpen).toBe(true)
  })

  it('without c, or with one that says nothing, the saved settings stay', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_conditions', JSON.stringify({ noiseMaxDb: 52, walkMaxMin: 7, cityCoreMaxMin: 20, priceMaxEurM2: 3000, localsMin: 7.5 }))
    expect((await loadStoreAt('')).getState().conditions.noiseMaxDb).toBe(52)
    expect((await loadStoreAt('?c=')).getState().conditions.noiseMaxDb).toBe(52)
    expect((await loadStoreAt('?c=%20')).getState().conditions.noiseMaxDb).toBe(52)
  })

  it('a c that carries only junk is the default configuration, key by key (never a crash)', async () => {
    localStorage.clear()
    const s = await loadStoreAt('?c=zzz:1;n:loud;;;')
    expect(s.getState().conditions.noiseMaxDb).toBe(65)
  })

  it('the view parameters are untouched', async () => {
    localStorage.clear()
    const s = await loadStoreAt('?minutes=90&zoom=14&cx=2.2&cy=41.4&c=n:55')
    expect(s.getState().minutes).toBe(90)
    expect(s.getState().zoom).toBe(14)
    expect(s.getState().mapCenter).toEqual([2.2, 41.4])
  })
})
