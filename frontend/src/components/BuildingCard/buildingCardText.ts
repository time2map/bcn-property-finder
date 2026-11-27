import i18n from '../../i18n'
import { formatNumber, lazyLabels } from '../../i18n/format'
import { ALMOST_FITS_PCT, priceOverPct } from '../../services/buildings/conditions'

// Plain-language texts of the building card (TODO-046, "Card texts"). The wording is in the language files (card).

const USE_KEYS = ['1_residential', '2_agriculture', '3_industrial', '4_1_office', '4_2_retail', '4_3_publicServices'] as const
export const USE_LABEL: Record<string, string> = lazyLabels('card:use', USE_KEYS)

const int = (n: number) => formatNumber(n, { maximumFractionDigits: 0 })

/** ACA river flood zone the building touches (036). */
export function riverText(zone: number | undefined): string {
  if (zone === 10) return i18n.t('card:river.r10')
  if (zone === 100) return i18n.t('card:river.r100')
  if (zone === 500) return i18n.t('card:river.r500')
  return i18n.t('card:river.none')
}

/** Depth as shown: the model's deep spots next to sunken roads read as ≥ 50 cm. */
export function depthText(cm: number): string {
  return cm >= 50 ? i18n.t('card:depth.max') : i18n.t('card:depth.cm', { value: Math.round(cm) })
}

/** What a water depth at the door means. */
export function depthMeaning(cm: number): string {
  if (cm < 10) return i18n.t('card:depth.gutter')
  if (cm < 30) return i18n.t('card:depth.kerb')
  if (cm < 50) return i18n.t('card:depth.ground')
  return i18n.t('card:depth.serious')
}

/** Street flooding at the building's door in heavy rain (RESCCUE, Barcelona only). */
export function doorWaterText(t10: number | undefined, t100: number | undefined): string {
  if (t10 === undefined && t100 === undefined) return i18n.t('card:door.noModel')
  const [a, b] = [t10 ?? 0, t100 ?? 0]
  if (a < 1 && b < 1) return i18n.t('card:door.none')
  return i18n.t('card:door.water', { t10: depthText(a), t100: depthText(b), meaning: depthMeaning(Math.max(a, b)) })
}

/** Ground floors, basements and garages are what floods; the card says so when water or a river zone is there. */
export function groundFloorWarning(
  t10: number | undefined, t100: number | undefined, riverZone: number | undefined, floorsBelow: number | undefined,
): string | null {
  if (Math.max(t10 ?? 0, t100 ?? 0) < 10 && riverZone === undefined) return null
  const below = floorsBelow ? i18n.t('card:warning.below', { count: floorsBelow }) : ''
  return `${i18n.t('card:warning.base')}${below}`
}

/** "Street side 72 dB · night 64" */
export function sideText(side: 'street' | 'inner', lden: number | undefined, ln: number | undefined): string | null {
  if (lden === undefined) return null
  const night = ln !== undefined ? i18n.t('card:side.night', { ln: Math.round(ln) }) : ''
  return `${i18n.t('card:side.line', { side: i18n.t(`card:side.${side}`), db: Math.round(lden) })}${night}`
}

/**
 * The courtyard level when the building has a quiet side (TODO-073): a courtyard side at or under the noise limit
 * while the street side, which the score uses, is over it. Shown in the card; it does not change the score.
 */
export function quietSide(
  d: { lden_street?: number; lden_inner?: number }, limit: number,
): number | null {
  if (d.lden_street === undefined || d.lden_inner === undefined) return null
  return Math.round(d.lden_street) > limit && Math.round(d.lden_inner) <= limit ? d.lden_inner : null
}

// ── The building against the user's conditions (049) ────────────────────────────────────────────────────────

const eur = (n: number) => `€${int(n)}`

/** "62 dB — within your 65 dB" / "72 dB — 7 dB over your 65 dB" */
export function noiseVsLimit(lden: number, limit: number): string {
  const db = Math.round(lden)
  return db <= limit
    ? i18n.t('card:vs.noiseWithin', { db, limit })
    : i18n.t('card:vs.noiseOver', { db, diff: db - limit, limit })
}

/** "€4,700/m² — 18% over your €4,000/m²" */
export function priceVsBudget(eurM2: number, budget: number): string {
  const pct = priceOverPct(eurM2, budget)
  if (pct === 0) return i18n.t('card:vs.priceWithin', { price: eur(eurM2), budget: eur(budget) })
  if (pct <= ALMOST_FITS_PCT) return i18n.t('card:vs.priceAlmost', { price: eur(eurM2), budget: eur(budget) })
  return i18n.t('card:vs.priceOver', { price: eur(eurM2), pct, budget: eur(budget) })
}

/** "7 of 10 services within 10 min"; null minutes = out of reach. */
export function countWithin(minutes: readonly (number | null)[], limit: number, noun: 'services' | 'places'): string {
  const n = minutes.filter((m) => m !== null && m <= limit).length
  return i18n.t(`card:vs.${noun}`, { n, count: minutes.length, limit })
}

/** "Residents rate 7.6 — meets your 7.5" */
export function ratingVsMin(rating: number, min: number): string {
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  return i18n.t(rating >= min ? 'card:vs.ratingMeets' : 'card:vs.ratingBelow', {
    rating: formatNumber(rating, one), min: formatNumber(min, one),
  })
}
