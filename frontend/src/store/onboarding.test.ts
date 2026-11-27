import { describe, it, expect, vi } from 'vitest'
import { profileToPatch, strengthsFor } from '../services/conditionOptions'
import { PRESETS } from '../services/presets'

async function freshStore() {
  vi.resetModules()
  return (await import('./index')).useStore
}

describe('onboarding state (TODO-031)', () => {
  it('opens for a fresh visitor', async () => {
    localStorage.clear()
    const s = await freshStore()
    expect(s.getState().onboarded).toBe(false)
    expect(s.getState().onboardingOpen).toBe(true)
  })

  it('stays closed once finished', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_onboarded', 'true')
    const s = await freshStore()
    expect(s.getState().onboarded).toBe(true)
    expect(s.getState().onboardingOpen).toBe(false)
  })

  it.each(['bcn_conditions', 'bcn_composite_weights', 'bcn_walk_categories', 'bcn_city_core_landmarks', 'bcn_age_eras', 'bcn_composite_risk_strengths'])(
    'stays closed for a returning visitor with saved %s', async (key) => {
      localStorage.clear()
      localStorage.setItem(key, key === 'bcn_conditions' ? '{}' : '[]')
      const s = await freshStore()
      expect(s.getState().onboardingOpen).toBe(false)
    },
  )

  it('completeOnboarding remembers it and closes; openOnboarding reopens without forgetting', async () => {
    localStorage.clear()
    const s = await freshStore()
    s.getState().completeOnboarding()
    expect(localStorage.getItem('bcn_onboarded')).toBe('true')
    expect(s.getState().onboardingOpen).toBe(false)
    s.getState().openOnboarding()
    expect(s.getState().onboardingOpen).toBe(true)
    expect(s.getState().onboarded).toBe(true)
  })
})

describe('condition order', () => {
  it('starts as the active conditions in the default order', async () => {
    localStorage.clear()
    const s = await freshStore()
    expect(s.getState().conditionOrder).toEqual(['noise', 'poiAccess', 'cityCore', 'openPrice', 'risk'])
  })

  it('keeps the stored order of an existing user and appends the rest', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_condition_order', JSON.stringify(['openPrice', 'noise']))
    const s = await freshStore()
    expect(s.getState().conditionOrder).toEqual(['openPrice', 'noise', 'poiAccess', 'cityCore', 'risk'])
  })

  it('ignores junk in the stored order', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_condition_order', '{"a":1}')
    const s = await freshStore()
    expect(s.getState().conditionOrder).toEqual(['noise', 'poiAccess', 'cityCore', 'openPrice', 'risk'])
    localStorage.setItem('bcn_condition_order', JSON.stringify(['nope', 'noise', 5]))
    const t = await freshStore()
    expect(t.getState().conditionOrder[0]).toBe('noise')
  })

  it('migrates a pre-049 user: only the conditions that were on are listed', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_composite_weights', JSON.stringify({ poiAccess: 7, noise: 0, cityCore: 0, openPrice: 3 }))
    const s = await freshStore()
    expect(s.getState().conditionOrder).toEqual(['poiAccess', 'openPrice', 'risk'])
  })
})

describe('applySettings', () => {
  it('sets every value of a profile in one update and saves each one', async () => {
    localStorage.clear()
    const s = await freshStore()
    const family = PRESETS.find((p) => p.id === 'family')!
    const patch = profileToPatch(family)
    let updates = 0
    const unsub = s.subscribe(() => { updates++ })
    s.getState().applySettings(patch)
    unsub()
    expect(updates).toBe(1)
    const st = s.getState()
    expect(st.compositeWeights).toEqual(patch.weights)
    expect(st.conditions.noiseMaxDb).toBe(58)
    expect(st.enabledWalkCategories).toEqual(['school', 'kindergarten', 'park', 'supermarket', 'pharmacy'])
    expect(st.compositeRiskStrengths).toEqual(strengthsFor('avoid'))
    expect(st.conditionOrder).toEqual(['noise', 'poiAccess', 'openPrice', 'risk'])
    expect(JSON.parse(localStorage.getItem('bcn_conditions')!).priceMaxEurM2).toBe(3571.43) // €250,000 for 70 m²
    expect(JSON.parse(localStorage.getItem('bcn_walk_categories')!)).toContain('school')
    expect(JSON.parse(localStorage.getItem('bcn_condition_order')!)).toEqual(['noise', 'poiAccess', 'openPrice', 'risk'])
    expect(JSON.parse(localStorage.getItem('bcn_composite_weights')!).cityCore).toBe(0)
  })

  it('leaves what the patch does not mention alone', async () => {
    localStorage.clear()
    const s = await freshStore()
    const before = s.getState().conditions
    s.getState().applySettings({ order: ['noise'] })
    expect(s.getState().conditions).toBe(before)
    expect(s.getState().conditionOrder).toEqual(['noise'])
    expect(localStorage.getItem('bcn_conditions')).toBeNull()
  })

  it('a reload after applySettings keeps the profile and does not reopen the onboarding', async () => {
    localStorage.clear()
    const s = await freshStore()
    s.getState().applySettings(profileToPatch(PRESETS.find((p) => p.id === 'city')!))
    const again = await freshStore()
    expect(again.getState().conditions.cityCoreMaxMin).toBe(25)
    expect(again.getState().conditionOrder).toEqual(['cityCore', 'poiAccess', 'noise'])
    expect(again.getState().onboardingOpen).toBe(false)
  })
})

describe('flat size (the budget word, TODO-031)', () => {
  it('starts at the default size and loads a saved one, ignoring junk', async () => {
    localStorage.clear()
    expect((await freshStore()).getState().flatAreaM2).toBe(70)
    localStorage.setItem('bcn_flat_area_m2', '90')
    expect((await freshStore()).getState().flatAreaM2).toBe(90)
    for (const junk of ['abc', '0', '-5', '5000', '']) {
      localStorage.setItem('bcn_flat_area_m2', junk)
      expect((await freshStore()).getState().flatAreaM2).toBe(70)
    }
  })

  it('a new size keeps the budget: the price per m² moves, in one update, and both are saved', async () => {
    localStorage.clear()
    const s = await freshStore()
    s.getState().setConditions({ ...s.getState().conditions, priceMaxEurM2: 3500 })
    let updates = 0
    const unsub = s.subscribe(() => { updates++ })
    s.getState().setFlatArea(90)
    unsub()
    expect(updates).toBe(1)
    expect(s.getState().flatAreaM2).toBe(90)
    expect(s.getState().conditions.priceMaxEurM2).toBeCloseTo(2722.22, 2) // €245,000 / 90 m²
    expect(JSON.parse(localStorage.getItem('bcn_conditions')!).priceMaxEurM2).toBeCloseTo(2722.22, 2)
    expect(localStorage.getItem('bcn_flat_area_m2')).toBe('90')
  })

  it('the same size changes nothing', async () => {
    localStorage.clear()
    const s = await freshStore()
    const before = s.getState().conditions
    s.getState().setFlatArea(70)
    expect(s.getState().conditions.priceMaxEurM2).toBe(before.priceMaxEurM2)
  })
})
