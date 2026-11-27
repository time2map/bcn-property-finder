import type * as maplibregl from 'maplibre-gl'

/**
 * Runs `commit` after `graceMs`, unless the person touches the map again or the map starts moving first. On a phone a
 * double tap followed by a drag zooms with one finger; its first tap must not open a building card (TODO-062).
 * Returns a function that cancels the wait.
 */
export function commitAfterGrace(map: Pick<maplibregl.Map, 'on' | 'off'>, graceMs: number, commit: () => void): () => void {
  let done = false
  const cancel = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    map.off('touchstart', cancel)
    map.off('movestart', cancel)
    map.off('zoomstart', cancel)
  }
  const timer = setTimeout(() => {
    if (done) return
    cancel()
    commit()
  }, graceMs)
  map.on('touchstart', cancel)
  map.on('movestart', cancel)
  map.on('zoomstart', cancel)
  return cancel
}
