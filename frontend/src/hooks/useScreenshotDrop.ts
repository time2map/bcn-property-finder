import { useState, useCallback, useRef } from 'react'
import { usePinsStore } from '../store/pinsStore'
import { useStore } from '../store'
import { parseScreenshot } from '../services/vision/visionService'
import { geocodeAddress } from '../services/geocoding'
import { compressImage, fileToBase64 } from '../services/imageUtils'
import { calcAnalytics } from './usePinAnalytics'
import { useMap } from '../components/Map/MapContext'
import { IdealistaHTMLParser, buildPinComment } from '../services/parser/IdealistaHTMLParser'

const BCN_CENTER: [number, number] = [2.1734, 41.3851]

export interface DropState {
  isDragging: boolean
  dragType: 'image' | 'html' | null
  isProcessing: boolean
  processingLabel: string
  approxBanner: boolean
}

export function useScreenshotDrop(onError: (msg: string) => void) {
  const { addPin, addParsedPin, updatePin, updatePinAnalytics } = usePinsStore()
  const { workplace } = useStore()
  const map = useMap()
  const [state, setState] = useState<DropState>({
    isDragging: false,
    dragType: null,
    isProcessing: false,
    processingLabel: '',
    approxBanner: false,
  })

  const isProcessingRef = useRef(false)

  const dismissBanner = useCallback(() => {
    setState((s) => ({ ...s, approxBanner: false }))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!state.isDragging) {
      let dragType: 'image' | 'html' | null = null
      const item = e.dataTransfer.items?.[0]
      if (item?.type.startsWith('image/')) dragType = 'image'
      else if (item?.type === 'text/html' || item?.type === 'text/htm') dragType = 'html'
      setState((s) => ({ ...s, isDragging: true, dragType }))
    }
  }, [state.isDragging])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setState((s) => ({ ...s, isDragging: false, dragType: null }))
  }, [])

  const processImageFile = useCallback(async (file: File) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setState((s) => ({ ...s, isProcessing: true, processingLabel: 'Parsing screenshot…', approxBanner: false }))

    const fallbackCoords = workplace ?? BCN_CENTER
    try {
      const pinId = addPin(fallbackCoords)
      const [base64, compressedDataUrl] = await Promise.all([
        fileToBase64(file),
        compressImage(file),
      ])
      const parsed = await parseScreenshot(base64, file.type)
      const patch: Record<string, unknown> = {}
      if (parsed.price !== undefined) patch.price = parsed.price
      if (parsed.area !== undefined) patch.area = parsed.area
      if (parsed.url) patch.url = parsed.url
      if (parsed.address) patch.comment = parsed.address
      patch.photos = [compressedDataUrl]
      updatePin(pinId, patch)

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
      setState((s) => ({ ...s, isProcessing: false, processingLabel: '' }))
    }
  }, [addPin, updatePin, updatePinAnalytics, workplace, onError])

  const processHtmlFile = useCallback(async (file: File) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setState((s) => ({ ...s, isProcessing: true, processingLabel: 'Importing from Idealista…', approxBanner: false }))

    try {
      const html = await file.text()
      const parsed = new IdealistaHTMLParser(html).parse()
      const addressQuery = `${parsed.street}, ${parsed.neighborhood}, ${parsed.city}`
      const geo = await geocodeAddress(addressQuery)
      if (!geo) {
        onError(`Could not geocode address: ${addressQuery}`)
        return
      }
      addParsedPin({
        id: crypto.randomUUID(),
        coordinates: geo.coords,
        price: parsed.price || undefined,
        area: parsed.areaSqm || undefined,
        url: parsed.url || undefined,
        photos: parsed.photos.length ? parsed.photos : undefined,
        comment: buildPinComment(parsed),
        bedrooms: parsed.bedrooms || undefined,
        bathrooms: parsed.bathrooms || undefined,
        floor: parsed.floor || undefined,
        yearBuilt: parsed.yearBuilt ?? undefined,
        accuracyPolygon: geo.accuracyPolygon,
        createdAt: new Date().toISOString(),
      })
      map?.flyTo({ center: geo.coords, zoom: 15 })
    } catch {
      onError('Could not parse Idealista HTML')
    } finally {
      isProcessingRef.current = false
      setState((s) => ({ ...s, isProcessing: false, processingLabel: '' }))
    }
  }, [addParsedPin, onError, map])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setState((s) => ({ ...s, isDragging: false, dragType: null }))
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.type.startsWith('image/')) {
      await processImageFile(file)
    } else if (
      file.type === 'text/html' ||
      file.type === 'text/htm' ||
      file.name.endsWith('.html') ||
      file.name.endsWith('.htm')
    ) {
      await processHtmlFile(file)
    }
  }, [processImageFile, processHtmlFile])

  return {
    state,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    dismissBanner,
    processImageFile,
    processHtmlFile,
  }
}
