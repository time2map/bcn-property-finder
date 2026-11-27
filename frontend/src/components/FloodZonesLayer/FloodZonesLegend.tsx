import { useState } from 'react'
import { Anchor, Modal, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { FLOOD_ZONE_STYLES } from './FloodZonesLayer'

function FloodInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation('info')
  return (
    <Modal opened={opened} onClose={onClose} title={t('flood.modalTitle')} size="md">
      <Text size="sm" fw={500} mb={4}>{t('flood.whatTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('flood.what')}
      </Text>
      <Text size="sm" fw={500} mb={4}>{t('flood.notTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('flood.not')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('flood.data')}{' '}
        <Anchor href="https://sig.gencat.cat/ows/AIGUA/wfs" target="_blank" rel="noopener noreferrer" size="xs">
          {t('flood.dataLink')}
        </Anchor>
      </Text>
    </Modal>
  )
}

export function FloodZonesLegend() {
  const { t } = useTranslation('info')
  const visible = useStore((s) => s.floodLayerVisible)
  const [modalOpen, setModalOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <FloodInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">{t('flood.title')}</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label={t('flood.about')}
            title={t('flood.about')}
          >
            <IconInfoCircle size={14} stroke={1.8} />
          </button>
        </div>
        <div className="climate-legend__rows">
          {[...FLOOD_ZONE_STYLES].reverse().map((z) => (
            <div key={z.zone} className="climate-legend__row">
              <span className="climate-legend__swatch" style={{ background: z.color }} />
              <span>{t(`flood.${z.zone}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
