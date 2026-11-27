import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { useSheetStore } from '../store/sheetStore'

/**
 * Keeps the phone's sheet in step with the selected building or area (TODO-062, 064): a building opens at peek, so that it stays
 * visible on the map; closing it brings the previous position back. Picking another building changes nothing.
 */
export function useSheetFlow(enabled: boolean): void {
  const selected = useStore((s) => (s.selectedBuilding !== null || s.selectedArea !== null ? 1 : null))
  const was = useRef(false)
  useEffect(() => {
    if (!enabled) { was.current = false; return }
    const is = selected !== null
    if (is && !was.current) useSheetStore.getState().openBuilding()
    if (!is && was.current) useSheetStore.getState().closeBuilding()
    was.current = is
  }, [enabled, selected])
}
