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

// Vertical offset to keep the rank circle center at the geographic coordinate
// when a 48px thumbnail (+ 2px margin) sits above the 28px circle.
// Total height = 78px, circle center at 64px from top, element center at 39px → offset = 25px up.
const PHOTO_OFFSET_Y = -25

function renderMarkerContent(
  el: HTMLElement,
  rank: number,
  index: number | undefined,
  photo: string | undefined,
  selected: boolean,
) {
  el.innerHTML = ''
  if (photo) {
    const img = document.createElement('img')
    img.className = 'pin-marker__thumb'
    img.src = photo
    el.appendChild(img)
  }
  const circle = document.createElement('div')
  circle.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: ${pinColor(index)};
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 11px; font-weight: 700;
    ${selected ? 'outline: 3px solid #228be6; outline-offset: 2px;' : ''}
  `
  circle.textContent = String(rank)
  el.appendChild(circle)
}

function createMarkerEl(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-marker'
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
      const photo = pin.photos?.[0]
      const existing = markersRef.current.get(pin.id)

      if (existing) {
        existing.setLngLat(pin.coordinates)
        const el = existing.getElement()
        const hadPhoto = el.querySelector('.pin-marker__thumb') !== null
        renderMarkerContent(el, rank, index, photo, pin.id === selectedPinId)
        if (!!photo !== hadPhoto) {
          existing.setOffset(photo ? [0, PHOTO_OFFSET_Y] : [0, 0])
        }
      } else {
        const el = createMarkerEl()
        renderMarkerContent(el, rank, index, photo, pin.id === selectedPinId)

        const marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          offset: photo ? [0, PHOTO_OFFSET_Y] : [0, 0],
        })
          .setLngLat(pin.coordinates)
          .addTo(map)

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedPin(pin.id)
        })

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat()
          const newCoords: [number, number] = [lngLat.lng, lngLat.lat]
          // Clear accuracy polygon — user explicitly placed the pin
          usePinsStore.getState().updatePin(pin.id, { coordinates: newCoords, accuracyPolygon: undefined })
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
