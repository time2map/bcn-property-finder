import { useContext, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import {
  loadCityCoreGrid,
  withCityCoreIndex,
  type CityCoreGrid,
} from '../../services/cityCore/cityCoreData'
import { LANDMARKS, SHAPE_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { landmarkScore } from '../../services/cityCore/cityCoreScore'
import { CITY_CORE_FILL_COLOR } from './cityCoreRamp'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'city-core-h3'
export const LAYER_ID = 'city-core-fill'
export const SHAPES_SOURCE_ID = 'city-core-shapes'
export const SHAPES_FILL_LAYER = 'city-core-shapes-fill'
export const SHAPES_LINE_LAYER = 'city-core-shapes-line'

export function CityCorAccessLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.cityCoreVisible)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)

  const gridRef = useRef<CityCoreGrid | null>(null)
  const [gridLoaded, setGridLoaded] = useState(false)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [geomMap, setGeomMap] = useState<Record<string, GeoJSON.Geometry> | null>(null)

  // Load real OSM geometries for polygon/line landmarks once on mount.
  useEffect(() => {
    fetch('/data/landmark-geometries.json')
      .then((r) => r.json())
      .then((data: Record<string, GeoJSON.Geometry>) => setGeomMap(data))
      .catch(() => { /* shapes simply won't render */ })
  }, [])

  // Lazy-load the static grid the first time the layer is switched on.
  useEffect(() => {
    if (!visible || gridRef.current) return
    let cancelled = false
    loadCityCoreGrid()
      .then((grid) => {
        if (cancelled) return
        gridRef.current = grid
        setGridLoaded(true)
      })
      .catch((err) => console.error('City core grid failed to load', err))
    return () => {
      cancelled = true
    }
  }, [visible])

  // Add the source + fill layer once loaded; refresh data when enabled landmarks change.
  useEffect(() => {
    if (!map || !gridRef.current) return
    const data = withCityCoreIndex(gridRef.current, enabledIds)

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(data)
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data })
    }

    if (!map.getLayer(LAYER_ID)) {
      addLayerOrdered(map, {
        id: LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': CITY_CORE_FILL_COLOR,
          'fill-opacity': 0.55,
          'fill-outline-color': 'rgba(0,0,0,0.05)',
        },
      }, LAYER_ID)
    }
    // visibility handled in its own effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, gridLoaded, enabledIds])

  // Show / hide without removing the layer.
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible, gridLoaded])

  // Landmark pin markers — one per enabled landmark while layer is visible.
  useEffect(() => {
    if (!map) return

    // Remove markers that are now disabled or hidden
    markersRef.current.forEach((marker, id) => {
      if (!visible || !enabledIds.includes(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    if (!visible) return

    // Add markers for newly-enabled landmarks
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
  }, [map, visible, enabledIds])

  // Hover tooltip: index + per-landmark breakdown.
  useEffect(() => {
    if (!map) return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })

    function onMove(e: maplibregl.MapLayerMouseEvent) {
      if (!map) return
      const props = e.features?.[0]?.properties
      if (!props) return
      map.getCanvas().style.cursor = 'pointer'

      const rows = LANDMARKS.map((lm) => {
        const mins = props[lm.id] as number | null
        const score = landmarkScore(mins)
        const minsText = mins === null || mins === undefined ? 'n/a' : `${mins} min`
        return `<tr>
          <td style="padding-right:6px">${lm.name}</td>
          <td style="padding-right:6px;color:#888">${minsText}</td>
          <td>${score}</td>
        </tr>`
      }).join('')

      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.5">
             <strong>City Core Access ${props.index}</strong>
             <table style="margin-top:4px;border-collapse:collapse">${rows}</table>
           </div>`,
        )
        .addTo(map)
    }
    function onLeave() {
      if (!map) return
      map.getCanvas().style.cursor = ''
      popup.remove()
    }

    map.on('mousemove', LAYER_ID, onMove)
    map.on('mouseleave', LAYER_ID, onLeave)
    return () => {
      map.off('mousemove', LAYER_ID, onMove)
      map.off('mouseleave', LAYER_ID, onLeave)
      popup.remove()
    }
  }, [map])

  // Shape outlines: blue polygon fills + dashed lines for polygon/line landmarks.
  useEffect(() => {
    if (!map) return

    const features: GeoJSON.Feature[] = (!visible || !geomMap)
      ? []
      : LANDMARKS
          .filter((lm) => enabledIds.includes(lm.id) && SHAPE_LANDMARK_IDS.has(lm.id) && geomMap[lm.id] != null)
          .map((lm) => ({
            type: 'Feature' as const,
            properties: { id: lm.id },
            geometry: geomMap[lm.id],
          }))

    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
    const shapesSource = map.getSource(SHAPES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (shapesSource) {
      shapesSource.setData(data)
      return
    }

    map.addSource(SHAPES_SOURCE_ID, { type: 'geojson', data })
    addLayerOrdered(map, {
      id: SHAPES_FILL_LAYER,
      type: 'fill',
      source: SHAPES_SOURCE_ID,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.07 },
    }, SHAPES_FILL_LAYER)
    addLayerOrdered(map, {
      id: SHAPES_LINE_LAYER,
      type: 'line',
      source: SHAPES_SOURCE_ID,
      paint: { 'line-color': '#3b82f6', 'line-width': 1.5, 'line-dasharray': [5, 3] },
    }, SHAPES_LINE_LAYER)
  }, [map, visible, enabledIds, geomMap])

  // Tear down layer, source, and markers on unmount.
  useEffect(() => {
    const markers = markersRef.current
    return () => {
      if (!map) return
      if (map.getLayer(SHAPES_LINE_LAYER)) map.removeLayer(SHAPES_LINE_LAYER)
      if (map.getLayer(SHAPES_FILL_LAYER)) map.removeLayer(SHAPES_FILL_LAYER)
      if (map.getSource(SHAPES_SOURCE_ID)) map.removeSource(SHAPES_SOURCE_ID)
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      markers.forEach((m) => m.remove())
      markers.clear()
    }
  }, [map])

  return null
}
