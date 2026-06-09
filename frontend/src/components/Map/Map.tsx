import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../../store'
import { usePinsStore } from '../../store/pinsStore'
import { MapContext } from './MapContext'
import { IsochroneLayer } from '../IsochroneLayer/IsochroneLayer'
import { MetroLayer } from '../MetroLayer/MetroLayer'
import { FgcLayer } from '../FgcLayer/FgcLayer'
import { PinLayer } from '../PropertyPins/PinLayer'
import { PinAccuracyLayer } from '../PropertyPins/PinAccuracyLayer'
import { NoiseLayer } from '../NoiseLayer/NoiseLayer'
import { CompositeLayer } from '../CompositeLayer/CompositeLayer'
import { WalkabilityLayer } from '../WalkabilityLayer/WalkabilityLayer'
import { PoiLayer } from '../PoiLayer/PoiLayer'
import { ExclusionLayer } from '../ExclusionLayer/ExclusionLayer'
import { ExclusionDraw } from '../ExclusionDraw/ExclusionDraw'
import { ExportAreasLayer } from '../ExportAreasLayer/ExportAreasLayer'
import { IdealistaPricesLayer } from '../IdealistaPricesLayer/IdealistaPricesLayer'
import { LandmarksLayer } from '../LandmarksLayer/LandmarksLayer'
import { MapContextMenu } from './MapContextMenu'
import { useExclusionsStore } from '../../store/exclusionsStore'

const PRIMARY_STYLE = 'https://geoserveis.icgc.cat/contextmaps/icgc_mapa_estandard_general.json'
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

async function resolveStyleUrl(): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(PRIMARY_STYLE, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok ? PRIMARY_STYLE : FALLBACK_STYLE
  } catch {
    return FALLBACK_STYLE
  }
}

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [styleUrl, setStyleUrl] = useState<string | null>(null)

  useEffect(() => {
    resolveStyleUrl().then(setStyleUrl)
  }, [])

  const { workplace, zoom, mapCenter, setWorkplace, setZoom, setMapCenter, setMapAttribution } = useStore()
  const { isAddingPin, setIsAddingPin, addPin } = usePinsStore()
  const drawingMode = useExclusionsStore((s) => s.drawingMode)

  // Keep refs current so the stable map click handler can read latest values
  const isAddingPinRef = useRef(isAddingPin)
  const addPinRef = useRef(addPin)
  const workplaceRef = useRef(workplace)
  const zoomRef = useRef(zoom)
  const mapCenterRef = useRef(mapCenter)
  const drawingModeRef = useRef(drawingMode)
  useEffect(() => { drawingModeRef.current = drawingMode }, [drawingMode])
  useEffect(() => { isAddingPinRef.current = isAddingPin }, [isAddingPin])
  useEffect(() => { addPinRef.current = addPin }, [addPin])
  useEffect(() => { workplaceRef.current = workplace }, [workplace])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { mapCenterRef.current = mapCenter }, [mapCenter])

  // Init map
  useEffect(() => {
    if (!containerRef.current || !styleUrl) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: mapCenterRef.current,
      zoom: zoomRef.current,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('click', (e) => {
      // While drawing an exclusion zone, terra-draw owns map clicks.
      if (drawingModeRef.current) return
      if (isAddingPinRef.current) {
        addPinRef.current([e.lngLat.lng, e.lngLat.lat])
        setIsAddingPin(false)
      } else if (!workplaceRef.current) {
        // Only set workplace via click when it hasn't been placed yet
        setWorkplace([e.lngLat.lng, e.lngLat.lat])
      }
    })
    map.on('moveend', () => {
      const { lng, lat } = map.getCenter()
      setMapCenter([lng, lat])
    })
    map.on('zoomend', () => setZoom(map.getZoom()))
    map.once('style.load', () => {
      mapRef.current = map
      setMapInstance(map)
      const texts = Object.values(map.getStyle().sources)
        .map((s) => (s as Record<string, unknown>).attribution as string | undefined)
        .filter((t): t is string => !!t)
      if (texts.length) setMapAttribution(texts.join(' | '))
    })
    return () => {
      setMapInstance(null)
      mapRef.current = null
      map.remove()
    }
  }, [styleUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the canvas in sync when the map pane resizes (split divider drag,
  // panel collapse, mobile Map/Compare toggle, window resize).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver(() => mapRef.current?.resize())
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

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

  // Sync workplace marker (draggable)
  useEffect(() => {
    if (!mapInstance) return
    markerRef.current?.remove()
    if (!workplace) return
    const el = document.createElement('div')
    el.className = 'work-marker'
    el.innerHTML = '<span class="work-marker__label">Work</span><div class="work-marker__dot"></div>'
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true })
      .setLngLat(workplace)
      .addTo(mapInstance)
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      setWorkplace([lng, lat])
    })
    markerRef.current = marker
  }, [workplace, mapInstance]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapContext.Provider value={mapInstance}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Layer z-order: first rendered = bottom of stack */}
      <CompositeLayer />
      <LandmarksLayer />
      <NoiseLayer />
      <ExclusionLayer />
      <ExclusionDraw />
      <ExportAreasLayer />
      <IdealistaPricesLayer />
      <IsochroneLayer />
      <MetroLayer />
      <FgcLayer />
      <PoiLayer />
      <PinAccuracyLayer />
      <PinLayer />
      <WalkabilityLayer />
      <MapContextMenu />
    </MapContext.Provider>
  )
}
