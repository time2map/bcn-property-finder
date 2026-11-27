import { describe, it, expect } from 'vitest'
import { PRESETS, applyOverride, profileName, profileBlurb } from './presets'
import { profileToPatch, CONDITION_KEYS, type Profile } from './conditionOptions'
import { SERVICE_CATEGORIES } from './walkability/serviceCategories'
import { LANDMARKS } from './cityCore/landmarks'
import { CONDITION_RANGES } from './buildings/conditions'

describe('PRESETS', () => {
  it('has the four profiles in the agreed order', () => {
    expect(PRESETS.map((p) => profileName(p))).toEqual(['Family', 'Remote worker', 'City life', 'Retiree'])
  })

  it('ids and names are unique', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map((p) => profileName(p))).size).toBe(PRESETS.length)
  })

  it.each(PRESETS.map((p) => [profileName(p), p] as const))('%s: rows are known, unique and inside the slider ranges', (_n, p) => {
    expect(p.order.length).toBeGreaterThan(0)
    expect(new Set(p.order).size).toBe(p.order.length)
    for (const k of p.order) expect(CONDITION_KEYS).toContain(k)
    for (const [key, v] of Object.entries(p.conditions ?? {})) {
      const range = CONDITION_RANGES[key as keyof typeof CONDITION_RANGES]
      expect(v).toBeGreaterThanOrEqual(range.min)
      expect(v).toBeLessThanOrEqual(range.max)
    }
    expect(profileBlurb(p).length).toBeGreaterThan(10)
  })

  it.each(PRESETS.map((p) => [profileName(p), p] as const))('%s: services and places exist', (_n, p) => {
    const services = SERVICE_CATEGORIES.map((c) => c.id)
    for (const id of p.walkCategories ?? []) expect(services).toContain(id)
    const places = LANDMARKS.map((l) => l.id)
    for (const id of p.landmarkIds ?? []) expect(places).toContain(id)
  })

  it.each(PRESETS.map((p) => [profileName(p), p] as const))('%s: conditions that are not listed are off', (_n, p) => {
    const patch = profileToPatch(p)
    const on = Object.entries(patch.weights!).filter(([, v]) => v === 1).map(([k]) => k)
    for (const k of on) expect(p.order).toContain(k)
    expect(patch.order).toEqual(p.order.filter((k) => k !== 'localsOpinion' || on.includes('localsOpinion')))
  })

  it('has no investor profile', () => {
    expect(PRESETS.some((p) => p.id === 'investor')).toBe(false)
  })

  it('Family and Retiree avoid risks, Remote worker does not', () => {
    const risk = (id: string) => profileToPatch(PRESETS.find((p) => p.id === id)!).riskStrengths!
    expect(risk('family').flood).toBeGreaterThan(0)
    expect(risk('retiree').flood).toBeGreaterThan(0)
    expect(risk('remote')).toEqual({ flood: 0, fire: 0, street: 0 })
  })

  it('Retiree: errands within 5 min, a calm street, no price', () => {
    const r = PRESETS.find((p) => p.id === 'retiree')!
    expect(r.order).toEqual(['poiAccess', 'noise', 'risk'])
    expect(r.conditions).toEqual({ walkMaxMin: 5, noiseMaxDb: 58 })
    expect(r.walkCategories).toEqual(['clinic', 'pharmacy', 'supermarket', 'park'])
    expect(profileToPatch(r).weights!.openPrice).toBe(0)
  })

  it('two profiles differ in what they ask for', () => {
    const a = profileToPatch(PRESETS[0])
    const b = profileToPatch(PRESETS[2])
    expect(a.weights).not.toEqual(b.weights)
  })
})

describe('applyOverride', () => {
  const base: Profile = { id: 'x', name: 'X', blurb: 'A blurb long enough', order: ['noise'], conditions: { noiseMaxDb: 58 } }

  it('merges known fields of a JSON override', () => {
    const p = applyOverride(base, '{"conditions":{"noiseMaxDb":50},"order":["noise","risk"]}')
    expect(p.conditions).toEqual({ noiseMaxDb: 50 })
    expect(p.order).toEqual(['noise', 'risk'])
    expect(p.name).toBe('X')
  })

  it('ignores missing, broken or non-object overrides', () => {
    expect(applyOverride(base, undefined)).toEqual(base)
    expect(applyOverride(base, '{oops')).toEqual(base)
    expect(applyOverride(base, '[1,2]')).toEqual(base)
  })

  it('drops unknown rows and keeps the id fixed', () => {
    const p = applyOverride(base, '{"id":"hack","order":["noise","nope"]}')
    expect(p.id).toBe('x')
    expect(p.order).toEqual(['noise'])
  })
})

describe('profile budgets (a flat, not a price per m²)', () => {
  it('Only Family says what they spend on a flat, and the limit is that budget ÷ the flat size', () => {
    for (const id of ['family']) {
      const p = PRESETS.find((x) => x.id === id)!
      expect(profileBlurb(p)).toMatch(/70 m² flat up to €250,000/i)
      expect(p.conditions?.priceMaxEurM2).toBe(3571.43)
    }
  })

  it('the others do not mention a budget', () => {
    for (const id of ['remote', 'city', 'retiree']) expect(profileBlurb(PRESETS.find((x) => x.id === id)!)).not.toMatch(/€/)
  })
})
