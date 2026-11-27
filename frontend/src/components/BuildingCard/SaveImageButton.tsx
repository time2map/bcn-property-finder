import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Text } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { settingsOf, URL_DEFAULTS, useStore } from '../../store'
import { useMapStore } from '../../store/mapStore'
import { encodeConfig, shareUrl } from '../../services/urlConfig'
import { profileOf, type ShareModel } from '../../services/shareImage/shareImageModel'

type Status = 'idle' | 'busy' | 'done' | 'failed'


/**
 * "Save image" (TODO-063): the picture of this building's result, for a message or a post. `build` makes the model
 * of the picture from the card's data and the profile (null when the settings are not a profile).
 */
export function SaveImageButton({ lngLat, build, link, extra }: {
  lngLat: [number, number]
  build: (profile: ReturnType<typeof profileOf>) => ShareModel
  /** The link that goes with the picture on a phone's share sheet; the map's own address when absent. */
  link?: () => string
  /** Sits next to the button in the same row (the card's Share button). */
  extra?: ReactNode
}) {
  const { t } = useTranslation('card')
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function save() {
    const map = useMapStore.getState().map
    if (!map || status === 'busy') return
    setStatus('busy')
    try {
      const state = useStore.getState()
      const model = build(profileOf(settingsOf(state), URL_DEFAULTS))
      // The drawing code is loaded on the first click, not at start (the bundle budget, TODO-058).
      const { deliverImage, renderShareBlob } = await import('../../services/shareImage/shareImageBrowser')
      const blob = await renderShareBlob(map, lngLat, model)
      const url = link ? link() : shareUrl(window.location.href, encodeConfig(settingsOf(state), URL_DEFAULTS))
      const result = await deliverImage(blob, model.place, url)
      setStatus(result === 'cancelled' ? 'idle' : 'done')
    } catch (err) {
      console.error('Share image failed', err)
      setStatus('failed')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), 4000)
  }

  const note = status === 'done' ? t('save.done') : status === 'failed' ? t('save.failed') : null
  return (
    <div className="save-image">
      <Button
        variant="light" color="gray" size="xs" className="save-image__button" loading={status === 'busy'}
        leftSection={<IconPhoto size={16} stroke={1.8} />} onClick={save}
      >
        {t('save.button')}
      </Button>
      {extra}
      {note && <Text size="xs" c={status === 'failed' ? 'red.7' : 'dimmed'} role="status">{note}</Text>}
    </div>
  )
}
