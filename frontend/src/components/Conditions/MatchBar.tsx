import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { useHomes } from '../../hooks/useHomes'
import { hasConditions } from '../../services/composite/compositeScore'
import { BAND_COLOR, BAND_ORDER, MATCH_BANDS, bandShares } from '../../services/match/matchSummary'

/** Share of homes per match band (Great / Good / Partial / Poor), from the scores the map is showing. */
export function MatchBar() {
  const { t } = useTranslation('editor')
  const scores = useStore((s) => s.buildingScores)
  const anyCondition = useStore((s) => hasConditions(s.compositeWeights, s.compositeRiskStrengths))
  // Homes, not buildings (TODO-073).
  const homes = useHomes()
  const shares = useMemo(() => (scores ? bandShares(scores, MATCH_BANDS, homes) : null), [scores, homes])
  // Nothing to judge without a condition (061): a bar of "Poor" would be a verdict on nothing. The editor above
  // already says "No conditions yet. Add one below and the map will colour in."
  if (!anyCondition || !shares) return null
  const text = BAND_ORDER.map((b, i) => t('matchBar.value', { label: t(`matchBar.${b}`), pct: Math.round(shares[i]) })).join(', ')
  return (
    <div className="match-bar">
      <div className="match-bar__caption">{t('matchBar.caption')}</div>
      <div className="match-bar__bar" role="img" aria-label={t('matchBar.aria', { text })}>
        {BAND_ORDER.map((b, i) => (
          <i key={b} style={{ width: `${shares[i]}%`, background: BAND_COLOR[b] }} />
        ))}
      </div>
      <div className="match-bar__values" aria-hidden="true">
        {BAND_ORDER.map((b, i) => (
          <span key={b}><b>{Math.round(shares[i])}%</b><em>{t(`matchBar.${b}`)}</em></span>
        ))}
      </div>
    </div>
  )
}
