import { useState } from 'react'
import { Anchor, Modal, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { HAZARD_CLASS_COLORS, WUI_COLOR } from './WildfireLayer'

function WildfireInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Wildfire hazard" size="md">
      <Text size="sm" fw={500} mb={4}>Forest hazard (colours)</Text>
      <Text size="sm" c="dimmed" mb="md">
        Generalitat de Catalunya structural wildfire hazard map 2024: how easily each 100 m
        forest cell would burn and how intense a fire would be, from 1 (lowest) to 10 (highest)
        relative to all of Catalonia. Only forest and natural land is rated — built-up areas are
        transparent. It is a static map, not a daily forecast; burned areas after 2024 are not
        reflected.
      </Text>
      <Text size="sm" fw={500} mb={4}>Wildland–urban interface (dashed line)</Text>
      <Text size="sm" c="dimmed" mb="md">
        Protecció Civil zones around forests of 5 ha or more where a wildfire can reach buildings.
        Housing developments here have legal fire-prevention duties under Llei 5/2003
        (perimeter firebreaks, hydrants, plot clearing).
      </Text>
      <Text size="xs" c="dimmed">
        Data:{' '}
        <Anchor href="https://agricultura.gencat.cat/ca/serveis/cartografia-sig/" target="_blank" rel="noopener noreferrer" size="xs">
          Generalitat — forest fire base maps
        </Anchor>
        {' · '}
        <Anchor href="https://pcivil.icgc.cat/" target="_blank" rel="noopener noreferrer" size="xs">
          Protecció Civil de Catalunya
        </Anchor>
      </Text>
    </Modal>
  )
}

export function WildfireLegend() {
  const visible = useStore((s) => s.wildfireLayerVisible)
  const [modalOpen, setModalOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <WildfireInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">Wildfire hazard 2024</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label="About the wildfire hazard map"
            title="About the wildfire hazard map"
          >
            <IconInfoCircle size={14} stroke={1.8} />
          </button>
        </div>
        <div className="noise-legend__scale">
          {HAZARD_CLASS_COLORS.map((color, i) => (
            <div key={color} className="noise-legend__band">
              <div className="noise-legend__swatch" style={{ background: color }} />
              <span className="noise-legend__label">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="climate-legend__row">
          <span className="climate-legend__line" style={{ borderColor: WUI_COLOR }} />
          <span>Wildland–urban interface</span>
        </div>
      </div>
    </>
  )
}
