import { Group, Text } from '@mantine/core'
import { CITY_CORE_RAMP } from './cityCoreRamp'

export function CityCorAccessLegend() {
  const gradient = `linear-gradient(to right, ${CITY_CORE_RAMP.map((s) => s.color).join(', ')})`
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 3, background: gradient }}
        aria-label="City Core Access colour scale"
      />
      <Group justify="space-between" gap={0} mt={2}>
        <Text size="9px" c="dimmed">Far</Text>
        <Text size="9px" c="dimmed">Close</Text>
      </Group>
    </div>
  )
}
