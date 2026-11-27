import { features } from '../features'
import i18n from '../i18n'
import { formatNumber, lazyLabels } from '../i18n/format'
import { ALL_AGE_ERA_IDS } from './buildings/buildingAge'
import { DEFAULT_CONDITIONS, type Conditions } from './buildings/conditions'
import { DEFAULT_LANDMARK_IDS, DEFAULT_WALK_CATEGORY_IDS } from './buildings/firstVisit'
import type { BuildingData } from './buildings/buildingData'
import { buildingArea } from './buildings/buildingScore'
import { homeWeight } from './buildings/buildingRank'
import type { RiskStrengths } from './climateRisk/climateRisk'
import type { CompositeWeights } from '../store'

// Verbal steps for the sentence editor (TODO-031): the words a person taps, and the limits behind them. The
// steps come from ENV (VITE_QUIZ_*); "Custom…" in the picker covers everything between them.

/** The conditions a person can switch on: the six scored ones plus the flood / wildfire line. */
export type ConditionKey = keyof CompositeWeights | 'risk'

/** Default order of the rows (the order the card lists them in, risks last). */
export const CONDITION_KEYS: readonly ConditionKey[] = [
  'noise', 'poiAccess', 'cityCore', 'openPrice', 'localsOpinion', 'age', 'risk',
]

/** Short name for the "Your conditions" row. */
export const SHORT_LABEL = lazyLabels('conditions:short', CONDITION_KEYS)

/** Label of the "+ add" chip. */
export const ADD_LABEL = lazyLabels('conditions:add', CONDITION_KEYS)

export interface WordOption {
  value: number
  label: string
  hint?: string
}

/** "50, 58,65" → [50, 58, 65]; anything unusable gives the fallback. */
export function parseNumberList(raw: string | undefined, fallback: readonly number[]): number[] {
  const parts = (raw ?? '').split(',').map((p) => p.trim())
  const nums = parts.map(Number)
  return parts.length > 0 && parts.every((p) => p !== '') && nums.every(Number.isFinite) ? nums : [...fallback]
}

/** 3500 → "3,500" (in the page language: "3.500" in Spanish and Catalan). */
function group(n: number): string {
  return formatNumber(Math.round(n), { maximumFractionDigits: 0 })
}

export function formatEuroM2(v: number): string {
  return `€${group(v)}/m²`
}

/** Text of a word whose value is one of the known steps; undefined for any other value. */
function named(ns: 'noiseName' | 'localsName', v: number): string | undefined {
  const key = `conditions:${ns}.${String(v).replace('.', '_')}`
  return i18n.exists(key) ? i18n.t(key as never) : undefined
}
const unit = (name: 'min' | 'db' | 'm2', value: number) => i18n.t(`conditions:unit.${name}`, { value })

/** A step of a picker: its texts are read when asked for, so they follow the language. */
function step(value: number, label: () => string, hint?: () => string | undefined): WordOption {
  return {
    value,
    get label() { return label() },
    get hint() { return hint?.() },
  }
}

export const NOISE_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_NOISE_OPTIONS, [50, 58, 65])
  .map((v) => step(v, () => named('noiseName', v) ?? unit('db', v), () => unit('db', v)))
export const WALK_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_WALK_OPTIONS, [5, 10, 15])
  .map((v) => step(v, () => unit('min', v)))
export const CENTRE_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_CENTRE_OPTIONS, [25, 30, 45])
  .map((v) => step(v, () => unit('min', v)))

// ---- budget: "A [70 m²] flat costs up to [€250,000] on average" ----
// The data is the average sale price per m² of the area, so a budget for a flat of a given size is a price per
// m²: budget ÷ size. The condition still stores the price per m² (`priceMaxEurM2`); the size is a preference.

export function formatEuro(v: number): string {
  return `€${group(v)}`
}

/** Size of the flat the budget is for, until the person picks another. */
export const DEFAULT_FLAT_AREA_M2 = Number(import.meta.env.VITE_FLAT_AREA_M2 ?? 70)
export const FLAT_AREA_RANGE = { min: 25, max: 250, step: 5 }
export const BUDGET_RANGE = { min: 50_000, max: 1_500_000, step: 10_000 }

export const FLAT_AREA_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_FLAT_AREA_OPTIONS, [50, 70, 90, 120])
  .map((v) => step(v, () => unit('m2', v)))
export const BUDGET_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_BUDGET_OPTIONS, [150_000, 250_000, 350_000, 500_000])
  .map((v) => step(v, () => formatEuro(v)))

/** Price per m² that a budget for a flat of `areaM2` stands for (kept to cents). */
export function priceForBudget(budgetEur: number, areaM2: number): number {
  return Math.round((budgetEur / areaM2) * 100) / 100
}

/** The budget shown for a price per m² and a flat size, to the nearest €1,000. */
export function budgetFor(pricePerM2: number, areaM2: number): number {
  return Math.round((pricePerM2 * areaM2) / 1000) * 1000
}

/** A new flat size keeps the budget (the money a person has), so the price per m² moves. */
export function priceAfterAreaChange(pricePerM2: number, oldAreaM2: number, newAreaM2: number): number {
  return Math.round(((pricePerM2 * oldAreaM2) / newAreaM2) * 100) / 100
}
export const LOCALS_OPTIONS: WordOption[] = parseNumberList(import.meta.env.VITE_QUIZ_LOCALS_OPTIONS, [7, 7.5, 8])
  .map((v) => step(v, () => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), () => named('localsName', v)))

/** The option with exactly this value; null = a custom value between the steps. */
export function optionFor(options: readonly WordOption[], value: number): WordOption | null {
  return options.find((o) => o.value === value) ?? null
}

// ---- risks: one line, "Avoid / Strongly avoid" instead of three sliders ----

export type RiskLevel = 'avoid' | 'strong' | 'off' | 'custom'

const RISK_AVOID = Number(import.meta.env.VITE_RISK_PRESET_AVOID ?? 5)
const RISK_STRONG = Number(import.meta.env.VITE_RISK_PRESET_STRONG ?? 8)

export function strengthsFor(level: 'avoid' | 'strong' | 'off'): RiskStrengths {
  const n = level === 'avoid' ? RISK_AVOID : level === 'strong' ? RISK_STRONG : 0
  return { flood: n, fire: n, street: n }
}

export function riskLevel(s: RiskStrengths): RiskLevel {
  const all = (n: number) => s.flood === n && s.fire === n && s.street === n
  if (all(0)) return 'off'
  if (all(RISK_AVOID)) return 'avoid'
  if (all(RISK_STRONG)) return 'strong'
  return 'custom'
}

// ---- which rows are on, and in what order ----

function isOn(key: ConditionKey, weights: CompositeWeights, strengths: RiskStrengths): boolean {
  if (key === 'risk') return riskLevel(strengths) !== 'off'
  if (key === 'localsOpinion' && !features.localsOpinion) return false
  return weights[key] > 0
}

/** The conditions that are on: first in the order the person added them, then the rest in the default order. */
export function activeConditions(
  weights: CompositeWeights,
  strengths: RiskStrengths,
  order: readonly ConditionKey[],
): ConditionKey[] {
  const first = [...new Set(order)].filter((k) => isOn(k, weights, strengths))
  return [...first, ...CONDITION_KEYS.filter((k) => !first.includes(k) && isOn(k, weights, strengths))]
}

// ---- profiles and one-shot settings ----

/** Everything the sentence editor can set, applied in one store update. */
export interface SettingsPatch {
  weights?: CompositeWeights
  conditions?: Conditions
  walkCategories?: readonly string[]
  landmarkIds?: readonly string[]
  eras?: readonly string[]
  riskStrengths?: RiskStrengths
  order?: ConditionKey[]
}

export interface Profile {
  id: string
  /** Only from an ENV override; otherwise the name and blurb come from the language files (`profileName()`). */
  name?: string
  blurb?: string
  /** Rows, in priority order. */
  order: ConditionKey[]
  /** Limits that differ from the defaults. */
  conditions?: Partial<Conditions>
  walkCategories?: string[]
  landmarkIds?: string[]
  eras?: string[]
  /** How hard to avoid risks; only used when `order` has 'risk'. */
  risk?: 'avoid' | 'strong'
}

const SCORED: (keyof CompositeWeights)[] = ['poiAccess', 'noise', 'cityCore', 'openPrice', 'localsOpinion', 'age']

/** The full settings a profile stands for: conditions not in `order` are off. */
export function profileToPatch(p: Profile): SettingsPatch {
  const order = p.order.filter((k) => k !== 'localsOpinion' || features.localsOpinion)
  const weights = Object.fromEntries(SCORED.map((k) => [k, order.includes(k) ? 1 : 0])) as unknown as CompositeWeights
  return {
    weights,
    conditions: { ...DEFAULT_CONDITIONS, ...p.conditions },
    walkCategories: p.walkCategories ?? DEFAULT_WALK_CATEGORY_IDS,
    landmarkIds: p.landmarkIds ?? DEFAULT_LANDMARK_IDS,
    eras: p.eras ?? ALL_AGE_ERA_IDS,
    riskStrengths: strengthsFor(order.includes('risk') ? p.risk ?? 'avoid' : 'off'),
    order,
  }
}

// ---- "≈ N % of homes" next to each budget step ----

/** Area prices of the buildings, ascending, with the homes counted up to each (TODO-073: shares are of homes). */
export interface PriceIndex {
  /** Area prices (€/m²) of the buildings that have one, ascending. */
  prices: Float32Array
  /** `cum[k]` = homes in the first k + 1 buildings of `prices`. */
  cum: Float64Array
}

const priceCache = new WeakMap<BuildingData, PriceIndex>()

/** The price index of the buildings that have an area price. Cached per data set. */
export function sortedPrices(data: BuildingData): PriceIndex {
  const cached = priceCache.get(data)
  if (cached) return cached
  const rows: { price: number; homes: number }[] = []
  for (let i = 0; i < data.count; i++) {
    const price = buildingArea(data, i)?.price
    if (price !== null && price !== undefined) rows.push({ price, homes: homeWeight(data.cols.dwellings, i) })
  }
  rows.sort((a, b) => a.price - b.price)
  const prices = Float32Array.from(rows, (r) => r.price)
  const cum = new Float64Array(rows.length)
  let total = 0
  rows.forEach((r, k) => { total += r.homes; cum[k] = total })
  const index = { prices, cum }
  priceCache.set(data, index)
  return index
}

/** Percent (0–100) of the homes whose area price is at or below `limit`. */
export function shareUnder({ prices, cum }: PriceIndex, limit: number): number {
  if (prices.length === 0) return 0
  let lo = 0
  let hi = prices.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (prices[mid] <= limit) lo = mid + 1
    else hi = mid
  }
  return lo === 0 ? 0 : Math.round((100 * cum[lo - 1]) / cum[cum.length - 1])
}
