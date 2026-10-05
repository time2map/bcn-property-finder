import { Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { FloodZonesLegend } from '../FloodZonesLayer/FloodZonesLegend'
import { WildfireLegend } from '../WildfireLayer/WildfireLegend'
import { StreetFloodingLegend } from '../StreetFloodingLayer/StreetFloodingLegend'

/** View toggles for the climate-risk source layers — features 036, 037. */
export function ClimateLayerControls() {
  const floodVisible = useStore((s) => s.floodLayerVisible)
  const setFloodVisible = useStore((s) => s.setFloodLayerVisible)
  const wildfireVisible = useStore((s) => s.wildfireLayerVisible)
  const setWildfireVisible = useStore((s) => s.setWildfireLayerVisible)
  const streetVisible = useStore((s) => s.streetFloodingLayerVisible)
  const setStreetVisible = useStore((s) => s.setStreetFloodingLayerVisible)

  return (
    <Stack gap="md">
      <Switch
        label="River flood zones"
        size="sm"
        checked={floodVisible}
        onChange={(e) => setFloodVisible(e.currentTarget.checked)}
      />
      <FloodZonesLegend />
      <Switch
        label="Street flooding (heavy rain)"
        size="sm"
        checked={streetVisible}
        onChange={(e) => setStreetVisible(e.currentTarget.checked)}
      />
      <StreetFloodingLegend />
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
