import { describe, it, expect } from 'vitest'
import { decodeConfig, encodeConfig, shareUrl, withConfig, type UrlSettings } from './urlConfig'
import { PRESETS } from './presets'
import { profileToPatch, strengthsFor, activeConditions } from './conditionOptions'
import { DEFAULT_CONDITIONS } from './buildings/conditions'
import { ALL_LANDMARK_IDS } from './cityCore/landmarks'
import { ALL_AGE_ERA_IDS } from './buildings/buildingAge'
import { SERVICE_CATEGORIES } from './walkability/serviceCategories'
import { DEFAULT_RISK_STRENGTHS } from './climateRisk/climateRisk'

const ALL_SERVICES = SERVICE_CATEGORIES.map((c) => c.id)
const DEFAULT_WEIGHTS = { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1, localsOpinion: 0, age: 0 }
const DEFAULTS: UrlSettings = {
  weights: DEFAULT_WEIGHTS,
  conditions: DEFAULT_CONDITIONS,
  walkCategories: ALL_SERVICES,
  landmarkIds: ALL_LANDMARK_IDS,
  eras: ALL_AGE_ERA_IDS,
  riskStrengths: DEFAULT_RISK_STRENGTHS,
  order: activeConditions(DEFAULT_WEIGHTS, DEFAULT_RISK_STRENGTHS, []),
  flatAreaM2: 70,
  contrastBoost: false,
}
const decode = (raw: string | null) => decodeConfig(raw, DEFAULTS)!

describe('encodeConfig', () => {
  it('is empty for the defaults', () => expect(encodeConfig(DEFAULTS, DEFAULTS)).toBe(''))

  it('writes only what differs from the defaults', () => {
    const s = { ...DEFAULTS, conditions: { ...DEFAULT_CONDITIONS, noiseMaxDb: 58 } }
    expect(encodeConfig(s, DEFAULTS)).toBe('n:58')
  })

  it('writes a full custom configuration in a readable form', () => {
    const s: UrlSettings = {
      weights: { poiAccess: 1, noise: 1, cityCore: 0, openPrice: 1, localsOpinion: 0, age: 0 },
      conditions: { ...DEFAULT_CONDITIONS, noiseMaxDb: 58, walkMaxMin: 15, priceMaxEurM2: 3571.43, localsMin: 8 },
      walkCategories: ['supermarket', 'pharmacy', 'park'],
      landmarkIds: ['sagrada', 'placa_cat'],
      eras: ['1900-1939', '1940-1979'],
      riskStrengths: { flood: 5, fire: 8, street: 0 },
      order: ['openPrice', 'noise', 'poiAccess', 'risk'],
      flatAreaM2: 90,
      contrastBoost: true,
    }
    expect(encodeConfig(s, DEFAULTS)).toBe(
      'on:price,noise,poi,risk;n:58;w:15;p:3571.43;l:8;fa:90;svc:supermarket,pharmacy,park;lm:sagrada,placa_cat;era:1900-1939,1940-1979;r:5,8,0;cb:1',
    )
  })

  it('keeps lists in their canonical order, whatever order they were picked in', () => {
    const s = { ...DEFAULTS, landmarkIds: ['placa_cat', 'sagrada'] }
    expect(encodeConfig(s, DEFAULTS)).toBe('lm:sagrada,placa_cat')
  })

  it('leaves a list out when every item is on', () => {
    expect(encodeConfig({ ...DEFAULTS, walkCategories: [...ALL_SERVICES].reverse() }, DEFAULTS)).toBe('')
  })

  it('writes the condition order, with risks in it, when it differs', () => {
    const s = { ...DEFAULTS, order: ['risk', 'noise', 'poiAccess', 'cityCore', 'openPrice'] as UrlSettings['order'] }
    expect(encodeConfig(s, DEFAULTS)).toBe('on:risk,noise,poi,core,price')
  })

  it('no risks: the line is left out of the conditions', () => {
    const s: UrlSettings = { ...DEFAULTS, riskStrengths: strengthsFor('off'), order: ['noise', 'poiAccess', 'cityCore', 'openPrice'] }
    expect(encodeConfig(s, DEFAULTS)).toBe('on:noise,poi,core,price;r:0,0,0')
  })
})

describe('decodeConfig', () => {
  it('is null when there is nothing to read', () => {
    for (const raw of [null, undefined, '', '   ']) expect(decodeConfig(raw, DEFAULTS)).toBeNull()
  })

  it('the token "default" means the defaults', () => expect(decode('default')).toEqual(DEFAULTS))

  it('a key that is not there is the default, not what the visitor saved', () => {
    expect(decode('n:58')).toEqual({ ...DEFAULTS, conditions: { ...DEFAULT_CONDITIONS, noiseMaxDb: 58 } })
  })

  it.each([
    ['noise', 'n', 58, 'noiseMaxDb'], ['walk', 'w', 15, 'walkMaxMin'], ['centre', 'cc', 45, 'cityCoreMaxMin'],
    ['price', 'p', 3571.43, 'priceMaxEurM2'], ['locals', 'l', 8, 'localsMin'],
  ] as const)('reads the %s limit', (_n, key, value, field) => {
    expect(decode(`${key}:${value}`).conditions[field]).toBe(value)
  })

  it('reads the flat size and the contrast boost', () => {
    expect(decode('fa:90;cb:1')).toMatchObject({ flatAreaM2: 90, contrastBoost: true })
    expect(decode('cb:0').contrastBoost).toBe(false)
  })

  it('reads which conditions are on, in priority order', () => {
    const s = decode('on:price,noise,locals')
    expect(s.weights).toEqual({ poiAccess: 0, noise: 1, cityCore: 0, openPrice: 1, localsOpinion: 1, age: 0 })
    expect(s.order).toEqual(['openPrice', 'noise', 'localsOpinion'])
    expect(s.riskStrengths).toEqual(strengthsFor('off'))
  })

  it('"on" with risk keeps the risks on at the default strength and in its place', () => {
    const s = decode('on:risk,noise')
    expect(s.order).toEqual(['risk', 'noise'])
    expect(s.riskStrengths).toEqual(DEFAULT_RISK_STRENGTHS)
  })

  it('an empty "on" turns every condition off', () => {
    const s = decode('on:')
    expect(s.order).toEqual([])
    expect(Object.values(s.weights).every((w) => w === 0)).toBe(true)
  })

  it('risk strengths from "r" decide whether the risks are on', () => {
    expect(decode('on:noise;r:5,8,0').order).toEqual(['noise', 'risk'])
    expect(decode('r:0,0,0').order).toEqual(['noise', 'poiAccess', 'cityCore', 'openPrice'])
  })

  it('reads the lists and drops ids that do not exist', () => {
    const s = decode('svc:park,nope,school;lm:sagrada;era:1900-1939,1850')
    expect(s.walkCategories).toEqual(['park', 'school'])
    expect(s.landmarkIds).toEqual(['sagrada'])
    expect(s.eras).toEqual(['1900-1939'])
  })

  it('a list with nothing valid in it is the default (all)', () => {
    const s = decode('svc:nope;lm:;era:abc')
    expect(s.walkCategories).toEqual(ALL_SERVICES)
    expect(s.landmarkIds).toEqual(ALL_LANDMARK_IDS)
    expect(s.eras).toEqual(ALL_AGE_ERA_IDS)
  })

  it('ignores unknown keys, broken pairs and invalid values, key by key', () => {
    const s = decode('zzz:1;n:loud;w:15;p:-5;l:99;cc:;broken;fa:0;r:5,x,1;cb:maybe;on:noise,nope')
    expect(s.conditions).toEqual({ ...DEFAULT_CONDITIONS, walkMaxMin: 15 })
    expect(s.flatAreaM2).toBe(70)
    expect(s.riskStrengths).toEqual(strengthsFor('off')) // "on" lists no risks and "r" is invalid
    expect(s.contrastBoost).toBe(false)
    expect(s.order).toEqual(['noise'])
  })

  it('numbers outside a sane range are ignored', () => {
    const s = decode('n:500;w:0;cc:9999;p:1;fa:9999')
    expect(s.conditions).toEqual(DEFAULT_CONDITIONS)
    expect(s.flatAreaM2).toBe(70)
  })

  it('works with the URL-encoded form too', () => {
    expect(decode(encodeURIComponent('n:58;w:15')).conditions).toMatchObject({ noiseMaxDb: 58, walkMaxMin: 15 })
    // URLSearchParams has decoded it already in the app; the raw form must work as well
    expect(decode('n:58;w:15').conditions).toMatchObject({ noiseMaxDb: 58, walkMaxMin: 15 })
  })

  it('a preset expands to its values, and overrides win', () => {
    const family = PRESETS.find((p) => p.id === 'family')!
    const patch = profileToPatch(family)
    const s = decode('preset:family')
    expect(s.weights).toEqual(patch.weights)
    expect(s.conditions).toEqual(patch.conditions)
    expect(s.order).toEqual(patch.order)
    expect(s.walkCategories).toEqual(patch.walkCategories)
    const over = decode('preset:family;n:50')
    expect(over.conditions.noiseMaxDb).toBe(50)
    expect(over.conditions.priceMaxEurM2).toBe(patch.conditions!.priceMaxEurM2)
  })

  it('a link with the removed investor profile loads with the defaults, no error', () => expect(() => decode('preset:investor;n:58')).not.toThrow())
  it('an unknown preset is ignored', () => expect(decode('preset:nope;n:58').conditions.noiseMaxDb).toBe(58))
})

describe('round trip', () => {
  const states: [string, UrlSettings][] = [
    ['defaults', DEFAULTS],
    ...PRESETS.map((p): [string, UrlSettings] => {
      const patch = profileToPatch(p)
      const canon = (all: readonly string[], picked: readonly string[]) => all.filter((id) => picked.includes(id))
      return [`profile ${p.name}`, {
        ...DEFAULTS, weights: patch.weights!, conditions: patch.conditions!,
        walkCategories: canon(ALL_SERVICES, patch.walkCategories!), landmarkIds: canon(ALL_LANDMARK_IDS, patch.landmarkIds!),
        eras: canon(ALL_AGE_ERA_IDS, patch.eras!), riskStrengths: patch.riskStrengths!, order: patch.order!,
      }]
    }),
    ['custom', {
      weights: { poiAccess: 0, noise: 1, cityCore: 1, openPrice: 0, localsOpinion: 1, age: 1 },
      conditions: { noiseMaxDb: 52, walkMaxMin: 7, cityCoreMaxMin: 20, priceMaxEurM2: 2777.78, localsMin: 7.8 },
      walkCategories: ['metro', 'cafe'], landmarkIds: ['sagrada'], eras: ['2007-on'],
      riskStrengths: { flood: 1, fire: 10, street: 3 },
      order: ['age', 'risk', 'cityCore', 'noise', 'localsOpinion'], flatAreaM2: 120, contrastBoost: true,
    }],
  ]
  it.each(states)('%s survives encode → decode', (_n, state) => {
    expect(decodeConfig(encodeConfig(state, DEFAULTS) || 'default', DEFAULTS)).toEqual(state)
  })
})

describe('withConfig', () => {
  it('adds c to a query string without encoding its separators', () => {
    expect(withConfig('?minutes=60&zoom=12.00', 'on:noise;n:58')).toBe('?minutes=60&zoom=12.00&c=on:noise;n:58')
  })
  it('replaces an existing c and drops it for an empty value', () => {
    expect(withConfig('?minutes=60&c=n:50&zoom=12', 'n:58')).toBe('?minutes=60&zoom=12&c=n:58')
    expect(withConfig('?minutes=60&c=n:50', '')).toBe('?minutes=60')
  })
  it('works from nothing', () => {
    expect(withConfig('', 'n:58')).toBe('?c=n:58')
    expect(withConfig('', '')).toBe('')
  })
})

describe('shareUrl', () => {
  it('is the current address with the settings in c', () => {
    expect(shareUrl('https://x.test/app/?minutes=60&zoom=12.00&cx=2.1&cy=41.4', 'n:58;w:15'))
      .toBe('https://x.test/app/?minutes=60&zoom=12.00&cx=2.1&cy=41.4&c=n:58;w:15')
  })
  it('replaces the c that is already there', () => {
    expect(shareUrl('https://x.test/?c=n:50&zoom=12', 'n:58')).toBe('https://x.test/?zoom=12&c=n:58')
  })
  it('says "default" for the defaults, so the recipient does not keep their own settings', () => {
    expect(shareUrl('https://x.test/?zoom=12', '')).toBe('https://x.test/?zoom=12&c=default')
  })
  it('opens with its own defaults when read back', () => {
    expect(decodeConfig(new URL(shareUrl('https://x.test/', '')).searchParams.get('c'), DEFAULTS)).toEqual(DEFAULTS)
  })
})
