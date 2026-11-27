/**
 * The wishes of the "find your one building" funnel (TODO-076) as columns where a higher value is better, for the
 * buildings that take part: residential buildings of Barcelona city (a barri, not another municipality) with at
 * least the minimum number of dwellings. NaN = no data or out of walking reach. The same definitions as `criteria()`
 * in scripts/explore_one_building.py.
 */
import { buildingArea, scoredNoise } from '../buildings/buildingScore'
import type { BuildingData } from '../buildings/buildingData'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import { percentiles } from './percentile'

export const WISH_IDS = [
  'quiet', 'cheap', 'centre', 'metro', 'park', 'shops', 'schools', 'bars', 'health', 'new', 'locals',
] as const
export type WishId = (typeof WISH_IDS)[number]

/** "Close to the centre": the nearest of these City Core places. */
export const CENTRE_LANDMARKS = ['placa_cat', 'barri_gotic', 'pg_gracia'] as const

/** A wish made of several services counts the farthest of them ("shops" = supermarket and pharmacy both near). */
const SERVICES: Partial<Record<WishId, readonly string[]>> = {
  metro: ['metro'],
  park: ['park'],
  shops: ['supermarket', 'pharmacy'],
  schools: ['school', 'kindergarten'],
  bars: ['cafe', 'restaurant'],
  health: ['clinic'],
}

export interface FunnelData {
  /** Row in the building columns of each building that takes part. */
  rows: Int32Array
  /** The wishes that can be offered (no "locals" without its data). */
  wishes: WishId[]
  /** Per wish, per building that takes part: higher is better; NaN = no data / out of reach. */
  values: Partial<Record<WishId, Float64Array>>
  /** Percentile 0..1 of each value among the buildings that take part. */
  pct: Partial<Record<WishId, Float64Array>>
  /** 1 = the sea is within walking reach. */
  seaOk: Uint8Array
}

const col = (data: BuildingData, name: string, row: number): number => data.cols[name]?.[row] ?? NaN

export function buildFunnelData(data: BuildingData, vibe: BarriVibeData | null, minDwellings: number): FunnelData {
  const rowList: number[] = []
  for (let i = 0; i < data.count; i++) {
    const area = buildingArea(data, i)
    const dwellings = col(data, 'dwellings', i)
    if (area?.kind === 'barri' && dwellings >= minDwellings) rowList.push(i)
  }
  const rows = Int32Array.from(rowList)
  const n = rows.length
  const wishes = WISH_IDS.filter((w) => w !== 'locals' || vibe !== null)
  const values: Partial<Record<WishId, Float64Array>> = {}
  for (const w of wishes) values[w] = new Float64Array(n)
  const seaOk = new Uint8Array(n)

  for (let k = 0; k < n; k++) {
    const i = rows[k]
    const area = buildingArea(data, i)
    values.quiet![k] = -(scoredNoise(data, i) ?? NaN)
    values.cheap![k] = -(area?.price ?? NaN)
    const centre = CENTRE_LANDMARKS.map((id) => col(data, `cc_${id}`, i)).filter((v) => !Number.isNaN(v))
    values.centre![k] = centre.length ? -Math.min(...centre) : NaN
    for (const [wish, ids] of Object.entries(SERVICES) as [WishId, readonly string[]][]) {
      const minutes = ids.map((id) => col(data, `min_${id}`, i))
      values[wish]![k] = minutes.some(Number.isNaN) ? NaN : -Math.max(...minutes)
    }
    values.new![k] = col(data, 'year_built', i)
    if (values.locals) values.locals[k] = (area && vibe?.barris[area.code]?.satisfAdj) ?? NaN
    seaOk[k] = Number.isNaN(col(data, 'min_beach', i)) ? 0 : 1
  }

  const pct: Partial<Record<WishId, Float64Array>> = {}
  for (const w of wishes) pct[w] = percentiles(values[w]!)
  return { rows, wishes, values, pct, seaOk }
}

/** Wishes measured in walking minutes. */
export const MINUTE_WISHES: readonly WishId[] = ['centre', 'metro', 'park', 'shops', 'schools', 'bars', 'health']

/**
 * A threshold as text: years as they are (no thousands separator), "<1" for zero walking minutes (the service is in
 * the same block), other numbers with the separators of the language.
 */
export function formatValue(wish: WishId, goodness: number, locale: string): string {
  const v = displayValue(wish, goodness)
  if (wish === 'new') return String(v)
  if (v === 0 && MINUTE_WISHES.includes(wish)) return '<1'
  return v.toLocaleString(locale)
}

/** A goodness back in the unit the person reads: dB, €/m², minutes, year, or a 0–10 rating. */
export function displayValue(wish: WishId, goodness: number): number {
  if (wish === 'new') return Math.round(goodness)
  if (wish === 'locals') return Math.round(goodness * 10) / 10
  return Math.round(-goodness)
}
