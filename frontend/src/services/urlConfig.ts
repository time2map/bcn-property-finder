import { features } from '../features'
import { ALL_LANDMARK_IDS } from './cityCore/landmarks'
import { SERVICE_CATEGORIES } from './walkability/serviceCategories'
import { ALL_AGE_ERA_IDS } from './buildings/buildingAge'
import type { Conditions } from './buildings/conditions'
import type { RiskStrengths } from './climateRisk/climateRisk'
import {
  activeConditions, profileToPatch, strengthsFor, type ConditionKey,
} from './conditionOptions'
import { PRESETS } from './presets'
import type { CompositeWeights } from '../store'

// The whole configuration of the map in one short query parameter, `c` (TODO-053), so that a link opens the
// sender's map: `c=on:noise,poi,price;n:58;w:10;p:3571.43;svc:park,school;r:5,5,0;cb:1`.
// `c` is a complete configuration: what it leaves out is the default, not what the visitor saved earlier.

/** The settings that define the map (everything the sentence editor and the advanced panel can set). */
export interface UrlSettings {
  weights: CompositeWeights
  conditions: Conditions
  walkCategories: readonly string[]
  landmarkIds: readonly string[]
  eras: readonly string[]
  riskStrengths: RiskStrengths
  /** The conditions that are on, in priority order, with the risk line (`risk`) among them. */
  order: ConditionKey[]
  flatAreaM2: number
  contrastBoost: boolean
}

const SHORT: Record<ConditionKey, string> = {
  noise: 'noise', poiAccess: 'poi', cityCore: 'core', openPrice: 'price', localsOpinion: 'locals', age: 'age', risk: 'risk',
}
const FROM_SHORT = Object.fromEntries(Object.entries(SHORT).map(([k, v]) => [v, k as ConditionKey])) as Record<string, ConditionKey>
const SCORED: (keyof CompositeWeights)[] = ['poiAccess', 'noise', 'cityCore', 'openPrice', 'localsOpinion', 'age']
const ALL_SERVICES: readonly string[] = SERVICE_CATEGORIES.map((c) => c.id)

/** Sane bounds of the numbers: a link is untrusted input. */
const BOUNDS = {
  n: [30, 90], w: [1, 60], cc: [1, 180], p: [100, 50_000], l: [0, 10], fa: [10, 1000],
} as const

const LIMIT_KEY = { n: 'noiseMaxDb', w: 'walkMaxMin', cc: 'cityCoreMaxMin', p: 'priceMaxEurM2', l: 'localsMin' } as const

function num(v: string, [min, max]: readonly [number, number]): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

/** The ids of `value` that exist, in the order of `all`; null when none do (the default is then kept). */
function pickIds(value: string, all: readonly string[]): string[] | null {
  const wanted = new Set(value.split(',').map((s) => s.trim()))
  const ids = all.filter((id) => wanted.has(id))
  return ids.length > 0 ? ids : null
}

function parse(raw: string): Map<string, string> {
  let text = raw.trim()
  if (text.includes('%')) {
    try { text = decodeURIComponent(text) } catch { /* keep the raw text */ }
  }
  const pairs = new Map<string, string>()
  for (const part of text.split(';')) {
    const i = part.indexOf(':')
    if (i <= 0) continue // "default", "" or a broken pair
    pairs.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  return pairs
}

/**
 * Reads `c`. Null when there is nothing to read; otherwise the full settings: `defaults`, then a preset
 * (`preset:family`) if there is one, then the keys of the link. Unknown keys and invalid values are ignored key
 * by key.
 */
export function decodeConfig(raw: string | null | undefined, defaults: UrlSettings): UrlSettings | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null
  const pairs = parse(raw)
  let s: UrlSettings = { ...defaults, conditions: { ...defaults.conditions } }

  const preset = PRESETS.find((p) => p.id === pairs.get('preset'))
  if (preset) {
    const p = profileToPatch(preset)
    s = {
      ...s, weights: p.weights!, conditions: p.conditions!, walkCategories: p.walkCategories!, landmarkIds: p.landmarkIds!,
      eras: p.eras!, riskStrengths: p.riskStrengths!, order: p.order!,
    }
  }

  for (const key of ['n', 'w', 'cc', 'p', 'l'] as const) {
    const v = pairs.get(key)
    const n = v === undefined ? null : num(v, BOUNDS[key])
    if (n !== null) s.conditions = { ...s.conditions, [LIMIT_KEY[key]]: n }
  }
  const fa = pairs.has('fa') ? num(pairs.get('fa')!, BOUNDS.fa) : null
  if (fa !== null) s.flatAreaM2 = fa
  const lists: [string, readonly string[], 'walkCategories' | 'landmarkIds' | 'eras'][] = [
    ['svc', ALL_SERVICES, 'walkCategories'], ['lm', ALL_LANDMARK_IDS, 'landmarkIds'], ['era', ALL_AGE_ERA_IDS, 'eras'],
  ]
  for (const [key, all, field] of lists) {
    const ids = pairs.has(key) ? pickIds(pairs.get(key)!, all) : null
    if (ids) s[field] = ids
  }
  if (pairs.has('cb')) {
    const cb = pairs.get('cb')
    if (cb === '1') s.contrastBoost = true
    else if (cb === '0') s.contrastBoost = false
  }

  // Which conditions are on, in which order, and how hard the risks count.
  let order: ConditionKey[] | null = null
  if (pairs.has('on')) {
    order = [...new Set(pairs.get('on')!.split(',').map((x) => FROM_SHORT[x.trim()]).filter((k): k is ConditionKey => !!k))]
    s.weights = Object.fromEntries(SCORED.map((k) => [k, order!.includes(k) ? 1 : 0])) as unknown as CompositeWeights
  }
  const r = pairs.get('r')?.split(',').map((x) => (x.trim() === '' ? NaN : Number(x)))
  if (r && r.length === 3 && r.every((n) => Number.isFinite(n) && n >= 0 && n <= 10)) {
    s.riskStrengths = { flood: r[0], fire: r[1], street: r[2] }
  } else if (order) {
    const off = Object.values(s.riskStrengths).every((n) => n === 0)
    s.riskStrengths = order.includes('risk') ? (off ? strengthsFor('avoid') : s.riskStrengths) : strengthsFor('off')
  }
  // The risk line is in the order exactly when the risks count; a risk that counts but is not listed goes last.
  const riskOn = Object.values(s.riskStrengths).some((n) => n > 0)
  let base = (order ?? s.order).filter((k) => k !== 'risk' || riskOn)
  if (riskOn && !base.includes('risk')) base = [...base, 'risk']
  s.order = order ? base : activeConditions(s.weights, s.riskStrengths, base)
  return s
}

const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => x === b[i])
const canonical = (all: readonly string[], picked: readonly string[]) => all.filter((id) => picked.includes(id))

/** The `c` value for `s`: only what differs from `defaults`; empty when nothing does. */
export function encodeConfig(s: UrlSettings, defaults: UrlSettings): string {
  const parts: string[] = []
  const active = activeConditions(s.weights, s.riskStrengths, s.order)
  if (!same(active, defaults.order)) parts.push(`on:${active.map((k) => SHORT[k]).join(',')}`)
  for (const key of ['n', 'w', 'cc', 'p', 'l'] as const) {
    const field = LIMIT_KEY[key]
    if (s.conditions[field] !== defaults.conditions[field]) parts.push(`${key}:${Math.round(s.conditions[field] * 100) / 100}`)
  }
  if (s.flatAreaM2 !== defaults.flatAreaM2) parts.push(`fa:${s.flatAreaM2}`)
  const lists: [string, readonly string[], readonly string[], readonly string[]][] = [
    ['svc', ALL_SERVICES, s.walkCategories, defaults.walkCategories],
    ['lm', ALL_LANDMARK_IDS, s.landmarkIds, defaults.landmarkIds],
    ['era', ALL_AGE_ERA_IDS, s.eras, defaults.eras],
  ]
  for (const [key, all, picked, dflt] of lists) {
    const ids = canonical(all, picked)
    if (!same(ids, canonical(all, dflt))) parts.push(`${key}:${ids.join(',')}`)
  }
  const r = s.riskStrengths
  const d = defaults.riskStrengths
  if (r.flood !== d.flood || r.fire !== d.fire || r.street !== d.street) parts.push(`r:${r.flood},${r.fire},${r.street}`)
  if (s.contrastBoost !== defaults.contrastBoost) parts.push(`cb:${s.contrastBoost ? 1 : 0}`)
  return parts.join(';')
}

/** `search` ("?minutes=60&…") with `c` set, replaced or, when empty, dropped. The value is not percent-encoded. */
export function withConfig(search: string, c: string): string {
  const rest = search.replace(/^\?/, '').split('&').filter((p) => p !== '' && p !== 'c' && !p.startsWith('c='))
  if (c) rest.push(`c=${c}`)
  return rest.length > 0 ? `?${rest.join('&')}` : ''
}

/**
 * The link to share: `href` with the settings in `c`. A configuration of defaults is written as `c=default`, so
 * the recipient gets those defaults instead of whatever they saved themselves.
 */
export function shareUrl(href: string, c: string): string {
  const url = new URL(href)
  return `${url.origin}${url.pathname}${withConfig(url.search, c || 'default')}${url.hash}`
}

/** Whether the app can read the localsOpinion weight (the flag decides). */
export function allowLocals(weights: CompositeWeights): CompositeWeights {
  return features.localsOpinion ? weights : { ...weights, localsOpinion: 0 }
}
