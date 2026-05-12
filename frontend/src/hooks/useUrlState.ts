import { useEffect } from 'react'
import { useStore } from '../store'

export function useUrlState() {
  const { workplace, mode, minutes } = useStore()

  useEffect(() => {
    const params = new URLSearchParams()
    if (workplace) {
      params.set('lng', workplace[0].toFixed(5))
      params.set('lat', workplace[1].toFixed(5))
    }
    params.set('mode', mode)
    params.set('minutes', String(minutes))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [workplace, mode, minutes])
}
