import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { SheetSlots } from './sheetSlots'
import { useSheetStore } from '../../store/sheetStore'
import {
  SHEET_POSITIONS, clampHeight, mapInset, sheetHeights, snapPosition, type SheetPosition,
} from '../../services/sheetSnap'

/** Movement before a press becomes a drag, so that taps on buttons inside the sheet still work. */
const DRAG_START_PX = 6
/** A pointer that rested this long before release is not a flick. */
const STALE_MS = 80

const LABEL_KEY = { peek: 'mobile.open', half: 'mobile.expand', full: 'mobile.collapse' } as const satisfies Record<SheetPosition, string>

interface Drag { startY: number; startHeight: number; lastY: number; lastT: number; v: number; active: boolean; height: number }

function useViewport() {
  const probe = useRef<HTMLDivElement>(null)
  const [vp, setVp] = useState({ height: window.innerHeight, safe: 0, safeTop: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const style = probe.current ? getComputedStyle(probe.current) : null
      setVp({
        height: window.innerHeight,
        safe: style ? parseFloat(style.paddingBottom) || 0 : 0,
        safeTop: style ? parseFloat(style.paddingTop) || 0 : 0,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])
  return { ...vp, probe }
}

/**
 * The phone's bottom sheet (TODO-062): peek, half and full. The map stays visible above it. It is dragged by
 * the handle and the header, and by the body while it is not at full; at full the body scrolls.
 *
 * `header` and `main` are the conditions view; a component rendered as `children` can fill the building view
 * through `useSheetSlots()`. `view` says which of the two is shown.
 */
export function MobileSheet({ view, header, main, floating, children }: {
  view: 'main' | 'building'
  header: ReactNode
  main: ReactNode
  /** Sits just above the top edge of the sheet and moves with it (the legend and the map buttons). */
  floating?: ReactNode
  children?: ReactNode
}) {
  const { t } = useTranslation('panel')
  const position = useSheetStore((s) => s.position)
  const setPosition = useSheetStore((s) => s.setPosition)
  const setMapInset = useSheetStore((s) => s.setMapInset)
  const { height: vh, safe, safeTop, probe } = useViewport()
  const heights = useMemo(() => sheetHeights(vh, safe, safeTop), [vh, safe, safeTop])
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<Drag | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const grabRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  const [bodySlot, setBodySlot] = useState<HTMLElement | null>(null)
  const slots = useMemo(() => ({ header: headerSlot, body: bodySlot }), [headerSlot, bodySlot])

  const shown = dragHeight ?? heights[position]

  // The map keeps clear of the sheet by what is settled (a drag in progress does not move it).
  useEffect(() => { setMapInset(mapInset(position, heights)) }, [position, heights, setMapInset])

  // Native listeners, not React's: the building card fills the header and body through portals, and React events
  // follow the React tree, not the DOM one, so a drag that starts on the address would never reach the sheet.
  useEffect(() => {
    const section = sectionRef.current
    const targets: HTMLElement[] = []
    if (grabRef.current) targets.push(grabRef.current)
    if (position !== 'full' && bodyRef.current) targets.push(bodyRef.current)
    if (!section) return

    const onDown = (e: globalThis.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      suppressClick.current = false
      const start = heights[position]
      drag.current = { startY: e.clientY, startHeight: start, lastY: e.clientY, lastT: e.timeStamp, v: 0, active: false, height: start }
    }
    const onMove = (e: globalThis.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dy = d.startY - e.clientY
      if (!d.active) {
        if (Math.abs(dy) < DRAG_START_PX) return
        d.active = true
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      }
      const h = clampHeight(d.startHeight + dy, heights)
      const dt = Math.max(1, e.timeStamp - d.lastT)
      d.v = 0.7 * ((d.lastY - e.clientY) / dt) + 0.3 * d.v
      d.lastY = e.clientY
      d.lastT = e.timeStamp
      d.height = h
      setDragHeight(h)
    }
    const onUp = (e: globalThis.PointerEvent) => {
      const d = drag.current
      drag.current = null
      if (!d) return
      // A tap on the small sheet opens it halfway, as if it had been pulled up. Buttons and links keep their own taps.
      if (!d.active) {
        const onControl = e.target instanceof Element && e.target.closest('button, a, input, select, textarea')
        if (e.type === 'pointerup' && position === 'peek' && !onControl) setPosition('half')
        return
      }
      // A mouse drag that ends over a button is followed by a click; it must not press the button.
      suppressClick.current = true
      setTimeout(() => { suppressClick.current = false }, 0)
      const v = e.timeStamp - d.lastT > STALE_MS ? 0 : d.v
      setPosition(snapPosition(d.height, v, heights))
      setDragHeight(null)
    }
    const onClick = (e: MouseEvent) => {
      if (!suppressClick.current) return
      e.stopPropagation()
      e.preventDefault()
      suppressClick.current = false
    }

    for (const t of targets) {
      t.addEventListener('pointerdown', onDown)
      t.addEventListener('pointermove', onMove)
      t.addEventListener('pointerup', onUp)
      t.addEventListener('pointercancel', onUp)
    }
    section.addEventListener('click', onClick, true)
    return () => {
      for (const t of targets) {
        t.removeEventListener('pointerdown', onDown)
        t.removeEventListener('pointermove', onMove)
        t.removeEventListener('pointerup', onUp)
        t.removeEventListener('pointercancel', onUp)
      }
      section.removeEventListener('click', onClick, true)
    }
  }, [heights, position, setPosition])

  const cycle = () => {
    const next = SHEET_POSITIONS[(SHEET_POSITIONS.indexOf(position) + 1) % SHEET_POSITIONS.length]
    setPosition(next)
  }

  return (
    <SheetSlots.Provider value={slots}>
      <div ref={probe} className="mobile-sheet__probe" aria-hidden="true" />
      <section
        ref={sectionRef}
        className="mobile-sheet"
        data-position={position}
        data-view={view}
        data-dragging={dragHeight !== null}
        aria-label={t('mobile.sheet')}
        style={{ height: heights.full, transform: `translateY(${heights.full - shown}px)` }}
      >
        {floating && <div className="mobile-sheet__floating">{floating}</div>}
        <div className="mobile-sheet__grab" ref={grabRef}>
          <button
            type="button"
            className="mobile-sheet__handle"
            aria-label={t(LABEL_KEY[position])}
            aria-expanded={position !== 'peek'}
            onClick={cycle}
          >
            <span />
          </button>
          <div className="mobile-sheet__header" hidden={view === 'building'}>{header}</div>
          <div className="mobile-sheet__header" hidden={view === 'main'} ref={setHeaderSlot} />
        </div>
        <div className="mobile-sheet__body" ref={bodyRef}>
          <div hidden={view === 'building'}>{main}</div>
          <div hidden={view === 'main'} ref={setBodySlot} />
        </div>
        {children}
      </section>
    </SheetSlots.Provider>
  )
}

