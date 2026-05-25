import { useState, useCallback, useRef } from 'react'
import { usePinsStore } from '../store/pinsStore'
import { useStore } from '../store'
import { parseScreenshot } from '../services/vision/visionService'
import { geocodeAddress } from '../services/geocoding'
import { compressImage, fileToBase64 } from '../services/imageUtils'
import { calcAnalytics } from './usePinAnalytics'

const BCN_CENTER: [number, number] = [2.1734, 41.3851]

export interface DropState {
  isDragging: boolean
  isProcessing: boolean
  approxBanner: boolean
}

export function useScreenshotDrop(onError: (msg: string) => void) {
  const { addPin, updatePin, updatePinAnalytics } = usePinsStore()
  const { workplace } = useStore()
  const [state, setState] = useState<DropState>({
    isDragging: false,
    isProcessing: false,
    approxBanner: false,
  })

  // Keep ref to avoid stale closure in drag handlers
  const isProcessingRef = useRef(false)

  const dismissBanner = useCallback(() => {
    setState((s) => ({ ...s, approxBanner: false }))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!state.isDragging) setState((s) => ({ ...s, isDragging: true }))
  }, [state.isDragging])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // only clear if leaving the drop zone itself, not a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setState((s) => ({ ...s, isDragging: false }))
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setState((s) => ({ ...s, isDragging: false }))

    if (isProcessingRef.current) return
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return

    isProcessingRef.current = true
    setState((s) => ({ ...s, isProcessing: true, approxBanner: false }))

    const fallbackCoords = workplace ?? BCN_CENTER

    try {
      // Place pin immediately at map center / workplace so it's visible
      const pinId = addPin(fallbackCoords)

      // Parse screenshot and compress in parallel
      const [base64, compressedDataUrl] = await Promise.all([
        fileToBase64(file),
        compressImage(file),
      ])

      const parsed = await parseScreenshot(base64, file.type)

      // Pre-fill parsed fields; address goes into comment for reference
      const patch: Record<string, unknown> = {}
      if (parsed.price !== undefined) patch.price = parsed.price
      if (parsed.area !== undefined) patch.area = parsed.area
      if (parsed.url) patch.url = parsed.url
      if (parsed.address) patch.comment = parsed.address
      patch.photos = [compressedDataUrl]
      updatePin(pinId, patch)

      // Geocode address; fall back to initial coords on failure
      let finalCoords: [number, number] = fallbackCoords
      let geocodeFailed = false

      if (parsed.address) {
        const geocoded = await geocodeAddress(parsed.address)
        if (geocoded) {
          finalCoords = geocoded.coords
          updatePin(pinId, { coordinates: geocoded.coords, accuracyPolygon: geocoded.accuracyPolygon })
        } else {
          geocodeFailed = true
        }
      } else {
        geocodeFailed = true
      }

      // Always recalculate analytics with the final coords (geocoded or fallback).
      // usePinAnalytics already fires for the initial fallback coords, but we
      // overwrite with the correct location once geocoding is done.
      if (workplace) {
        calcAnalytics(finalCoords, workplace).then((analytics) => {
          updatePinAnalytics(pinId, analytics)
        })
      }

      if (parsed.addressIsApproximate || geocodeFailed) {
        setState((s) => ({ ...s, approxBanner: true }))
      }
    } catch {
      onError('Could not read screenshot — pin placed at map center')
    } finally {
      isProcessingRef.current = false
      setState((s) => ({ ...s, isProcessing: false }))
    }
  }, [addPin, updatePin, updatePinAnalytics, workplace, onError])

  return { state, handleDragOver, handleDragLeave, handleDrop, dismissBanner }
}
