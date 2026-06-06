import { useContext, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import {
  loadLivabilityGrid,
  type LivabilityGrid,
} from '../../services/livability/livabilityData'
import { buildScoreFillColor } from '../CompositeLayer/scoreRamp'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'poi-access-h3'
export const LAYER_ID = 'poi-access-fill'

const FILL_COLOR = buildScoreFillColor('walk')

export function PoiAccessLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.poiAccessVisible)

  const gridRef = useRef<LivabilityGrid | null>(null)
  const [gridLoaded, setGridLoaded] = useState(false)

  useEffect(() => {
    if (!visible || gridRef.current) return
    let cancelled = false
    loadLivabilityGrid()
      .then((grid) => {
        if (cancelled) return
        gridRef.current = grid
        setGridLoaded(true)
      })
      .catch((err) => console.error('POI Access grid failed to load', err))
    return () => { cancelled = true }
  }, [visible])

  useEffect(() => {
    if (!map || !gridRef.current) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(gridRef.current)
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: gridRef.current })
    }

    if (!map.getLayer(LAYER_ID)) {
      addLayerOrdered(map, {
        id: LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': FILL_COLOR,
          'fill-opacity': 0.55,
          'fill-outline-color': 'rgba(0,0,0,0.05)',
        },
      }, LAYER_ID)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, gridLoaded])

  useEffect(() => {
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible, gridLoaded])

  useEffect(() => {
    if (!map) return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })

    function onMove(e: maplibregl.MapLayerMouseEvent) {
      if (!map) return
      const props = e.features?.[0]?.properties
      if (!props) return
      map.getCanvas().style.cursor = 'pointer'
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.4">
             <strong>POI Access ${props.walk}</strong>
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

  useEffect(() => {
    return () => {
      if (!map) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
