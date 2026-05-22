import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { fetchOtpIsochrone } from '../services/otp'

export function useIsochrone(onError?: (err: Error) => void) {
  const { workplace, minutes, setResultPolygon } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!workplace) return
    setIsLoading(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const polygon = await fetchOtpIsochrone(workplace, minutes)
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
  }, [workplace, minutes]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isLoading }
}
