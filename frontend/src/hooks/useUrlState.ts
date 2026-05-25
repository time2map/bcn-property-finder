import { useEffect } from 'react'
import { useStore } from '../store'

export function useUrlState() {
  const { workplace, minutes, zoom } = useStore()

  useEffect(() => {
    const params = new URLSearchParams()
    if (workplace) {
      params.set('lng', workplace[0].toFixed(5))
      params.set('lat', workplace[1].toFixed(5))
    }
    params.set('minutes', String(minutes))
    params.set('zoom', zoom.toFixed(2))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [workplace, minutes, zoom])
}
