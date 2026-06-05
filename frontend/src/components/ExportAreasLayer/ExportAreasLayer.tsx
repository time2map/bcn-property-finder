import { useEffect, useRef } from 'react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useIdealistaAreas } from '../../hooks/useIdealistaAreas'
import { useStore } from '../../store'
import { addLayerOrdered } from '../Map/layerOrder'

const SOURCE_ID = 'export-areas'
const FILL_LAYER_ID = 'export-areas-fill'
const LINE_LAYER_ID = 'export-areas-line'
const LABEL_LAYER_ID = 'export-areas-label'
const COLOR = '#6741d9'

// Stronger fill/outline when the area is hovered (in the panel link or on the map).
const HOVER = ['boolean', ['feature-state', 'hover'], false] as const

function areaLabel(i: number, total: number): string {
  return i === 0 ? 'Main' : total > 1 ? String(i + 1) : ''
}

function buildSourceData(areas: Polygon[]): FeatureCollection {
  const features: Feature[] = areas.map((geometry, i) => ({
    type: 'Feature',
    id: i,
    properties: { label: areaLabel(i, areas.length) },
    geometry,
  }))
  return { type: 'FeatureCollection', features }
}

/**
 * Outlines the decomposed Idealista export areas on the map, numbered to match the
 * "Area k/N" links — so the user sees exactly what each search link covers. Hovering a
 * link (or the area itself) highlights the matching area, both ways.
 */
export function ExportAreasLayer() {
  const map = useMap()
  const { areas } = useIdealistaAreas()
  const zonesVisible = useStore((s) => s.idealistaZonesVisible)
  const hoveredAreaIndex = useStore((s) => s.hoveredAreaIndex)
  const setHoveredAreaIndex = useStore((s) => s.setHoveredAreaIndex)
  const appliedHoverRef = useRef<number | null>(null)

  useEffect(() => {
    if (!map) return

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: buildSourceData([]) })
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
        paint: {
          'line-color': COLOR,
          'line-width': ['case', HOVER, 4, 2],
          'line-dasharray': [2, 1],
        },
      }, LINE_LAYER_ID)
      addLayerOrdered(map, {
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 16,
        },
        paint: {
          'text-color': COLOR,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      }, LABEL_LAYER_ID)
    }

    // Map → panel: hovering an area on the map highlights its link too.
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      if (typeof id === 'number') setHoveredAreaIndex(id)
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      setHoveredAreaIndex(null)
      map.getCanvas().style.cursor = ''
    }
    map.on('mousemove', FILL_LAYER_ID, onMove)
    map.on('mouseleave', FILL_LAYER_ID, onLeave)

    return () => {
      try {
        map.off('mousemove', FILL_LAYER_ID, onMove)
        map.off('mouseleave', FILL_LAYER_ID, onLeave)
        for (const id of [LABEL_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID]) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map, setHoveredAreaIndex])

  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    // When zones are hidden, push empty data so the layer renders nothing.
    source?.setData?.(buildSourceData(zonesVisible ? areas : []))
    // setData clears feature-state, so re-apply the active hover after the data swaps.
    appliedHoverRef.current = null
  }, [map, areas, zonesVisible])

  // Panel → map: reflect the hovered index onto the map via feature-state.
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_ID)) return
    const prev = appliedHoverRef.current
    if (prev !== null && prev !== hoveredAreaIndex) {
      try { map.setFeatureState({ source: SOURCE_ID, id: prev }, { hover: false }) } catch { /* gone */ }
    }
    if (hoveredAreaIndex !== null) {
      try { map.setFeatureState({ source: SOURCE_ID, id: hoveredAreaIndex }, { hover: true }) } catch { /* gone */ }
    }
    appliedHoverRef.current = hoveredAreaIndex
  }, [map, hoveredAreaIndex, areas])

  return null
}
