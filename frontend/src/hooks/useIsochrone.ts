import { useEffect, useRef, useState } from 'react'
import type { MultiPolygon, Polygon } from 'geojson'
import { useStore, isochroneCacheKey } from '../store'
import { fetchOtpIsochrone } from '../services/otp'

function writeCache(key: string, polygon: Polygon | MultiPolygon): void {
  try {
    localStorage.setItem(key, JSON.stringify(polygon))
  } catch {
    // quota exceeded — ignore
  }
}

export function useIsochrone(onError?: (err: Error) => void) {
  const { workplace, minutes, setResultPolygon } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!workplace) return

    const key = isochroneCacheKey(workplace, minutes)
    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        setResultPolygon(JSON.parse(cached) as Polygon | MultiPolygon)
      } catch { /* malformed cache entry — fall through to OTP */ }
      return
    }

    setIsLoading(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const polygon = await fetchOtpIsochrone(workplace, minutes)
        writeCache(key, polygon)
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
