import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../../store'
import { usePinsStore } from '../../store/pinsStore'
import { MapContext } from './MapContext'
import { IsochroneLayer } from '../IsochroneLayer/IsochroneLayer'
import { PinLayer } from '../PropertyPins/PinLayer'

const BCN_CENTER: [number, number] = [2.1734, 41.3851]
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)

  const { workplace, setWorkplace } = useStore()
  const { isAddingPin, setIsAddingPin, addPin } = usePinsStore()

  // Keep refs current so the stable map click handler can read latest values
  const isAddingPinRef = useRef(isAddingPin)
  const addPinRef = useRef(addPin)
  useEffect(() => { isAddingPinRef.current = isAddingPin }, [isAddingPin])
  useEffect(() => { addPinRef.current = addPin }, [addPin])

  // Init map
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: BCN_CENTER,
      zoom: 12,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('click', (e) => {
      if (isAddingPinRef.current) {
        addPinRef.current([e.lngLat.lng, e.lngLat.lat])
        setIsAddingPin(false)
      } else {
        setWorkplace([e.lngLat.lng, e.lngLat.lat])
      }
    })
    map.on('load', () => {
      mapRef.current = map
      setMapInstance(map)
    })
    return () => {
      setMapInstance(null)
      mapRef.current = null
      map.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Crosshair cursor in "add pin" mode
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isAddingPin ? 'crosshair' : ''
  }, [isAddingPin])

  // Esc cancels "add pin" mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddingPin(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setIsAddingPin])

  // Sync workplace marker
  useEffect(() => {
    if (!mapInstance) return
    markerRef.current?.remove()
    if (!workplace) return
    const el = document.createElement('div')
    el.className = 'work-marker'
    el.innerHTML = '<span class="work-marker__label">Work</span><div class="work-marker__dot"></div>'
    markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(workplace)
      .addTo(mapInstance)
  }, [workplace, mapInstance])

  return (
    <MapContext.Provider value={mapInstance}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <IsochroneLayer />
      <PinLayer />
    </MapContext.Provider>
  )
}
