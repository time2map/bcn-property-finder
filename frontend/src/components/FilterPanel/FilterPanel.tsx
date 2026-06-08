import { useState } from 'react'
import { Divider, Modal, Paper, Slider, Stack, Switch, Table, Text } from '@mantine/core'
import { useStore } from '../../store'
import { ExportButton } from '../ExportButton/ExportButton'
import { NoiseLegend } from '../NoiseLayer/NoiseLegend'
import { CompositeControls } from './CompositeControls'
import { IdealistaPricesControls } from '../IdealistaPricesLayer/IdealistaPricesControls'
import { ExclusionControls } from './ExclusionControls'

const TIME_MARKS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '60m' },
  { value: 90, label: '90m' },
  { value: 120, label: '2h' },
]

function IsochroneInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Commute zone" size="md">
      <Text size="sm" fw={500} mb={4}>What the zone shows</Text>
      <Text size="sm" c="dimmed" mb="md">
        The shaded area on the map contains all locations reachable from your workplace
        within the selected travel time — by public transport. Use it to quickly see
        which neighbourhoods are within reach.
      </Text>

      <Text size="sm" fw={500} mb={4}>How the score is calculated</Text>
      <Text size="sm" c="dimmed" mb={6}>
        For each pinned property, travel time from that address to the workplace is
        computed for four modes. Each mode is scored 0–100 (100 = instant, 0 = at cap
        or beyond), then combined into a weighted travel index:
      </Text>
      <Table withTableBorder withColumnBorders fz="xs" mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Mode</Table.Th>
            <Table.Th>Weight</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>Walking</Table.Td><Table.Td>4</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Public transport</Table.Td><Table.Td>3</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Cycling</Table.Td><Table.Td>2</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Driving</Table.Td><Table.Td>1</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>

      <Text size="sm" c="dimmed" mb={6}>
        The composite <strong>Score</strong> shown in the table combines three factors.
        Higher is better.
      </Text>
      <Table withTableBorder withColumnBorders fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Factor</Table.Th>
            <Table.Th>Weight</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>Travel index</Table.Td><Table.Td>5</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Noise score</Table.Td><Table.Td>2</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>🏙️ Walkability</Table.Td><Table.Td>3</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>
      <Text size="xs" c="dimmed" mt={6}>
        Walkability (0–100) rewards how many everyday services (supermarket, pharmacy, park,
        school, kindergarten, clinic, metro, cafe, restaurant, beach) are nearby and how close —
        closer and more numerous score higher, with diminishing returns per category. Select a pin
        to see the nearest service markers on the map.
      </Text>
    </Modal>
  )
}

interface FilterPanelProps {
  isLoading?: boolean
}

export function FilterPanel({ isLoading = false }: FilterPanelProps) {
  const {
    minutes, setMinutes,
    noiseLayerVisible, setNoiseLayerVisible,
    mapAttribution,
  } = useStore()
  const [isoModalOpen, setIsoModalOpen] = useState(false)

  return (
    <Paper
      shadow="md"
      p="md"
      radius="md"
      w={260}
      style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
    >
      <IsochroneInfoModal opened={isoModalOpen} onClose={() => setIsoModalOpen(false)} />
      <Stack gap="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text fw={500} size="sm">Commute from work</Text>
            <button
              className="noise-legend__info-btn"
              onClick={() => setIsoModalOpen(true)}
              aria-label="About the commute zone"
              title="About the commute zone"
            >
              ⓘ
            </button>
          </div>

          <div style={{ paddingBottom: 20 }}>
            <Text size="xs" c="dimmed" mb={6}>Travel time by public transport: {minutes} min</Text>
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

          <ExportButton isLoading={isLoading} />

          <Divider />
          <IdealistaPricesControls />

          <Divider />
          <ExclusionControls />

          <Divider />
          <Switch
            label="Noise areas"
            size="sm"
            checked={noiseLayerVisible}
            onChange={(e) => setNoiseLayerVisible(e.currentTarget.checked)}
          />
          <NoiseLegend />

          <Divider />
          <CompositeControls />

          {mapAttribution && (
            <>
              <Divider />
              <div
                className="panel-attribution"
                // HTML attribution from trusted ICGC style URL
                dangerouslySetInnerHTML={{ __html: mapAttribution }}
              />
            </>
          )}
      </Stack>
    </Paper>
  )
}
