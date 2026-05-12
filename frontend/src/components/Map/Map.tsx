import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../../store'
import { MapContext } from './MapContext'
import { IsochroneLayer } from '../IsochroneLayer/IsochroneLayer'

const BCN_CENTER: [number, number] = [2.1734, 41.3851]
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)

  const { workplace, setWorkplace } = useStore()

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
      setWorkplace([e.lngLat.lng, e.lngLat.lat])
    })
    map.on('load', () => setMapInstance(map))
    return () => {
      setMapInstance(null)
      map.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync workplace marker — only after map is loaded to avoid flash at (0,0)
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
    </MapContext.Provider>
  )
}
