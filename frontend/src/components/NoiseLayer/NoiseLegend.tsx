import { useState } from 'react'
import { Modal, Text, Table, Anchor } from '@mantine/core'
import { Trans, useTranslation } from 'react-i18next'
import { IconInfoCircle } from '@tabler/icons-react'
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
  const { t } = useTranslation('info')
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('noise.modalTitle')}
      size="md"
    >
      <Text size="sm" fw={500} mb={4}>{t('noise.whatTitle')}</Text>
      <Text size="sm" c="dimmed" mb="md">
        <Trans i18nKey="noise.what" ns="info" components={{ b: <strong /> }} />
      </Text>

      <Text size="sm" fw={500} mb={4}>{t('noise.ldenTitle')}</Text>
      <Text size="sm" c="dimmed" mb={6}>
        {t('noise.lden')}
      </Text>
      <Table withTableBorder withColumnBorders fz="xs" mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('noise.period')}</Table.Th>
            <Table.Th>{t('noise.hours')}</Table.Th>
            <Table.Th>{t('noise.penalty')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>{t('noise.day')}</Table.Td><Table.Td>07:00–19:00</Table.Td><Table.Td>—</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>{t('noise.evening')}</Table.Td><Table.Td>19:00–23:00</Table.Td><Table.Td>+5 dB</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>{t('noise.night')}</Table.Td><Table.Td>23:00–07:00</Table.Td><Table.Td>+10 dB</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>

      <Text size="sm" fw={500} mb={4}>{t('noise.refTitle')}</Text>
      <Table withTableBorder withColumnBorders fz="xs" mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('noise.level')}</Table.Th>
            <Table.Th>{t('noise.standard')}</Table.Th>
            <Table.Th>{t('noise.meaning')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr><Table.Td>≤ 53 dB</Table.Td><Table.Td>{t('noise.who')}</Table.Td><Table.Td>{t('noise.recommended')}</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 55 dB</Table.Td><Table.Td>{t('noise.eu')}</Table.Td><Table.Td>{t('noise.triggers')}</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 65 dB</Table.Td><Table.Td>{t('noise.euShort')}</Table.Td><Table.Td>{t('noise.high')}</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>≥ 70 dB</Table.Td><Table.Td>{t('noise.euShort')}</Table.Td><Table.Td>{t('noise.veryHigh')}</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>

      <Text size="xs" c="dimmed">
        {t('noise.data')}{' '}
        <Anchor
          href="https://opendata-ajuntament.barcelona.cat/data/en/dataset/isofones-mapa-estrategic-soroll"
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
        >
          {t('noise.dataLink')}
        </Anchor>
      </Text>
    </Modal>
  )
}

export function NoiseLegend() {
  const { t } = useTranslation('info')
  const { noiseLayerVisible } = useStore()
  const [modalOpen, setModalOpen] = useState(false)

  if (!noiseLayerVisible) return null

  return (
    <>
      <NoiseInfoModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="noise-legend">
        <div className="noise-legend__header">
          <span className="noise-legend__title">{t('noise.title')}</span>
          <button
            className="noise-legend__info-btn"
            onClick={() => setModalOpen(true)}
            aria-label={t('noise.about')}
            title={t('noise.about')}
          >
            <IconInfoCircle size={14} stroke={1.8} />
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
      </div>
    </>
  )
}
