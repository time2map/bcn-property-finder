import { useState } from 'react'
import { Anchor, Modal, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { FLOOD_ZONE_STYLES } from './FloodZonesLayer'

function FloodInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="River flood zones" size="md">
      <Text size="sm" fw={500} mb={4}>What the map shows</Text>
      <Text size="sm" c="dimmed" mb="md">
        Areas the Catalan Water Agency (ACA) expects to be flooded when a river or stream
        overflows, for three return periods. A 10-year flood has a 10% chance of happening in any
        given year (≈ 96% over 30 years); a 100-year flood 1% (≈ 26% over 30 years); a 500-year
        flood 0.2% (≈ 6% over 30 years). The 500-year zone is the official floodable zone in
        Spanish planning law.
      </Text>
      <Text size="sm" fw={500} mb={4}>What it does not show</Text>
      <Text size="sm" c="dimmed" mb="md">
        Only river flooding. Flash flooding of streets when the sewer system overflows during
        heavy rain is not included, nor coastal flooding.
      </Text>
      <Text size="xs" c="dimmed">
        Data:{' '}
        <Anchor href="https://sig.gencat.cat/ows/AIGUA/wfs" target="_blank" rel="noopener noreferrer" size="xs">
          ACA — Agència Catalana de l'Aigua, flood zones (WFS)
        </Anchor>
      </Text>
    </Modal>
  )
}

export function FloodZonesLegend() {
  const visible = useStore((s) => s.floodLayerVisible)
  const [modalOpen, setModalOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <FloodInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">River flood zones · ACA</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label="About the flood zones"
            title="About the flood zones"
          >
            <IconInfoCircle size={14} stroke={1.8} />
          </button>
        </div>
        <div className="climate-legend__rows">
          {[...FLOOD_ZONE_STYLES].reverse().map((z) => (
            <div key={z.zone} className="climate-legend__row">
              <span className="climate-legend__swatch" style={{ background: z.color }} />
              <span>{z.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
