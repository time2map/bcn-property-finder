import { useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PickerHostContext, PickerSlotContext } from './pickerContext'

/**
 * A tappable word of a sentence. It opens its picker in place, under the sentence (TODO-072), where the editor has
 * left a slot for it; one picker is open at a time per panel, a second tap on the word or Escape closes it.
 * `children` gets a function that closes it. Without an editor around it the panel goes to the page body.
 */
export function WordPicker({ label, title, note, children }: {
  label: string
  title?: string
  /** A second, smaller line under the title: what happens beyond the limit. */
  note?: string
  children: (close: () => void) => ReactNode
}) {
  const id = useId()
  const host = useContext(PickerHostContext)
  const slot = useContext(PickerSlotContext)
  const [localOpen, setLocalOpen] = useState(false)
  const opened = host ? host.openId === id : localOpen
  const setOpened = (v: boolean) => (host ? host.setOpenId(v ? id : null) : setLocalOpen(v))

  useEffect(() => {
    if (!opened) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpened(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const panel = (
    <div className="word-panel" role="group" aria-label={title ?? label}>
      {title && <div className="word-panel__title">{title}</div>}
      {note && <div className="word-panel__note">{note}</div>}
      {children(() => setOpened(false))}
    </div>
  )
  return (
    <>
      <button
        type="button"
        className="word-pill"
        aria-expanded={opened}
        onClick={() => setOpened(!opened)}
      >
        {label}
      </button>
      {opened && createPortal(panel, slot ?? document.body)}
    </>
  )
}
