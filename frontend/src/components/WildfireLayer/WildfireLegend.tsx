import { useState } from 'react'
import { Anchor, Modal, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { HAZARD_CLASS_COLORS, WUI_COLOR } from './WildfireLayer'

function WildfireInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation('info')
  return (
    <Modal opened={opened} onClose={onClose} title={t('wildfire.modalTitle')} size="md">
      <Text size="sm" fw={500} mb={4}>{t('wildfire.forestTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('wildfire.forest')}
      </Text>
      <Text size="sm" fw={500} mb={4}>{t('wildfire.wuiTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('wildfire.wui')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('wildfire.data')}{' '}
        <Anchor href="https://agricultura.gencat.cat/ca/serveis/cartografia-sig/" target="_blank" rel="noopener noreferrer" size="xs">
          {t('wildfire.dataGen')}
        </Anchor>
        {' · '}
        <Anchor href="https://pcivil.icgc.cat/" target="_blank" rel="noopener noreferrer" size="xs">
          {t('wildfire.dataPc')}
        </Anchor>
      </Text>
    </Modal>
  )
}

export function WildfireLegend() {
  const { t } = useTranslation('info')
  const visible = useStore((s) => s.wildfireLayerVisible)
  const [modalOpen, setModalOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <WildfireInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">{t('wildfire.title')}</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label={t('wildfire.about')}
            title={t('wildfire.about')}
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
          <span>{t('wildfire.wuiLegend')}</span>
        </div>
      </div>
    </>
  )
}
