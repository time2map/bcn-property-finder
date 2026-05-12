import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../../store'

const BCN_CENTER: [number, number] = [2.1734, 41.3851]
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

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
    mapRef.current = map
    return () => map.remove()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync workplace marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    if (!workplace) return
    markerRef.current = new maplibregl.Marker({ color: '#e03131' })
      .setLngLat(workplace)
      .addTo(map)
  }, [workplace])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
