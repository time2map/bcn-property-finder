import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useStore } from '../../store'
import { loadAreas, type AreaFeature } from '../../services/areas'
import { buildIdealistaUrl } from '../../services/idealista'
import { useIdealistaBaseUrlStore } from '../../store/idealistaBaseUrlStore'
import { addLayerOrdered } from '../Map/layerOrder'

const SOURCE_ID = 'barrio-boundaries'
const FILL_LAYER_ID = 'barrio-boundaries-fill'
const LINE_LAYER_ID = 'barrio-boundaries-line'
const LABEL_DISTRICT_ID = 'barrio-boundaries-label-district'
const LABEL_BARRI_ID = 'barrio-boundaries-label-barri'

interface ContextMenu {
  x: number
  y: number
  areaId: string
  name: string
}

/**
 * Renders barri / district / municipality boundaries as thin red outlines with small labels.
 * Right-click on any zone opens a context menu with "Open on Idealista".
 */
export function BarrioBoundariesLayer() {
  const map = useMap()
  const visible = useStore((s) => s.barrioBoundariesVisible)
  const baseUrl = useIdealistaBaseUrlStore((s) => s.baseUrl)
  const areasRef = useRef<AreaFeature[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  useEffect(() => {
    if (!map) return

    loadAreas().then((areas) => {
      areasRef.current = areas
      if (map.getSource(SOURCE_ID)) return

      const fc: FeatureCollection = {
        type: 'FeatureCollection',
        features: areas.map((a) => ({ ...a })),
      }
      map.addSource(SOURCE_ID, { type: 'geojson', data: fc })

      // Transparent fill — only for hit-testing on right-click
      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-opacity': 0 },
      }, FILL_LAYER_ID)

      // Thin red boundary lines
      addLayerOrdered(map, {
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#888888',
          'line-width': 0.8,
          'line-opacity': 0.7,
        },
      }, LINE_LAYER_ID)

      // Labels for districts and municipalities (visible from lower zoom)
      addLayerOrdered(map, {
        id: LABEL_DISTRICT_ID,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 10,
        filter: ['in', ['get', 'kind'], ['literal', ['district', 'municipality']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-anchor': 'center',
          'text-max-width': 8,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#444444',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
          'text-opacity': 0.85,
        },
      }, LABEL_DISTRICT_ID)

      // Labels for barris (only at higher zoom levels)
      addLayerOrdered(map, {
        id: LABEL_BARRI_ID,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 13,
        filter: ['==', ['get', 'kind'], 'barri'],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-anchor': 'center',
          'text-max-width': 6,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#555555',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
          'text-opacity': 0.8,
        },
      }, LABEL_BARRI_ID)
    })

    const handleContextMenu = (e: MapMouseEvent) => {
      if (!map.getLayer(FILL_LAYER_ID)) return
      const features = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })
      if (!features.length) return
      e.originalEvent.preventDefault()
      const f = features[0]
      const areaId = f.properties?.id as string
      const name = f.properties?.name as string
      const native = e.originalEvent as MouseEvent
      setContextMenu({ x: native.clientX, y: native.clientY, areaId, name })
    }

    map.on('contextmenu', handleContextMenu)

    return () => {
      map.off('contextmenu', handleContextMenu)
      try {
        if (map.getLayer(LABEL_BARRI_ID)) map.removeLayer(LABEL_BARRI_ID)
        if (map.getLayer(LABEL_DISTRICT_ID)) map.removeLayer(LABEL_DISTRICT_ID)
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  // Sync visibility
  useEffect(() => {
    if (!map) return
    const v = visible ? 'visible' : 'none'
    const layers = [LINE_LAYER_ID, LABEL_DISTRICT_ID, LABEL_BARRI_ID]
    layers.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
    })
  }, [map, visible])

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    const handleClick = () => setContextMenu(null)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  function handleOpenIdealista() {
    const area = areasRef.current.find((a) => a.properties.id === contextMenu?.areaId)
    if (!area) return
    const url = buildIdealistaUrl(area.geometry as Polygon | MultiPolygon, baseUrl)
    window.open(url, '_blank', 'noopener,noreferrer')
    setContextMenu(null)
  }

  if (!contextMenu) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: 180,
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 11,
          color: '#888',
          padding: '5px 12px 4px',
          borderBottom: '1px solid #f0f0f0',
          userSelect: 'none',
        }}
      >
        {contextMenu.name}
      </div>
      <button
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '7px 12px',
          fontSize: 13,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#333',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        onClick={handleOpenIdealista}
      >
        Open on Idealista ↗
      </button>
    </div>,
    document.body,
  )
}
