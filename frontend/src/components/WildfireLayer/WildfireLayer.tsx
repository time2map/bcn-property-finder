import { useContext, useEffect } from 'react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'wildfire-pmtiles'
export const HAZARD_LAYER_ID = 'wildfire-hazard-fill'
export const WUI_LAYER_ID = 'wildfire-wui-line'
const PMTILES_URL = `pmtiles://${import.meta.env.BASE_URL}data/wildfire.pmtiles`

/** Structural wildfire hazard classes 1 (low) – 10 (high), green → red. Shared with the legend. */
export const HAZARD_CLASS_COLORS = [
  '#1a9850', '#66bd63', '#a6d96a', '#d9ef8b', '#ffffbf',
  '#fee08b', '#fdae61', '#f46d43', '#d73027', '#a50026',
] as const
export const WUI_COLOR = '#7f2704'

const HAZARD_COLOR = [
  'match', ['get', 'class'],
  ...HAZARD_CLASS_COLORS.flatMap((c, i) => [i + 1, c]),
  '#cccccc',
] as maplibregl.ExpressionSpecification

/** Forest wildfire hazard 2024 + wildland–urban interface — feature 036. */
export function WildfireLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.wildfireLayerVisible)

  useEffect(() => {
    if (!map) return
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: PMTILES_URL,
        attribution:
          'Wildfire hazard 2024: Generalitat de Catalunya · WUI: Protecció Civil de Catalunya',
      })
    }
    if (!map.getLayer(HAZARD_LAYER_ID)) {
      addLayerOrdered(map, {
        id: HAZARD_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'hazard',
        layout: { visibility: 'none' },
        paint: { 'fill-color': HAZARD_COLOR, 'fill-opacity': 0.55 },
      }, HAZARD_LAYER_ID)
    }
    if (!map.getLayer(WUI_LAYER_ID)) {
      addLayerOrdered(map, {
        id: WUI_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'wui',
        layout: { visibility: 'none' },
        paint: { 'line-color': WUI_COLOR, 'line-width': 1.6, 'line-dasharray': [3, 2] },
      }, WUI_LAYER_ID)
    }
    return () => {
      if (map.getLayer(WUI_LAYER_ID)) map.removeLayer(WUI_LAYER_ID)
      if (map.getLayer(HAZARD_LAYER_ID)) map.removeLayer(HAZARD_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  useEffect(() => {
    if (!map || !map.getLayer(HAZARD_LAYER_ID)) return
    const vis = visible ? 'visible' : 'none'
    map.setLayoutProperty(HAZARD_LAYER_ID, 'visibility', vis)
    map.setLayoutProperty(WUI_LAYER_ID, 'visibility', vis)
  }, [map, visible])

  return null
}
