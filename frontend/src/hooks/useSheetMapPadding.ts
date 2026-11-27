import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/mapStore'
import { useSheetStore } from '../store/sheetStore'

const NONE = { top: 0, left: 0, right: 0, bottom: 0 }

/** Pushes the map up by the sheet, so the centre of the map is the centre of what is visible (TODO-062). */
export function useSheetMapPadding(enabled: boolean): void {
  const map = useMapStore((s) => s.map)
  const inset = useSheetStore((s) => s.mapInset)
  const first = useRef(true)

  useEffect(() => {
    if (!enabled || !map) return
    if (Math.abs((map.getPadding().bottom ?? 0) - inset) < 1) return
    map.easeTo({ padding: { ...NONE, bottom: inset }, duration: first.current ? 0 : 250 })
    first.current = false
  }, [enabled, map, inset])

  // Back to the desktop layout (a resize or a rotation): the whole map is visible again.
  useEffect(() => {
    if (!enabled || !map) return
    return () => { first.current = true; map.setPadding(NONE) }
  }, [enabled, map])
}
