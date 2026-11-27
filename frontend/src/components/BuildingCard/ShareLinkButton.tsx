import { Button, Text } from '@mantine/core'
import { IconShare } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useShare } from '../../hooks/useShare'

/**
 * "Share" on a card (TODO-064): the system share sheet on a phone, a copied link elsewhere. `getUrl` makes the link
 * at the moment of the click, so it carries the settings as they are then.
 */
export function ShareLinkButton({ getUrl, copied }: { getUrl: () => string; copied: string }) {
  const { t } = useTranslation('card')
  const { share, message } = useShare({ url: getUrl, copied })
  return (
    <>
      <Button
        variant="light" color="gray" size="xs" className="save-image__button"
        leftSection={<IconShare size={16} stroke={1.8} />} onClick={share}
      >
        {t('save.share')}
      </Button>
      {message && <Text size="xs" c="dimmed" role="status">{message}</Text>}
    </>
  )
}
