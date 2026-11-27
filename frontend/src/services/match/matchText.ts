import i18n from '../../i18n'
import { formatNumber } from '../../i18n/format'
import { ALMOST_FITS_PCT, priceOverPct } from '../buildings/conditions'

// Short texts of the match header rows (TODO-050). Compact on purpose: the full sentences stay in the
// per-condition blocks of the card (buildingCardText.ts). The wording is in the language files (conditions: match.*).

const eur = (n: number) => `€${formatNumber(n, { maximumFractionDigits: 0 })}`

/** "57 dB, under your 65" / "72 dB, 7 dB over your 65" */
export function noiseText(lden: number, limit: number): string {
  const db = Math.round(lden)
  return db <= limit
    ? i18n.t('conditions:match.noiseUnder', { db, limit })
    : i18n.t('conditions:match.noiseOver', { db, diff: db - limit, limit })
}

/** "7 of 10 within 10 min" */
export function poiText(within: number, total: number, limit: number): string {
  return i18n.t('conditions:match.poi', { within, total, limit })
}

/** "12 of 13 places within 30 min" */
export function cityCoreText(within: number, total: number, limit: number): string {
  return i18n.t('conditions:match.cityCore', { within, count: total, limit })
}

/** "€3,325/m², under your €4,000" / "€4,600/m², 15% over your €4,000" */
export function priceText(eurM2: number, budget: number): string {
  const pct = priceOverPct(eurM2, budget)
  if (pct === 0) return i18n.t('conditions:match.priceUnder', { price: eur(eurM2), budget: eur(budget) })
  if (pct <= ALMOST_FITS_PCT) return i18n.t('conditions:match.priceAlmost', { price: eur(eurM2), budget: eur(budget) })
  return i18n.t('conditions:match.priceOver', { price: eur(eurM2), pct, budget: eur(budget) })
}

/** "rated 7.6, your minimum 7.5" */
export function localsText(rating: number, min: number): string {
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  return i18n.t('conditions:match.locals', { rating: formatNumber(rating, one), min: formatNumber(min, one) })
}

/** The era of the building, or that its year is unknown. */
export function ageText(era: string | null): string {
  return era ?? i18n.t('conditions:match.ageUnknown')
}

// The same facts split for the rows of the card (072): the value, and what it is compared with in a dimmer tone.
export interface MatchParts { value: string; limit?: string }

export function noiseParts(lden: number, limit: number): MatchParts {
  return { value: i18n.t('conditions:unit.db', { value: Math.round(lden) }), limit: ` / ${limit}` }
}

export function poiParts(within: number, total: number, limit: number): MatchParts {
  return { value: i18n.t('conditions:match.of', { within, total }), limit: ` ${i18n.t('conditions:match.inMin', { limit })}` }
}

export function cityCoreParts(within: number, total: number, limit: number): MatchParts {
  return poiParts(within, total, limit)
}

export function priceParts(eurM2: number, budget: number): MatchParts {
  const pct = priceOverPct(eurM2, budget)
  const over = pct === 0 ? '' : pct <= ALMOST_FITS_PCT ? ` · ${i18n.t('conditions:match.almostFits')}` : ` · +${pct}%`
  return { value: eur(eurM2), limit: ` / ${i18n.t('conditions:match.perM2', { budget: eur(budget) })}${over}` }
}

export function localsParts(rating: number, min: number): MatchParts {
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  return { value: formatNumber(rating, one), limit: ` / ${formatNumber(min, one)}` }
}

export function ageParts(era: string | null): MatchParts {
  return { value: ageText(era) }
}
