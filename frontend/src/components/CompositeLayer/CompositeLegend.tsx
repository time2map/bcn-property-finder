import { Group, Text } from '@mantine/core'
import { SCORE_RAMP } from './scoreRamp'

interface CompositeLegendProps {
  scoreRange?: [number, number]
}

export function CompositeLegend({ scoreRange = [0, 100] }: CompositeLegendProps) {
  const [min, max] = scoreRange
  const gradient = `linear-gradient(to right, ${SCORE_RAMP.map((s) => s.color).join(', ')})`
  return (
    <div>
      <div
        style={{ height: 10, borderRadius: 3, background: gradient }}
        aria-label="Composite score colour scale"
      />
      <Group justify="space-between" gap={0} mt={2}>
        <Text size="9px" c="dimmed">{min}</Text>
        <Text size="9px" c="dimmed">{max}</Text>
      </Group>
    </div>
  )
}
