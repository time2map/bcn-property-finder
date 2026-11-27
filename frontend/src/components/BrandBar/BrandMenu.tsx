import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconDots, IconInfoCircle, IconShare } from '@tabler/icons-react'
import { useAboutStore } from '../../store/aboutStore'
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher'

/**
 * One "more" button for the brand bar (TODO-066): Share, About and data sources, and the language list drop down
 * from it, so the bar keeps room for the title and the search button. Closes on Escape, on a click outside and
 * after Share, About or a language pick.
 */
export function BrandMenu({ onShare }: { onShare: () => void }) {
  const { t } = useTranslation()
  const { t: tl } = useTranslation('legal')
  const setAboutOpen = useAboutStore((s) => s.setOpen)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  return (
    <div className="brand-menu" ref={root}>
      <button type="button" className="brand-menu__button" aria-label={t('brand.menu')} title={t('brand.menu')}
        aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconDots size={20} stroke={2} />
      </button>
      {open && (
        <div className="brand-menu__panel">
          <button type="button" className="brand-menu__item" onClick={() => { setOpen(false); onShare() }}>
            <IconShare size={18} stroke={2} aria-hidden="true" />{t('brand.share')}
          </button>
          <button type="button" className="brand-menu__item" onClick={() => { setOpen(false); setAboutOpen(true) }}>
            <IconInfoCircle size={18} stroke={2} aria-hidden="true" />{tl('dialog.open')}
          </button>
          <div className="brand-menu__label">{t('language.label')}</div>
          <LanguageSwitcher inline onChoose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
