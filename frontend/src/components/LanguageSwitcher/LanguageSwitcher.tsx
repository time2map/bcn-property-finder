import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconCheck, IconLanguage } from '@tabler/icons-react'
import { ENABLED_LANGUAGES, languageName } from '../../i18n/languages'
import { setLanguage } from '../../i18n'

/**
 * Language menu of the brand bar (TODO-065): a button with the code of the current language and a list of every
 * enabled language, each written in itself. Plain markup (no Mantine popover) so the bar stays light and works
 * without a provider. With `inline` the list is always open (the phone "About" sheet, the brand menu); `onChoose`
 * lets the host close itself after a pick.
 */
export function LanguageSwitcher({ inline = false, onChoose }: { inline?: boolean; onChoose?: () => void }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = i18n.language

  useEffect(() => {
    if (!open || inline) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [open, inline])

  function choose(code: string) {
    setOpen(false)
    onChoose?.()
    void setLanguage(code)
  }

  const list = (
    <ul className={inline ? 'lang-list lang-list--inline' : 'lang-list'} role="listbox" aria-label={t('language.label')}>
      {ENABLED_LANGUAGES.map((code) => (
        <li key={code} role="option" lang={code} aria-selected={code === current} tabIndex={0}
          className="lang-option" onClick={() => choose(code)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(code) } }}>
          <span>{languageName(code)}</span>
          {code === current && <IconCheck size={16} stroke={2.2} aria-hidden="true" />}
        </li>
      ))}
    </ul>
  )

  if (inline) return list
  return (
    <div className="lang-switcher" ref={root}>
      <button type="button" className="lang-button" aria-label={t('language.switch')} title={t('language.switch')}
        aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconLanguage size={18} stroke={2} aria-hidden="true" />
        <span className="lang-code">{current.toUpperCase()}</span>
      </button>
      {open && list}
    </div>
  )
}
