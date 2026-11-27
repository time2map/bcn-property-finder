import { useEffect } from 'react'

/**
 * Publishes the height of the visible part of the page as `--vvh`. On iOS the on-screen keyboard shrinks the visual
 * viewport, not the layout one, so the search results use it to stay above the keyboard (TODO-062).
 */
export function useVisualViewportVar(enabled: boolean): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const set = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    set()
    vv.addEventListener('resize', set)
    return () => {
      vv.removeEventListener('resize', set)
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [enabled])
}
