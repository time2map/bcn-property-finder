import { Divider, Paper, SegmentedControl, Slider, Stack, Text } from '@mantine/core'
import { useStore } from '../../store'
import type { TransportMode } from '../../store'
import { ExportButton } from '../ExportButton/ExportButton'

const MODES: { value: TransportMode; label: string }[] = [
  { value: 'foot', label: 'Walking' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'driving', label: 'Driving' },
  { value: 'public_transport', label: 'Public transport' },
]

const MODE_DESCRIPTIONS: Record<TransportMode, string> = {
  foot: 'Walking at average pace (~5 km/h). Via OpenRouteService.',
  cycling: 'Regular cycling (~15 km/h). Via OpenRouteService.',
  driving: 'Car, typical road speeds. Via OpenRouteService.',
  public_transport:
    'Walk to nearest stop + optimal route (transfers allowed if they save time). Scheduled timetables, typical Mon 09:00.',
}

const TIME_MARKS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '60m' },
  { value: 90, label: '90m' },
  { value: 120, label: '2h' },
]

interface FilterPanelProps {
  isLoading?: boolean
}

export function FilterPanel({ isLoading = false }: FilterPanelProps) {
  const { mode, minutes, setMode, setMinutes } = useStore()

  return (
    <Paper shadow="md" p="md" radius="md" w={260}>
      <Stack gap="md">
        <Text fw={500} size="sm">Commute from work</Text>

        <div>
          <Text size="xs" c="dimmed" mb={6}>How you get there</Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as TransportMode)}
            data={MODES}
          />
          <Text size="xs" c="dimmed" mt={6}>{MODE_DESCRIPTIONS[mode]}</Text>
        </div>

        <div style={{ paddingBottom: 20 }}>
          <Text size="xs" c="dimmed" mb={6}>Travel time: {minutes} min</Text>
          <Slider
            min={15}
            max={120}
            step={5}
            value={minutes}
            onChange={setMinutes}
            marks={TIME_MARKS}
            style={{ '--slider-color': '#F06965' } as React.CSSProperties}
            styles={{ markLabel: { fontSize: 10, marginTop: 6 } }}
          />
        </div>

        <Divider />
        <Text size="xs" c="dimmed">
          The highlighted zone shows areas within commute reach — good candidates for buying or renting.
        </Text>
        <ExportButton isLoading={isLoading} />
      </Stack>
    </Paper>
  )
}
