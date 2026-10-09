import { useEffect, useRef } from 'react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'best-zones'
export const FILL_LAYER_ID = 'best-zones-fill'
const LINE_LAYER_ID = 'best-zones-line'
const LABEL_LAYER_ID = 'best-zones-label'
const COLOR = '#6741d9'

const HOVER: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]

function buildSourceData(zones: Polygon[], labels: number[]): FeatureCollection {
  const features: Feature[] = zones.map((geometry, i) => ({
    type: 'Feature',
    id: i,
    properties: { label: String(labels[i] ?? i + 1) },
    geometry,
  }))
  return { type: 'FeatureCollection', features }
}

function idealistaLink(url: string, n: number | string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.textContent = `Open zone ${n} in Idealista ↗`
  a.style.fontWeight = '600'
  return a
}

/**
 * Best zones (feature 038) on the map: dashed outline + light fill + number. Hover highlights a
 * zone; click opens a popup with its Idealista search link.
 */
export function BestZonesLayer({ zones, urls, labels }: { zones: Polygon[]; urls: string[]; labels: number[] }) {
  const map = useMap()
  const urlsRef = useRef(urls)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  useEffect(() => { urlsRef.current = urls }, [urls])

  useEffect(() => {
    if (!map) return

    map.addSource(SOURCE_ID, { type: 'geojson', data: buildSourceData([], []) })
    addLayerOrdered(map, {
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': COLOR, 'fill-opacity': ['case', HOVER, 0.22, 0.08] },
    }, FILL_LAYER_ID)
    addLayerOrdered(map, {
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': COLOR, 'line-width': ['case', HOVER, 4, 2.5], 'line-dasharray': [2, 1] },
    }, LINE_LAYER_ID)
    addLayerOrdered(map, {
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 18,
        // Zone numbers matter more than landmark/metro labels — never hide them on collision.
        'text-allow-overlap': true,
      },
      paint: { 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    }, LABEL_LAYER_ID)

    let hovered: number | null = null
    const setHover = (id: number | null) => {
      if (hovered !== null) map.setFeatureState({ source: SOURCE_ID, id: hovered }, { hover: false })
      if (id !== null) map.setFeatureState({ source: SOURCE_ID, id }, { hover: true })
      hovered = id
    }
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      if (typeof id === 'number' && id !== hovered) setHover(id)
    }
    const onLeave = () => setHover(null)
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      const url = typeof id === 'number' ? urlsRef.current[id] : undefined
      if (!url) return
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ offset: 8 })
        .setLngLat(e.lngLat)
        .setDOMContent(idealistaLink(url, e.features?.[0]?.properties?.label ?? (id as number) + 1))
        .addTo(map)
    }
    map.on('mousemove', FILL_LAYER_ID, onMove)
    map.on('mouseleave', FILL_LAYER_ID, onLeave)
    map.on('click', FILL_LAYER_ID, onClick)

    return () => {
      try {
        popupRef.current?.remove()
        map.off('mousemove', FILL_LAYER_ID, onMove)
        map.off('mouseleave', FILL_LAYER_ID, onLeave)
        map.off('click', FILL_LAYER_ID, onClick)
        for (const id of [LABEL_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID]) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    popupRef.current?.remove()
    ;(map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(buildSourceData(zones, labels))
  }, [map, zones, labels])

  return null
}
