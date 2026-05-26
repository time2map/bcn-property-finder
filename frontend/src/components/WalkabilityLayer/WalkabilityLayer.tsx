import { useContext, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { usePinsStore } from '../../store/pinsStore'

function markerColor(walkingMinutes: number): string {
  if (walkingMinutes <= 15) return '#2f9e44'   // green
  if (walkingMinutes <= 25) return '#e67700'   // orange
  return '#e03131'                              // red
}

export function WalkabilityLayer() {
  const map = useContext(MapContext)
  const { pins, selectedPinId } = usePinsStore()
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (!map || !selectedPinId) return

    const pin = pins.find((p) => p.id === selectedPinId)
    const services = pin?.analytics?.walkabilityServices
    if (!services || services.length === 0) return

    for (const svc of services) {
      const el = document.createElement('div')
      const displayName = svc.name
        ? (svc.name.length > 14 ? svc.name.slice(0, 13) + '…' : svc.name)
        : svc.label
      el.className = 'walkability-marker'
      el.style.borderColor = markerColor(svc.walkingMinutes)
      el.innerHTML = `<span class="walkability-marker__emoji">${svc.emoji}</span><span class="walkability-marker__name" style="border-color:${markerColor(svc.walkingMinutes)}">${displayName}</span><span class="walkability-marker__time" style="border-color:${markerColor(svc.walkingMinutes)}">${svc.walkingMinutes}m</span>`

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([svc.lon, svc.lat])
        .addTo(map)

      markersRef.current.push(marker)
    }

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map, selectedPinId, pins])

  return null
}
