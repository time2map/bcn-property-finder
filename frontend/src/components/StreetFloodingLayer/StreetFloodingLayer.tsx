import { useContext, useEffect } from 'react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'street-flooding-pmtiles'
export const FILL_LAYER_ID = 'street-flooding-fill'
const PMTILES_URL = `pmtiles://${import.meta.env.BASE_URL}data/street-flooding.pmtiles`

/**
 * Water depth classes (pipeline `depth_class`). Magenta scale on purpose: river flood zones are blue,
 * and the two datasets must never be confused. Shared with the legend.
 */
export const STREET_DEPTH_STYLES = [
  { cls: 1, label: '10–30 cm', color: '#fcc5c0' },
  { cls: 2, label: '30–50 cm', color: '#f768a1' },
  { cls: 3, label: '> 50 cm', color: '#ae017e' },
] as const

const DEPTH_COLOR = [
  'match', ['get', 'class'],
  ...STREET_DEPTH_STYLES.flatMap((s) => [s.cls, s.color]),
  '#fcc5c0',
] as unknown as maplibregl.ExpressionSpecification

const rpFilter = (rp: string) => ['==', ['get', 'rp'], rp] as maplibregl.FilterSpecification

/** RESCCUE street flooding depth in heavy rain (T10 / T100) — feature 037. */
export function StreetFloodingLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.streetFloodingLayerVisible)
  const rp = useStore((s) => s.streetFloodingReturnPeriod)

  useEffect(() => {
    if (!map) return
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: PMTILES_URL,
        attribution:
          'Street flooding: RESCCUE model (BCASA / Aquatec) · Atles de resiliència, Ajuntament de Barcelona',
      })
    }
    if (!map.getLayer(FILL_LAYER_ID)) {
      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'street',
        filter: rpFilter(useStore.getState().streetFloodingReturnPeriod),
        layout: { visibility: 'none', 'fill-sort-key': ['get', 'class'] },
        paint: { 'fill-color': DEPTH_COLOR, 'fill-opacity': 0.8 },
      }, FILL_LAYER_ID)
    }
    return () => {
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return
    map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
    map.setFilter(FILL_LAYER_ID, rpFilter(rp))
  }, [map, visible, rp])

  return null
}
