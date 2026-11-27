import { Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { features } from '../../features'
import { useStore, mapLayerOf, type MapLayerId } from '../../store'
import { NoiseLegend } from '../NoiseLayer/NoiseLegend'
import { FloodZonesLegend } from '../FloodZonesLayer/FloodZonesLegend'
import { StreetFloodingLegend } from '../StreetFloodingLayer/StreetFloodingLegend'
import { WildfireLegend } from '../WildfireLayer/WildfireLegend'

const LAYER_IDS: MapLayerId[] = (['none', 'noise', 'river', 'street', 'wildfire'] as MapLayerId[])
  .filter((id) => !(features.commercialUse && id === 'street')) // no licence for the RESCCUE data (TODO-066)

/** The expert layers under one control: one at a time, with the legend of the chosen one (TODO-052). */
export function MapLayersControl() {
  const { t } = useTranslation('panel')
  const layer = useStore(mapLayerOf)
  const setMapLayer = useStore((s) => s.setMapLayer)
  return (
    <Stack gap={8}>
      <Text size="xs" c="dimmed" fw={600} style={{ fontSize: 13, color: 'var(--ink)' }}>{t('layers.title')}</Text>
      <div className="layer-chips" role="radiogroup" aria-label={t('layers.title')}>
        {LAYER_IDS.map((id) => (
          <label key={id} className="layer-chip" data-selected={layer === id}>
            <input
              type="radio" name="map-layer" className="visually-hidden" value={id}
              checked={layer === id} onChange={() => setMapLayer(id)}
            />
            {t(`layers.${id}`)}
          </label>
        ))}
      </div>
      {layer === 'none' && <Text size="xs" c="dimmed">{t('layers.hint')}</Text>}
      {layer === 'noise' && <NoiseLegend />}
      {layer === 'river' && <FloodZonesLegend />}
      {layer === 'street' && <StreetFloodingLegend />}
      {layer === 'wildfire' && <WildfireLegend />}
    </Stack>
  )
}
