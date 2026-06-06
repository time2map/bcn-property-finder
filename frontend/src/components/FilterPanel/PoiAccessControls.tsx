import { Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { PoiAccessLegend } from '../PoiAccessLayer/PoiAccessLegend'

export function PoiAccessControls() {
  const visible = useStore((s) => s.poiAccessVisible)
  const setVisible = useStore((s) => s.setPoiAccessVisible)

  return (
    <Stack gap={8}>
      <Switch
        label="POI Access"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={6} pl={28}>
          <PoiAccessLegend />
        </Stack>
      )}
    </Stack>
  )
}
