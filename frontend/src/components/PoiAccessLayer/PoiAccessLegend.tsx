import { Group, Text } from '@mantine/core'
import { SCORE_RAMP } from '../CompositeLayer/scoreRamp'

export function PoiAccessLegend() {
  const gradient = `linear-gradient(to right, ${SCORE_RAMP.map((s) => s.color).join(', ')})`
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 3, background: gradient }}
        aria-label="POI Access colour scale"
      />
      <Group justify="space-between" gap={0} mt={2}>
        <Text size="9px" c="dimmed">Low</Text>
        <Text size="9px" c="dimmed">High</Text>
      </Group>
    </div>
  )
}
