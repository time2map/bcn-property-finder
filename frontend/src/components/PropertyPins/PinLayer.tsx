import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { usePinsStore } from '../../store/pinsStore'
import { useStore } from '../../store'
import { calcAnalytics } from '../../hooks/usePinAnalytics'
import type { PropertyPin } from '../../types/pins'

function pinColor(index: number | undefined): string {
  if (index === undefined) return '#b71c1c'
  if (index >= 70) return '#2e7d32'
  if (index >= 40) return '#e65100'
  return '#b71c1c'
}

function sortedPins(pins: PropertyPin[]): PropertyPin[] {
  return [...pins].sort((a, b) => {
    const ia = a.analytics?.travelIndex
    const ib = b.analytics?.travelIndex
    if (ia === undefined && ib === undefined) return 0
    if (ia === undefined) return 1
    if (ib === undefined) return -1
    return ib - ia
  })
}

function createMarkerEl(rank: number, index: number | undefined): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-marker'
  el.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: ${pinColor(index)};
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 11px; font-weight: 700;
    cursor: pointer;
  `
  el.textContent = String(rank)
  return el
}

export function PinLayer() {
  const map = useMap()
  const { pins, selectedPinId, setSelectedPin } = usePinsStore()
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  useEffect(() => {
    if (!map) return

    const sorted = sortedPins(pins)
    const pinIds = new Set(pins.map((p) => p.id))

    // Remove markers for deleted pins
    for (const [id, marker] of markersRef.current.entries()) {
      if (!pinIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    // Add/update markers
    sorted.forEach((pin, i) => {
      const rank = i + 1
      const index = pin.analytics?.travelIndex
      const existing = markersRef.current.get(pin.id)

      if (existing) {
        // Update position
        existing.setLngLat(pin.coordinates)
        // Update marker appearance
        const el = existing.getElement()
        el.style.background = pinColor(index)
        el.textContent = String(rank)
        // Highlight selected
        el.style.outline = pin.id === selectedPinId ? '3px solid #228be6' : 'none'
        el.style.outlineOffset = '2px'
      } else {
        const el = createMarkerEl(rank, index)
        el.style.outline = pin.id === selectedPinId ? '3px solid #228be6' : 'none'
        el.style.outlineOffset = '2px'

        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat(pin.coordinates)
          .addTo(map)

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedPin(pin.id)
        })

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat()
          const newCoords: [number, number] = [lngLat.lng, lngLat.lat]
          usePinsStore.getState().updatePin(pin.id, { coordinates: newCoords })
          const workplace = useStore.getState().workplace
          if (workplace) {
            calcAnalytics(newCoords, workplace).then((analytics) => {
              usePinsStore.getState().updatePinAnalytics(pin.id, analytics)
            })
          }
        })

        markersRef.current.set(pin.id, marker)
      }
    })
  }, [map, pins, selectedPinId, setSelectedPin])

  // Cleanup on unmount
  useEffect(() => {
    const markers = markersRef.current
    return () => {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    }
  }, [])

  return null
}
