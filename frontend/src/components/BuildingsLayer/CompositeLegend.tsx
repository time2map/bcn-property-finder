import { Group, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { SCORE_RAMP } from './scoreRamp'
import { BAND_COLOR, BAND_LABEL, BAND_ORDER } from '../../services/match/matchSummary'

const SWATCH_BACKGROUND = {
  ...BAND_COLOR,
  poor: `linear-gradient(to right, ${BAND_COLOR.poor}, ${SCORE_RAMP[0].color})`,
}

/**
 * Colour scale of the map (TODO-050): four verbal bands on the fixed 0–100 scale; with "Boost contrast" on, the
 * gradient fitted to the visible area (TODO-032).
 */
export function CompositeLegend() {
  const { t } = useTranslation('panel')
  const boost = useStore((s) => s.contrastBoost)
  const [min, max] = useStore((s) => s.compositeColorRange)

  if (!boost) {
    return (
      <div aria-label={t('legend.bands')}>
        {BAND_ORDER.map((band) => (
          <Group key={band} gap={6} wrap="nowrap">
            <div style={{ width: 18, height: 10, borderRadius: 2, background: SWATCH_BACKGROUND[band] }} />
            <Text size="xs">{BAND_LABEL[band]}</Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed" mt={2}>{t('legend.caption')}</Text>
      </div>
    )
  }

  const gradient = `linear-gradient(to right, ${SCORE_RAMP.map((s) => s.color).join(', ')})`
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 3, background: gradient }}
        aria-label={t('legend.scale')}
      />
      <Group justify="space-between" gap={0} mt={2}>
        <Text size="9px" c="dimmed">{min}</Text>
        <Text size="9px" c="dimmed">{max}</Text>
      </Group>
      <Text size="xs" c="dimmed">{t('legend.relative')}</Text>
    </div>
  )
}
