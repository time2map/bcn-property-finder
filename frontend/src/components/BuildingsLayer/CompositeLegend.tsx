import { Group, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { features } from '../../features'
import { SCORE_RAMP } from './scoreRamp'
import { BAND_COLOR, BAND_LABEL, BAND_ORDER } from '../../services/match/matchSummary'

const SWATCH_BACKGROUND = {
  ...BAND_COLOR,
  poor: `linear-gradient(to right, ${BAND_COLOR.poor}, ${SCORE_RAMP[0].color})`,
}
export const RAMP_GRADIENT = `linear-gradient(to right, ${SCORE_RAMP.map((s) => s.color).join(', ')})`

/**
 * Colour scale of the map (TODO-050): four verbal bands on the fixed 0–100 scale; with an isochrone the colours are
 * stretched over the commute zone (077), so the legend is a worse → better gradient without numbers.
 */
export function CompositeLegend() {
  const { t } = useTranslation('panel')
  const stretched = useStore((s) => features.isochrone && s.resultPolygon !== null)
  if (stretched) {
    return (
      <div>
        <div style={{ height: 10, borderRadius: 3, background: RAMP_GRADIENT }} aria-label={t('legend.scale')} />
        <Group justify="space-between" gap={0} mt={2}>
          <Text size="9px" c="dimmed">{t('legend.worse')}</Text>
          <Text size="9px" c="dimmed">{t('legend.better')}</Text>
        </Group>
        <Text size="xs" c="dimmed">{t('legend.stretched')}</Text>
      </div>
    )
  }
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
