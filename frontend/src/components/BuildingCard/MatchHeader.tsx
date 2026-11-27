import { Text } from '@mantine/core'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { BAND_LABEL, BAND_LABEL_POSSIBLY, matchBand, type MatchSummary } from '../../services/match/matchSummary'
import type { BuildingRanks } from '../../services/buildings/buildingRank'
import { RankLines } from './RankLines'

interface Props {
  score: number
  summary: MatchSummary
  /** Colour of the score on the map's scale. */
  color: string
  /** Worst-case score (060). With `incomplete`, the ring shows the range `scoreMin–score`. */
  scoreMin?: number
  /** Some condition that is on has no data for this building (060). */
  incomplete?: boolean
  /** The phone sheet (TODO-062): a larger ring and larger rows. */
  compact?: boolean
  /** Where the building stands in its barri and the city (TODO-070); null = no rank tiles. */
  ranks?: BuildingRanks | null
  /** The budget ceiling lowered the score (TODO-073). */
  overBudget?: boolean
}

/**
 * Top of the building card (TODO-050, 072): the score in a ring, the band, how many conditions are met, and the rank
 * tiles (the best-in-barri / best-in-city badges). The per-condition rows live in the sections below.
 */
export function MatchHeader({
  score, summary, color, scoreMin, incomplete = false, compact = false, ranks = null, overBudget = false,
}: Props) {
  const { t } = useTranslation('card')
  const isRange = incomplete && scoreMin !== undefined && scoreMin < score
  const range = isRange ? `${scoreMin}–${score}` : String(score)
  const bandLabel = (isRange ? BAND_LABEL_POSSIBLY : BAND_LABEL)[matchBand(score)]
  const ring = { '--ring-color': color, '--ring-pct': `${score}%` } as CSSProperties
  return (
    <div className={`match-header${compact ? ' match-header--phone' : ''}`} data-testid="match-header">
      <div className="match-block" data-testid="match-block">
        <div className="match-ring" data-testid="match-ring" data-incomplete={incomplete} data-long={range.length > 3} style={ring}>
          <span>{range}</span>
        </div>
        <div className="match-block__text">
          <span className="match-block__label" data-testid="match-label">{t('match.label')}</span>
          <span className="match-block__band" data-testid="match-band">{bandLabel}</span>
          {summary.total === 0 && <span className="match-block__meets">{t('match.noneOn')}</span>}
        </div>
      </div>
      {overBudget && (
        <Text size="xs" data-testid="over-budget">{t('match.overBudget')}</Text>
      )}
      {incomplete && (
        <Text size="xs" c="dimmed" data-testid="incomplete-note">
          {t('match.incomplete')}
        </Text>
      )}
      {ranks && <RankLines ranks={ranks} />}
      {incomplete && !ranks && (
        <Text size="xs" c="dimmed" data-testid="rank-incomplete">{t('rank.incomplete')}</Text>
      )}
    </div>
  )
}
