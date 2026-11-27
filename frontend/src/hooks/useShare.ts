import { useEffect, useRef, useState } from 'react'
import i18n from '../i18n'
import { useStore, URL_DEFAULTS, settingsOf } from '../store'
import { encodeConfig, shareUrl } from '../services/urlConfig'
import { PHONE_QUERY } from '../services/phoneConfig'

const TOAST_MS = 3000

/**
 * Share button (TODO-053): the system share sheet on a phone, a copied link elsewhere. `message` is a short note
 * to show for a moment, or null. A card passes its own link (`url`) and note (`copied`) (TODO-064).
 */
export function useShare(options: { url?: () => string; copied?: string } = {}) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const say = (text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), TOAST_MS)
  }

  async function share() {
    // The settings as they are now, not as the address shows them (it follows after a short pause).
    const url = options.url
      ? options.url()
      : shareUrl(window.location.href, encodeConfig(settingsOf(useStore.getState()), URL_DEFAULTS))
    const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
    if (phone && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: i18n.t('brand.title'), url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return // the person closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      say(options.copied ?? i18n.t('share.copied'))
    } catch {
      say(i18n.t('share.copyFailed'))
    }
  }

  return { share, message }
}
