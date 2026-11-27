import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { inPlace } from './inPlace'
import type { Award, BuildingRanks } from '../../services/buildings/buildingRank'

function RankTile({ place, rank, id }: { place: string; rank: Award; id: string }) {
  const { t } = useTranslation('card')
  return (
    <div className="rank-tile" data-testid={`rank-${id}`}>
      <b>{t('rank.top', { tier: rank.tier })}</b>
      <span>{t('rank.tileOf', { place })}</span>
    </div>
  )
}

/**
 * Where this building stands out, in its barri and in the city (TODO-070), as one or two tiles: the tier ("Top 10%")
 * and where it counts ("of homes in el Raval"). A scope where it does not stand out has no tile (the card passes only the
 * scopes that earned one); with none, nothing is drawn. When the barri's tier is wider than the city's ("Top 20%" in the
 * barri, "Top 10%" in Barcelona) a note says why: the barri has a lot of good homes, so standing out in it is harder.
 */
export function RankLines({ ranks }: { ranks: BuildingRanks }) {
  const { t } = useTranslation('card')
  const count = (ranks.local ? 1 : 0) + (ranks.wide ? 1 : 0)
  if (count === 0) return null
  const crowded = ranks.local && ranks.wide && ranks.local.rank.tier > ranks.wide.rank.tier
  return (
    <>
      <div className="rank-tiles" data-testid="rank-lines" data-count={count}>
        {ranks.local && <RankTile id="local" rank={ranks.local.rank} place={inPlace(t as never, ranks.local.name)} />}
        {ranks.wide && (
          <RankTile id="wide" rank={ranks.wide.rank}
            place={ranks.wide.scope === 'barcelona' ? inPlace(t as never, 'Barcelona') : t('rank.inMetro')} />
        )}
      </div>
      {crowded && <Text size="xs" c="dimmed" data-testid="rank-crowded">{t('rank.crowded')}</Text>}
    </>
  )
}
