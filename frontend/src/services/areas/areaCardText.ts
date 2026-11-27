import i18n from '../../i18n'
import { formatNumber } from '../../i18n/format'
import { CONDITION_LABEL, type ConditionId } from '../match/matchSummary'

// The numbers line of the area card (TODO-064). The wording is in the language files (card: area.*).

export interface AreaCardStats {
  n: number
  shareGood: number
  shareGreat: number
  mean: number
  strongest: readonly ConditionId[]
  ranked: boolean
  incomplete: boolean
}

const homes = (n: number) => formatNumber(n, { maximumFractionDigits: 0 })

/** "71% of 1,240 homes are a good match", or the plain count for an area with too few homes to rank. */
export function matchLine(r: Pick<AreaCardStats, 'n' | 'shareGood' | 'ranked'>): string {
  if (!r.ranked) return i18n.t('card:area.tooFew', { count: r.n, n: homes(r.n) })
  return i18n.t('card:area.line', { count: r.n, n: homes(r.n), pct: Math.round(r.shareGood) })
}

/** Under the big percentage: "of 1,240 homes are a good match". */
export function matchCaption(r: Pick<AreaCardStats, 'n'>): string {
  return i18n.t('card:area.caption', { count: r.n, n: homes(r.n) })
}

/** "Strongest on: quiet, daily services" or null. */
export function strongestLine(strongest: readonly ConditionId[]): string | null {
  if (strongest.length === 0) return null
  const list = strongest.map((id) => CONDITION_LABEL[id].toLocaleLowerCase(i18n.language)).join(', ')
  return i18n.t('card:area.strongest', { list })
}

/** The note under the numbers when many homes have incomplete data, else null. */
export function incompleteNote(incomplete: boolean): string | null {
  return incomplete ? i18n.t('card:area.incomplete') : null
}
