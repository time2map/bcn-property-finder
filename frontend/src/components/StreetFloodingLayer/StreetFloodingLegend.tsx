import { useState } from 'react'
import { Modal, SegmentedControl, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { STREET_DEPTH_STYLES } from './StreetFloodingLayer'

function StreetFloodingInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Street flooding in heavy rain" size="md">
      <Text size="sm" fw={500} mb={4}>What the map shows</Text>
      <Text size="sm" c="dimmed" mb="md">
        Modelled water depth on streets when a heavy downpour overwhelms the sewer network — a
        10-year rain (10% chance in any year) or a 100-year rain (1%). From the RESCCUE 1D/2D model of
        Barcelona's drainage, current climate. Water below 10 cm stays in the gutter and is not shown.
      </Text>
      <Text size="sm" fw={500} mb={4}>Who it matters for</Text>
      <Text size="sm" c="dimmed" mb="md">
        Matters most for ground-floor flats, basements and underground parking — water gets in over door
        steps and down ramps. For flats higher up it mostly means the street is impassable for a while.
      </Text>
      <Text size="sm" fw={500} mb={4}>Not the same as river flood zones</Text>
      <Text size="sm" c="dimmed" mb="md">
        River flood zones (blue) show where a river overflows, by probability, without depth. This layer
        shows rain water on streets, by depth. Barcelona only; the model dates from ~2020 and does not
        include storm tanks built since.
      </Text>
      <Text size="xs" c="dimmed">
        Data: RESCCUE project (BCASA / Aquatec) · Atles de resiliència, Ajuntament de Barcelona.
        No explicit open-data license.
      </Text>
    </Modal>
  )
}

export function StreetFloodingLegend() {
  const visible = useStore((s) => s.streetFloodingLayerVisible)
  const rp = useStore((s) => s.streetFloodingReturnPeriod)
  const setRp = useStore((s) => s.setStreetFloodingReturnPeriod)
  const [modalOpen, setModalOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <StreetFloodingInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">Street flooding · water depth (RESCCUE)</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label="About street flooding"
            title="About street flooding"
          >
            <IconInfoCircle size={14} stroke={1.8} />
          </button>
        </div>
        <SegmentedControl
          size="xs"
          fullWidth
          mb={6}
          value={rp}
          onChange={(v) => setRp(v as 't10' | 't100')}
          data={[{ value: 't10', label: '10-year rain' }, { value: 't100', label: '100-year rain' }]}
        />
        <div className="climate-legend__rows">
          {STREET_DEPTH_STYLES.map((s) => (
            <div key={s.cls} className="climate-legend__row">
              <span className="climate-legend__swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
