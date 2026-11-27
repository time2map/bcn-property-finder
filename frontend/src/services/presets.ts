import i18n from '../i18n'
import {
  CONDITION_KEYS, DEFAULT_FLAT_AREA_M2, formatEuro, priceForBudget, type ConditionKey, type Profile,
} from './conditionOptions'

/** What the budget profiles can spend on a flat of the default size. */
const BUDGET_EUR = 250_000
const budgetText = () => i18n.t('conditions:profile.budget', { area: DEFAULT_FLAT_AREA_M2, price: formatEuro(BUDGET_EUR) })

type ProfileId = 'family' | 'remote' | 'city' | 'retiree'

/** Name of a profile in the page language (an ENV override with its own `name` wins). Read on each call. */
export function profileName(p: Pick<Profile, 'id' | 'name'>): string {
  return p.name ?? i18n.t(`conditions:profile.${p.id as ProfileId}.name`)
}

/** One-line description of a profile in the page language (an ENV override with its own `blurb` wins). */
export function profileBlurb(p: Pick<Profile, 'id' | 'blurb'>): string {
  if (p.blurb) return p.blurb
  return i18n.t(`conditions:profile.${p.id as ProfileId}.blurb`, { budget: budgetText() })
}

// Profiles of the first onboarding screen (TODO-031). A profile is a sentence that is already filled in; the
// person can still change every word. Override one with ENV `VITE_PRESET_<ID>` = JSON of the fields to change.

const BASE: Profile[] = [
  {
    id: 'family',
    order: ['noise', 'poiAccess', 'openPrice', 'risk'],
    conditions: { noiseMaxDb: 58, walkMaxMin: 10, priceMaxEurM2: priceForBudget(BUDGET_EUR, DEFAULT_FLAT_AREA_M2) },
    walkCategories: ['school', 'kindergarten', 'park', 'supermarket', 'pharmacy'],
    risk: 'avoid',
  },
  {
    id: 'remote',
    order: ['poiAccess', 'cityCore', 'noise'],
    conditions: { walkMaxMin: 10, cityCoreMaxMin: 30, noiseMaxDb: 58 },
    walkCategories: ['cafe', 'supermarket', 'park'],
  },
  {
    id: 'city',
    order: ['cityCore', 'poiAccess', 'noise'],
    conditions: { cityCoreMaxMin: 25, walkMaxMin: 5, noiseMaxDb: 65 },
    walkCategories: ['cafe', 'restaurant', 'metro'],
  },
  {
    id: 'retiree',
    order: ['poiAccess', 'noise', 'risk'],
    conditions: { walkMaxMin: 5, noiseMaxDb: 58 },
    walkCategories: ['clinic', 'pharmacy', 'supermarket', 'park'],
    risk: 'avoid',
  },
]

/** A profile with the fields of a JSON override applied; a broken or non-object override changes nothing. */
export function applyOverride(base: Profile, raw: string | undefined): Profile {
  if (!raw) return base
  try {
    const o = JSON.parse(raw) as unknown
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return base
    const patch = o as Partial<Profile>
    const order = Array.isArray(patch.order)
      ? patch.order.filter((k): k is ConditionKey => CONDITION_KEYS.includes(k as ConditionKey))
      : base.order
    return { ...base, ...patch, id: base.id, order }
  } catch {
    return base
  }
}

const OVERRIDES: Record<string, string | undefined> = {
  family: import.meta.env.VITE_PRESET_FAMILY,
  remote: import.meta.env.VITE_PRESET_REMOTE,
  city: import.meta.env.VITE_PRESET_CITY,
  retiree: import.meta.env.VITE_PRESET_RETIREE,
}

export const PRESETS: Profile[] = BASE.map((p) => applyOverride(p, OVERRIDES[p.id]))
