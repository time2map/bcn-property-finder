import { useCallback, useEffect, useRef, useState } from 'react'

const WIDTH_KEY = 'bcn_compare_width'
const COLLAPSED_KEY = 'bcn_compare_collapsed'

export const MIN_WIDTH = 280
export const DEFAULT_WIDTH = 440
const MAX_WIDTH_FRACTION = 0.6

/** Upper bound for the compare panel: never more than 60% of the viewport. */
export function maxWidth(viewport: number = window.innerWidth): number {
  return Math.max(MIN_WIDTH, Math.round(viewport * MAX_WIDTH_FRACTION))
}

/** Clamp a desired width to [MIN_WIDTH, maxWidth]. */
export function clampWidth(value: number, max: number = maxWidth()): number {
  return Math.max(MIN_WIDTH, Math.min(value, max))
}

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(n) ? clampWidth(n) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore quota / unavailable storage
  }
}

export interface SplitPane {
  width: number
  collapsed: boolean
  isDragging: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  /** Attach to the divider's onPointerDown. */
  startDrag: (e: React.PointerEvent) => void
}

/**
 * State for the resizable, collapsible compare panel that sits on the LEFT of the
 * viewport. Because the panel hugs the left edge, the divider's x-position equals the
 * panel width, so a drag maps the pointer's clientX straight to width (clamped).
 * Width and collapsed state persist to localStorage.
 */
export function useSplitPane(): SplitPane {
  const [width, setWidth] = useState(loadWidth)
  const [collapsed, setCollapsedState] = useState(loadCollapsed)
  const [isDragging, setIsDragging] = useState(false)

  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    persist(COLLAPSED_KEY, String(value))
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev
      persist(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const onMove = (ev: PointerEvent) => {
      setWidth(clampWidth(ev.clientX))
    }
    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      persist(WIDTH_KEY, String(widthRef.current))
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return { width, collapsed, isDragging, setCollapsed, toggleCollapsed, startDrag }
}
