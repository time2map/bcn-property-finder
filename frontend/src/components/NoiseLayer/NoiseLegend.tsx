import { useState } from 'react'
import { Modal, Text, Table, Anchor } from '@mantine/core'
import { useStore } from '../../store'

const BANDS = [
  { label: '<40',  color: '#b3e0f2' },
  { label: '40',   color: '#79c8e0' },
  { label: '45',   color: '#a8d86e' },
  { label: '50',   color: '#d4ed6a' },
  { label: '55',   color: '#f5f500' },
  { label: '60',   color: '#f5c800' },
  { label: '65',   color: '#f57d00' },
  { label: '70',   color: '#e02020' },
  { label: '75',   color: '#d400d4' },
  { label: '≥80',  color: '#0000c8' },
]

function NoiseInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Noise map · Lden"
      size="md"
    >
      <Text size="sm" fw={500} mb={4}>What the map shows</Text>
      <Text size="sm" c="dimmed" mb="md">
        Barcelona Strategic Noise Map 2022 — <strong>total combined exposure</strong>: road traffic,
        railways, industry, and leisure/entertainment venues. All sources that contribute
        to residential noise are included.
      </Text>

      <Text size="sm" fw={500} mb={4}>What is Lden?</Text>
      <Text size="sm" c="dimmed" mb={6}>
        Lden (Level day-evening-night) is a 24-hour weighted average in dB(A) that
        penalises evening and night noise — when people are more sensitive to disturbance:
      </Text>
      <Table withTableBorder withColumnBorders fz="xs" mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Period</Table.Th>
            <Table.Th>Hours</Table.Th>
            <Table.Th>Penalty</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>Day</Table.Td><Table.Td>07:00–19:00</Table.Td><Table.Td>—</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Evening</Table.Td><Table.Td>19:00–23:00</Table.Td><Table.Td>+5 dB</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>Night</Table.Td><Table.Td>23:00–07:00</Table.Td><Table.Td>+10 dB</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>

      <Text size="sm" fw={500} mb={4}>Reference thresholds</Text>
      <Table withTableBorder withColumnBorders fz="xs" mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Level</Table.Th>
            <Table.Th>Standard</Table.Th>
            <Table.Th>Meaning</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>≤ 53 dB</Table.Td><Table.Td>WHO (2018)</Table.Td><Table.Td>Recommended limit</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 55 dB</Table.Td><Table.Td>EU Directive 2002/49</Table.Td><Table.Td>Triggers action plans</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 65 dB</Table.Td><Table.Td>EU Directive</Table.Td><Table.Td>High noise exposure</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 70 dB</Table.Td><Table.Td>EU Directive</Table.Td><Table.Td>Very high exposure</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>

      <Text size="xs" c="dimmed">
        Data:{' '}
        <Anchor
          href="https://opendata-ajuntament.barcelona.cat/data/en/dataset/isofones-mapa-estrategic-soroll"
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
        >
          Barcelona Strategic Noise Map · Open Data BCN
        </Anchor>
      </Text>
    </Modal>
  )
}

export function NoiseLegend() {
  const { noiseLayerVisible } = useStore()
  const [modalOpen, setModalOpen] = useState(false)

  if (!noiseLayerVisible) return null

  return (
    <>
      <NoiseInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">Noise · Lden dB(A)</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label="About the noise map"
            title="About the noise map"
          >
            ⓘ
          </button>
        </div>
        <div className="noise-legend__scale">
          {BANDS.map((b) => (
            <div key={b.label} className="noise-legend__band">
              <div className="noise-legend__swatch" style={{ background: b.color }} />
              <span className="noise-legend__label">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="noise-legend__source">
          Lden · Road + rail + industry + leisure · 2022
        </div>
      </div>
    </>
  )
}
