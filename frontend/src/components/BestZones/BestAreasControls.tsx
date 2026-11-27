import { useTranslation } from 'react-i18next'
import { ActionIcon, Button, Checkbox, Group, Popover, Stack, Text } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import { useStore } from '../../store'
import { useMapStore } from '../../store/mapStore'
import { TOP_PCT_STEPS, stepIndex } from '../../services/bestZonesConfig'
import { visibleBounds } from '../Map/visibleBounds'
import { BaseUrlInput } from './BaseUrlInput'
import { features } from '../../features'

/**
 * Best areas, inside the filter panel (TODO-052): one button to draw the best zones for what is in view, then
 * More / Fewer areas instead of a "top X %" slider. The zones themselves are drawn by BestZones on the map.
 */
export function BestAreasControls() {
  const { t } = useTranslation('panel')
  const map = useMapStore((s) => s.map)
  const visible = useStore((s) => s.compositeVisible)
  const bounds = useStore((s) => s.bestZonesBounds)
  const setBounds = useStore((s) => s.setBestZonesBounds)
  const topPct = useStore((s) => s.bestZonesTopPct)
  const setTopPct = useStore((s) => s.setBestZonesTopPct)
  const count = useStore((s) => s.bestZonesCount)
  const restrict = useStore((s) => s.bestZonesRestrict)
  const setRestrict = useStore((s) => s.setBestZonesRestrict)

  const heading = (
    <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.06em' }}>{t('best.title')}</Text>
  )
  if (!visible) {
    return (
      <Stack gap={8}>
        {heading}
        <Text size="xs" c="dimmed">{t('best.needColours')}</Text>
      </Stack>
    )
  }
  if (!bounds) {
    return (
      <Stack gap={8}>
        {heading}
        <Button fullWidth variant="default" disabled={!map} onClick={() => map && setBounds(visibleBounds(map))}>
          {t('best.show')}
        </Button>
      </Stack>
    )
  }

  const i = stepIndex(topPct)
  return (
    <Stack gap={8}>
      <Group justify="space-between" wrap="nowrap">
        {heading}
        <Popover width={300} position="bottom-end" withArrow transitionProps={{ duration: 0 }}>
          <Popover.Target>
            <ActionIcon variant="subtle" color="gray" size="md" aria-label={t('best.filters')} title={t('best.filters')}>
              <IconSettings size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs" c="dimmed" mb={6}>{t('best.filtersHint')}</Text>
            <BaseUrlInput />
          </Popover.Dropdown>
        </Popover>
      </Group>
      <Text size="sm" fw={600}>
        {count === null ? t('best.looking') : t('best.count', { count })}
      </Text>
      {count === 0 ? (
        <Text size="xs" c="dimmed">{t('best.none')}</Text>
      ) : (
        <Text size="xs" c="dimmed">{t('best.top', { pct: topPct })}</Text>
      )}
      <Group gap={8} wrap="nowrap">
        <Button variant="default" size="sm" style={{ flex: 1 }} disabled={i === TOP_PCT_STEPS.length - 1}
          onClick={() => setTopPct(TOP_PCT_STEPS[i + 1])}>
          {t('best.fewer')}
        </Button>
        <Button variant="default" size="sm" style={{ flex: 1 }} disabled={i === 0}
          onClick={() => setTopPct(TOP_PCT_STEPS[i - 1])}>
          {t('best.more')}
        </Button>
        <Button variant="subtle" color="gray" size="sm" onClick={() => setBounds(null)} title="Esc">{t('best.hide')}</Button>
      </Group>
      {(features.isochrone || features.exclusions) && (
        <Checkbox
          size="xs"
          className="ink-control"
          label={t('best.restrict')}
          checked={restrict}
          onChange={(e) => setRestrict(e.currentTarget.checked)}
        />
      )}
    </Stack>
  )
}
