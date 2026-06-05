import { useContext, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import {
  loadLivabilityGrid,
  withIndex,
  type LivabilityGrid,
} from '../../services/livability/livabilityData'
import { cellNoiseScore } from '../../services/livability/livabilityScore'
import { LIVABILITY_FILL_COLOR } from './livabilityRamp'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'livability-h3'
export const LAYER_ID = 'livability-fill'

export function LivabilityLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.livabilityVisible)
  const considerNoise = useStore((s) => s.livabilityConsiderNoise)

  const gridRef = useRef<LivabilityGrid | null>(null)
  const [gridLoaded, setGridLoaded] = useState(false)

  // Lazy-load the static grid the first time the layer is switched on.
  useEffect(() => {
    if (!visible || gridRef.current) return
    let cancelled = false
    loadLivabilityGrid()
      .then((grid) => {
        if (cancelled) return
        gridRef.current = grid
        setGridLoaded(true)
      })
      .catch((err) => console.error('Livability grid failed to load', err))
    return () => {
      cancelled = true
    }
  }, [visible])

  // Add the source + fill layer once the grid is loaded; refresh data when "consider noise" flips.
  useEffect(() => {
    if (!map || !gridRef.current) return
    const data = withIndex(gridRef.current, considerNoise)

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
          'fill-color': LIVABILITY_FILL_COLOR,
          'fill-opacity': 0.55,
          'fill-outline-color': 'rgba(0,0,0,0.05)',
        },
      }, LAYER_ID)
    }
    // visibility handled in its own effect — excluded to avoid recomputing data on toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, gridLoaded, considerNoise])

  // Show / hide without removing the layer.
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible, gridLoaded])

  // Hover tooltip: per-cell index + factor breakdown.
  useEffect(() => {
    if (!map) return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })

    function onMove(e: maplibregl.MapLayerMouseEvent) {
      if (!map) return
      const props = e.features?.[0]?.properties
      if (!props) return
      map.getCanvas().style.cursor = 'pointer'
      const noise = cellNoiseScore(props.lden as number | null)
      const noiseText = noise === undefined ? 'n/a' : String(noise)
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.4">
             <strong>Livability ${props.index}</strong><br/>
             Walkability ${props.walk}<br/>
             Noise ${noiseText}
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

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (!map) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
