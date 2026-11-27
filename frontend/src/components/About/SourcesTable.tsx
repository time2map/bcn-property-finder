import { Anchor, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { features } from '../../features'
import { sourceDate, visibleSources, type DataSource } from '../../services/dataSources'
import { loadBuildingsMeta } from '../../services/buildings/buildingData'
import { useEffect, useState } from 'react'

/** One row per data source: publisher, dataset, licence with its link, date and what we changed (TODO-066). */
export function SourcesTable() {
  const [dates, setDates] = useState<{ generated?: string; sources?: Record<string, string> }>()
  useEffect(() => {
    loadBuildingsMeta().then((m) => setDates({ generated: m.generated, sources: m.sources })).catch(() => undefined)
  }, [])
  const rows = visibleSources({ facadePhoto: features.facadePhoto, commercialUse: features.commercialUse })
  return (
    <ul className="sources-list">
      {rows.map((s) => <SourceRow key={s.id} source={s} date={sourceDate(s, dates)} />)}
    </ul>
  )
}

function SourceRow({ source: s, date }: { source: DataSource; date?: string }) {
  const { t } = useTranslation('legal')
  return (
    <li className="sources-list__row" data-source={s.id}>
      <Text size="sm" fw={600}>
        <Anchor href={s.url} target="_blank" rel="noopener noreferrer" inherit>{s.publisher}</Anchor>
      </Text>
      <Text size="xs">{s.dataset}</Text>
      <Text size="xs" c="dimmed">
        {t('table.licence')}:{' '}
        {s.licence.url
          ? <Anchor href={s.licence.url} target="_blank" rel="noopener noreferrer" inherit>{s.licence.name}</Anchor>
          : s.licence.name}
        {date && <> · {t('table.updated')}: {date}</>}
      </Text>
      <Text size="xs" c="dimmed">{s.changed ? t(`sources.${s.id}.changed` as 'sources.osm.changed') : t('table.unchanged')}</Text>
    </li>
  )
}
