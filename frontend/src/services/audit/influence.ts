import { formatList, formatNumber } from '../../i18n/format'
import { CONDITION_LABEL, type ConditionId } from '../match/matchSummary'
import influenceData from './influence.json'

/**
 * Share (percent) of the differences between Barcelona homes each condition explains with the default settings
 * (TODO-073). Written by `npm run audit:score -- --write` after a data rebuild or a change of the defaults.
 */
export const INFLUENCE = influenceData as Partial<Record<ConditionId, number>>

/** "Budget 48%, Quiet 41%, Centre 10%, and Everyday services 0%", largest first, in the page language. */
export function influenceList(influence: Partial<Record<ConditionId, number>> = INFLUENCE): string {
  return formatList(
    (Object.entries(influence) as [ConditionId, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${CONDITION_LABEL[k]} ${formatNumber(v / 100, { style: 'percent' })}`),
  )
}
