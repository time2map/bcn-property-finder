import { Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { FloodZonesLegend } from '../FloodZonesLayer/FloodZonesLegend'
import { WildfireLegend } from '../WildfireLayer/WildfireLegend'

/** View toggles for the climate-risk source layers — feature 036. */
export function ClimateLayerControls() {
  const floodVisible = useStore((s) => s.floodLayerVisible)
  const setFloodVisible = useStore((s) => s.setFloodLayerVisible)
  const wildfireVisible = useStore((s) => s.wildfireLayerVisible)
  const setWildfireVisible = useStore((s) => s.setWildfireLayerVisible)

  return (
    <Stack gap="md">
      <Switch
        label="Flood zones"
        size="sm"
        checked={floodVisible}
        onChange={(e) => setFloodVisible(e.currentTarget.checked)}
      />
      <FloodZonesLegend />
      <Switch
        label="Wildfire hazard"
        size="sm"
        checked={wildfireVisible}
        onChange={(e) => setWildfireVisible(e.currentTarget.checked)}
      />
      <WildfireLegend />
    </Stack>
  )
}
