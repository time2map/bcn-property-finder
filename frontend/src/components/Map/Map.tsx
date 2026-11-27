import { useMapStore } from '../../store/mapStore'
import { useMediaQuery } from '@mantine/hooks'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useStore } from '../../store'
import { usePinsStore } from '../../store/pinsStore'
import { MapContext } from './MapContext'
import { MetroLayer } from '../MetroLayer/MetroLayer'
import { FgcLayer } from '../FgcLayer/FgcLayer'
import { NoiseLayer } from '../NoiseLayer/NoiseLayer'
import { FloodZonesLayer } from '../FloodZonesLayer/FloodZonesLayer'
import { WildfireLayer } from '../WildfireLayer/WildfireLayer'
import { StreetFloodingLayer } from '../StreetFloodingLayer/StreetFloodingLayer'
import { AreasLayer } from '../AreasLayer/AreasLayer'
import { BuildingsLayer } from '../BuildingsLayer/BuildingsLayer'
import { FacadeNoiseLayer } from '../BuildingsLayer/FacadeNoiseLayer'
import { PoiLayer } from '../PoiLayer/PoiLayer'
import { LandmarksLayer } from '../LandmarksLayer/LandmarksLayer'
import { SearchLayer } from '../SearchBox/SearchLayer'
import { MapContextMenu } from './MapContextMenu'
import { useExclusionsStore } from '../../store/exclusionsStore'

// Code that most visitors never run is loaded when it is needed, not with the page (TODO-058): the layers behind
// feature flags, and Best zones (h3-js and turf) until the zones are asked for.
const lazyNamed = <T extends Record<string, React.ComponentType<never>>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType<Record<string, unknown>> })))
const IsochroneLayer = lazyNamed(() => import('../IsochroneLayer/IsochroneLayer'), 'IsochroneLayer')
const PinLayer = lazyNamed(() => import('../PropertyPins/PinLayer'), 'PinLayer')
const PinAccuracyLayer = lazyNamed(() => import('../PropertyPins/PinAccuracyLayer'), 'PinAccuracyLayer')
const WalkabilityLayer = lazyNamed(() => import('../WalkabilityLayer/WalkabilityLayer'), 'WalkabilityLayer')
const ExclusionLayer = lazyNamed(() => import('../ExclusionLayer/ExclusionLayer'), 'ExclusionLayer')
const ExclusionDraw = lazyNamed(() => import('../ExclusionDraw/ExclusionDraw'), 'ExclusionDraw')
const BestZones = lazyNamed(() => import('../BestZones/BestZones'), 'BestZones')
const IdealistaPricesLayer = lazyNamed(() => import('../IdealistaPricesLayer/IdealistaPricesLayer'), 'IdealistaPricesLayer')
const FunnelLayer = lazyNamed(() => import('../Funnel/FunnelLayer'), 'FunnelLayer') // TODO-076 prototype
import { features } from '../../features'
import { PHONE_QUERY } from '../../services/phoneConfig'
import { loadMapStyle, type MapStyle } from '../../services/mapStyle'
import { registerPmtilesProtocol } from '../../services/noise/pmtilesProtocol'
import { constrainToBounds, MAP_MIN_ZOOM } from './mapBounds'
import { useCommutePick } from './useCommutePick'
import { commutePlaceName, isCommuteCentre } from '../../services/conditionOptions'
import i18n from '../../i18n'

// MapLibre v6 is ESM-only: bundlers must hand it the worker URL explicitly.
maplibregl.setWorkerUrl(workerUrl)

registerPmtilesProtocol()

/** The POI layer is set up when the map first gets this close (its icons start at zoom 14). */
const POI_SETUP_ZOOM = 13
/** Pause between the map being ready and the metro / FGC layers being set up. */
const TRANSIT_SETUP_DELAY_MS = 300

/** True from the first time `on` is true. */
function useEver(on: boolean): boolean {
  const [ever, setEver] = useState(on)
  if (on && !ever) setEver(true)
  return ever || on
}

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [mapStyle, setMapStyle] = useState<MapStyle | null>(null)
  const funnelOpen = useStore((s) => s.funnelOpen)

  useEffect(() => {
    let live = true
    loadMapStyle().then((s) => { if (live) setMapStyle(s) })
    return () => { live = false }
  }, [])

  const { workplace, zoom, mapCenter, setWorkplace, setZoom, setMapCenter } = useStore()
  // With the new panel, Best zones is loaded when the zones are asked for (it brings h3-js and turf).
  const zonesOn = useStore((s) => s.bestZonesBounds !== null)
  // Layers that are off at start are set up when they are first shown, not with the page (TODO-058): each one asks
  // for its tile archive as soon as it exists. POI icons start at zoom 14.
  const noiseEver = useEver(useStore((s) => s.noiseLayerVisible))
  const floodEver = useEver(useStore((s) => s.floodLayerVisible))
  const wildfireEver = useEver(useStore((s) => s.wildfireLayerVisible))
  const streetFloodingEver = useEver(useStore((s) => s.streetFloodingLayerVisible))
  const poiEver = useEver(zoom >= POI_SETUP_ZOOM)
  // Metro and FGC lines are set up a moment after the map is ready, so the buildings and the base map go first.
  const [transitReady, setTransitReady] = useState(false)
  useEffect(() => {
    if (!mapInstance) return
    const timer = setTimeout(() => setTransitReady(true), TRANSIT_SETUP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [mapInstance])
  const { isAddingPin, setIsAddingPin, addPin } = usePinsStore()
  const drawingMode = useExclusionsStore((s) => s.drawingMode)

  // Keep refs current so the stable map click handler can read latest values
  const isAddingPinRef = useRef(isAddingPin)
  const addPinRef = useRef(addPin)
  const zoomRef = useRef(zoom)
  const mapCenterRef = useRef(mapCenter)
  const drawingModeRef = useRef(drawingMode)
  useEffect(() => { drawingModeRef.current = drawingMode }, [drawingMode])
  useEffect(() => { isAddingPinRef.current = isAddingPin }, [isAddingPin])
  useEffect(() => { addPinRef.current = addPin }, [addPin])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { mapCenterRef.current = mapCenter }, [mapCenter])

  // Init map
  useEffect(() => {
    if (!containerRef.current || !mapStyle) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle.style,
      // Our copy of the ICGC style is checked when it is saved; validating its 900 layers again costs a long
      // task at start (TODO-058). In development everything is validated.
      validateStyle: import.meta.env.DEV || !mapStyle.trusted,
      center: mapCenterRef.current,
      zoom: zoomRef.current,
      minZoom: MAP_MIN_ZOOM,
      // Keep the centre inside the data zone (TODO map-bounds): its edge can be centred, the world cannot be scrolled.
      transformConstrain: constrainToBounds,
      attributionControl: false,
    })
    map.on('click', (e) => {
      if (features.exclusions && drawingModeRef.current) return
      if (features.pins && isAddingPinRef.current) {
        addPinRef.current([e.lngLat.lng, e.lngLat.lat])
        setIsAddingPin(false)
      }
    })
    map.on('moveend', () => {
      const { lng, lat } = map.getCenter()
      setMapCenter([lng, lat])
    })
    map.on('zoomend', () => setZoom(map.getZoom()))
    map.once('style.load', () => {
      performance.mark('map-style-loaded')
      mapRef.current = map
      setMapInstance(map)
      useMapStore.getState().setMap(map)
    })
    return () => {
      setMapInstance(null)
      useMapStore.getState().setMap(null)
      mapRef.current = null
      map.remove()
    }
  }, [mapStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: zoom buttons and a compass. Phone (TODO-062): pinch to zoom, and no rotation or tilt by accident.
  const phone = useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false })
  useEffect(() => {
    if (!mapInstance) return
    if (phone) {
      mapInstance.dragRotate.disable()
      mapInstance.touchZoomRotate.disableRotation()
      mapInstance.touchPitch?.disable()
      return () => {
        mapInstance.dragRotate.enable()
        mapInstance.touchZoomRotate.enableRotation()
        mapInstance.touchPitch?.enable()
      }
    }
    const nav = new maplibregl.NavigationControl()
    mapInstance.addControl(nav, 'top-right')
    return () => { mapInstance.removeControl(nav) }
  }, [mapInstance, phone])

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
    if (!features.pins) return
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isAddingPin ? 'crosshair' : ''
  }, [isAddingPin])

  // Esc cancels "add pin" mode
  useEffect(() => {
    if (!features.pins) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddingPin(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setIsAddingPin])

  // The daily trip place is picked with a click on the map (078); the first click no longer sets it.
  useCommutePick(features.isochrone ? mapInstance : null)

  // Sync the marker of the daily trip place (draggable). Not "Work": the place may be a university or a school (078).
  useEffect(() => {
    if (!features.isochrone) return
    if (!mapInstance) return
    markerRef.current?.remove()
    if (!workplace) return
    const el = document.createElement('div')
    el.className = 'work-marker'
    el.innerHTML = '<span class="work-marker__label"></span><div class="work-marker__dot"></div>'
    el.querySelector('.work-marker__label')!.textContent = isCommuteCentre(workplace)
      ? commutePlaceName() : i18n.t('editor:sentence.commuteSpotMarker')
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
      <BuildingsLayer />
      {features.areas && <AreasLayer />}
      {features.oneBuilding && funnelOpen && <Suspense fallback={null}><FunnelLayer /></Suspense>}
      <FacadeNoiseLayer />
      <LandmarksLayer />
      {noiseEver && <NoiseLayer />}
      {floodEver && <FloodZonesLayer />}
      {wildfireEver && <WildfireLayer />}
      {streetFloodingEver && !features.commercialUse && <StreetFloodingLayer />}
      <Suspense fallback={null}>
        {features.exclusions && <ExclusionLayer />}
        {features.exclusions && <ExclusionDraw />}
        {features.bestZones && (zonesOn || !features.onboarding) && <BestZones withBar={!features.onboarding} />}
      </Suspense>
      <SearchLayer />
      <Suspense fallback={null}>
        {features.idealistaPrices && <IdealistaPricesLayer />}
        {features.isochrone && <IsochroneLayer />}
      </Suspense>
      {transitReady && <MetroLayer />}
      {/* FGC's licence is not stated: off for commercial use (TODO-066) */}
      {transitReady && <FgcLayer />}
      {poiEver && <PoiLayer />}
      <Suspense fallback={null}>
        {features.pins && <PinAccuracyLayer />}
        {features.pins && <PinLayer />}
        {features.pins && <WalkabilityLayer />}
      </Suspense>
      <MapContextMenu />
    </MapContext.Provider>
  )
}
