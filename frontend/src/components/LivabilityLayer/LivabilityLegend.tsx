import { Group, Text } from '@mantine/core'
import { LIVABILITY_RAMP } from './livabilityRamp'

/** Compact colour ramp legend for the livability choropleth (low → high). */
export function LivabilityLegend() {
  const gradient = `linear-gradient(to right, ${LIVABILITY_RAMP.map((s) => s.color).join(', ')})`
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 3, background: gradient }}
        aria-label="Livability colour scale"
      />
      <Group justify="space-between" gap={0} mt={2}>
        <Text size="9px" c="dimmed">Low</Text>
        <Text size="9px" c="dimmed">High</Text>
      </Group>
    </div>
  )
}
