import { useEffect, useState } from 'react'
import { useStore, URL_DEFAULTS, settingsOf } from '../store'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE } from '../i18n/languages'
import { encodeConfig, withConfig } from '../services/urlConfig'

/** Wait this long after the last change of a setting before the address is rewritten. */
const CONFIG_DELAY_MS = 300

/**
 * Keeps the address in step with the map: the view (`minutes`, `zoom`, `cx`, `cy`) at once, the settings (`c`,
 * TODO-053) after a short pause. `c` is left out while everything is the default.
 */
export function useUrlState() {
  const { minutes, zoom, mapCenter } = useStore()
  const { i18n } = useTranslation()
  const lang = i18n.language
  const config = useStore((s) => encodeConfig(settingsOf(s), URL_DEFAULTS))
  const [written, setWritten] = useState(config)

  useEffect(() => {
    const timer = setTimeout(() => setWritten(config), CONFIG_DELAY_MS)
    return () => clearTimeout(timer)
  }, [config])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('minutes', String(minutes))
    params.set('zoom', zoom.toFixed(2))
    params.set('cx', mapCenter[0].toFixed(5))
    params.set('cy', mapCenter[1].toFixed(5))
    if (lang !== DEFAULT_LANGUAGE) params.set('lang', lang)
    window.history.replaceState(null, '', `${window.location.pathname}${withConfig(`?${params.toString()}`, written)}`)
  }, [minutes, zoom, mapCenter, written, lang])
}
