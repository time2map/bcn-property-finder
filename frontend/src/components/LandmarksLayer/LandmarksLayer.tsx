import { useContext, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { LANDMARKS } from '../../services/cityCore/landmarks'

export function LandmarksLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.compositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)

  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  const show = visible && weights.cityCore > 0

  useEffect(() => {
    if (!map) return

    markersRef.current.forEach((marker, id) => {
      if (!show || !enabledIds.includes(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    if (!show) return

    LANDMARKS.filter((lm) => enabledIds.includes(lm.id)).forEach((lm) => {
      if (markersRef.current.has(lm.id)) return
      const el = document.createElement('div')
      el.className = 'city-core-landmark'
      el.innerHTML = `<div class="city-core-landmark__dot"></div><span class="city-core-landmark__label">${lm.name}</span>`
      const marker = new maplibregl.Marker({ element: el, anchor: 'top' })
        .setLngLat([lm.lng, lm.lat])
        .addTo(map)
      markersRef.current.set(lm.id, marker)
    })
  }, [map, show, enabledIds])

  useEffect(() => {
    const markers = markersRef.current
    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
    }
  }, [map])

  return null
}
