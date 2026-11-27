import { Anchor, Button, Drawer, Modal, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Trans, useTranslation } from 'react-i18next'
import { features } from '../../features'
import { buildCtaUrl } from '../../services/ctaLink'
import { PHONE_QUERY } from '../../services/phoneConfig'
import { useAboutStore } from '../../store/aboutStore'
import { SourcesTable } from './SourcesTable'

export const CONTACT = { name: 'Alexander Semenov', email: 'info@time2map.com' } as const

/**
 * "About and data sources" (TODO-066): what the map is, who made it, every data source with its licence and date,
 * the disclaimers the licences ask for and the contact. A Drawer on a phone, a Modal on a desktop. The only place
 * that holds the full credits; the map line and the cards link here.
 */
export function AboutDialog() {
  const { t } = useTranslation()
  const { t: tl } = useTranslation('legal')
  const opened = useAboutStore((s) => s.open)
  const setOpen = useAboutStore((s) => s.setOpen)
  const isMobile = useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false })
  const onClose = () => setOpen(false)

  const body = (
    <Stack gap="md" pb="md">
      <Stack gap={6} align="flex-start">
        <img src={`${import.meta.env.BASE_URL}time2map-mark.svg`} alt="time2map" height={28} />
        <Text fw={700} size="lg">{t('brand.title')}</Text>
      </Stack>
      <Text size="sm">{t('about.what')}</Text>
      <Text size="sm">
        <Trans i18nKey="about.madeBy"
          components={{ brand: <Anchor href={buildCtaUrl('about-credit')} target="_blank" rel="noopener noreferrer" /> }} />
      </Text>
      <Stack gap="xs" align="flex-start">
        <Text size="sm">{t('about.cta.text')}</Text>
        <Button component="a" href={buildCtaUrl('about')} target="_blank" rel="noopener noreferrer" size="xs" variant="light">
          {t('about.cta.button')}
        </Button>
      </Stack>

      <section aria-labelledby="about-sources">
        <Text id="about-sources" fw={700} size="md" mb={4}>{tl('dialog.sources')}</Text>
        <Text size="xs" c="dimmed" mb="sm">{tl('dialog.intro')}</Text>
        <SourcesTable />
      </section>

      <section>
        <Text fw={700} size="sm">{tl('dialog.disclaimerTitle')}</Text>
        <Text size="xs" mt={2}>{tl('dialog.disclaimer')}</Text>
        <Text size="xs" mt={6}>{tl('dialog.cadastreNote')}</Text>
        {!features.commercialUse && <Text size="xs" mt={6}>{tl('streetNote')}</Text>}
      </section>
      <section>
        <Text fw={700} size="sm">{tl('dialog.odblTitle')}</Text>
        <Text size="xs" mt={2}>{tl('dialog.odbl')}</Text>
      </section>
      <section>
        <Text fw={700} size="sm">{tl('dialog.privacyTitle')}</Text>
        <Text size="xs" mt={2}>{tl('dialog.privacy')}</Text>
      </section>
      <section>
        <Text fw={700} size="sm">{tl('dialog.contactTitle')}</Text>
        <Text size="xs" mt={2}>
          <Trans t={tl} i18nKey="dialog.contact" values={CONTACT}
            components={{ mail: <Anchor href={`mailto:${CONTACT.email}`} /> }} />
        </Text>
      </section>
    </Stack>
  )

  if (isMobile) {
    return (
      <Drawer opened={opened} onClose={onClose} position="bottom" size="85%" radius="lg" padding="lg"
        title={tl('dialog.title')} classNames={{ content: 'bottom-sheet' }}>
        {body}
      </Drawer>
    )
  }
  return (
    <Modal opened={opened} onClose={onClose} title={tl('dialog.title')} size="lg" radius="lg" padding="lg"
      closeButtonProps={{ 'aria-label': tl('dialog.close') }}>
      {body}
    </Modal>
  )
}
