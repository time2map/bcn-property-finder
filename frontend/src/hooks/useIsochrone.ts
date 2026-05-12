import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { fetchIsochrone } from '../services/ors'

export function useIsochrone(onError?: (err: Error) => void) {
  const { workplace, mode, minutes, setResultPolygon } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!workplace) return
    setIsLoading(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const polygon = await fetchIsochrone(workplace, mode, minutes)
        setResultPolygon(polygon)
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [workplace, mode, minutes]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isLoading }
}
