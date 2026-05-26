import { useEffect } from 'react'
import { useStore } from '../store'

export function useUrlState() {
  const { minutes, zoom, mapCenter } = useStore()

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('minutes', String(minutes))
    params.set('zoom', zoom.toFixed(2))
    params.set('cx', mapCenter[0].toFixed(5))
    params.set('cy', mapCenter[1].toFixed(5))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [minutes, zoom, mapCenter])
}
