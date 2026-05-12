import { Paper, SegmentedControl, Slider, Stack, Text } from '@mantine/core'
import { useStore } from '../../store'
import type { TransportMode } from '../../store'

const MODES: { value: TransportMode; label: string }[] = [
  { value: 'foot-walking', label: '🚶 Walking' },
  { value: 'cycling-regular', label: '🚲 Cycling' },
  { value: 'driving-car', label: '🚗 Driving' },
]

const TIME_MARKS = [
  { value: 15, label: '15m' },
  { value: 20, label: '20m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
]

export function FilterPanel() {
  const { mode, minutes, workplace, setMode, setMinutes } = useStore()

  return (
    <Paper shadow="md" p="md" radius="md" w={260}>
      <Stack gap="md">
        <div>
          <Text size="xs" c="dimmed" mb={6}>Transport</Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as TransportMode)}
            data={MODES}
          />
        </div>

        <div>
          <Text size="xs" c="dimmed" mb={6}>Travel time: {minutes} min</Text>
          <Slider
            min={15}
            max={45}
            step={5}
            value={minutes}
            onChange={setMinutes}
            marks={TIME_MARKS}
            disabled={!workplace}
          />
        </div>

        {!workplace && (
          <Text size="xs" c="dimmed" ta="center">
            Click on the map to set your workplace
          </Text>
        )}
      </Stack>
    </Paper>
  )
}
