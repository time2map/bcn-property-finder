import { useEffect } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { useStore } from '../../store'

/**
 * "Pick on the map" for the daily trip (078): while picking, a crosshair, and the next click on the map sets the
 * place; Esc cancels. The flag drops a tick later, so the building and area layers see it during that click and
 * open no card.
 */
export function useCommutePick(map: maplibregl.Map | null): void {
  const picking = useStore((s) => s.commutePicking)
  useEffect(() => {
    if (!map || !picking) return
    const stop = () => useStore.getState().setCommutePicking(false)
    const onClick = (e: maplibregl.MapMouseEvent) => {
      useStore.getState().setWorkplace([e.lngLat.lng, e.lngLat.lat])
      setTimeout(stop, 0)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop() }
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    map.on('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick)
      window.removeEventListener('keydown', onKey)
      canvas.style.cursor = ''
    }
  }, [map, picking])
}
