import { useState } from 'react'
import { Modal, SegmentedControl, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { IconInfoCircle } from '@tabler/icons-react'
import { useStore } from '../../store'
import { STREET_DEPTH_STYLES } from './StreetFloodingLayer'

function StreetFloodingInfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation('info')
  return (
    <Modal opened={opened} onClose={onClose} title={t('street.modalTitle')} size="md">
      <Text size="sm" fw={500} mb={4}>{t('street.whatTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('street.what')}
      </Text>
      <Text size="sm" fw={500} mb={4}>{t('street.whoTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('street.who')}
      </Text>
      <Text size="sm" fw={500} mb={4}>{t('street.notTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        {t('street.not')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('street.data')}
      </Text>
    </Modal>
  )
}

export function StreetFloodingLegend() {
  const { t } = useTranslation('info')
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
          <span className="noise-legend__title">{t('street.title')}</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label={t('street.about')}
            title={t('street.about')}
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
          data={[{ value: 't10', label: t('street.t10') }, { value: 't100', label: t('street.t100') }]}
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
