import { useContext, useEffect } from 'react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'flood-zones-pmtiles'
export const FILL_LAYER_ID = 'flood-zones-fill'
export const LINE_LAYER_ID = 'flood-zones-line'
const PMTILES_URL = `pmtiles://${import.meta.env.BASE_URL}data/flood-zones.pmtiles`

/** ACA river flood zones by return period — most severe = darkest. Shared with the legend. */
export const FLOOD_ZONE_STYLES = [
  { zone: 't500', label: '500-year (low probability)', color: '#9ecae1' },
  { zone: 't100', label: '100-year (medium probability)', color: '#4292c6' },
  { zone: 't10', label: '10-year (high probability)', color: '#08306b' },
] as const

const ZONE_COLOR = [
  'match', ['get', 'zone'],
  ...FLOOD_ZONE_STYLES.flatMap((s) => [s.zone, s.color]),
  '#9ecae1',
] as maplibregl.ExpressionSpecification

// Zones are nested (T10 ⊂ T100 ⊂ T500): draw the most severe on top.
const ZONE_SORT_KEY = [
  'match', ['get', 'zone'], 't10', 3, 't100', 2, 1,
] as maplibregl.ExpressionSpecification

/** ACA river flood zones (T10 / T100 / T500) — feature 036. */
export function FloodZonesLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.floodLayerVisible)

  useEffect(() => {
    if (!map) return
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: PMTILES_URL,
        attribution: "Flood zones: ACA — Agència Catalana de l'Aigua",
      })
    }
    if (!map.getLayer(FILL_LAYER_ID)) {
      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'flood',
        layout: { visibility: 'none', 'fill-sort-key': ZONE_SORT_KEY },
        paint: { 'fill-color': ZONE_COLOR, 'fill-opacity': 0.55 },
      }, FILL_LAYER_ID)
    }
    if (!map.getLayer(LINE_LAYER_ID)) {
      addLayerOrdered(map, {
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'flood',
        layout: { visibility: 'none' },
        paint: { 'line-color': ZONE_COLOR, 'line-width': 0.6, 'line-opacity': 0.9 },
      }, LINE_LAYER_ID)
    }
    return () => {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return
    const vis = visible ? 'visible' : 'none'
    map.setLayoutProperty(FILL_LAYER_ID, 'visibility', vis)
    map.setLayoutProperty(LINE_LAYER_ID, 'visibility', vis)
  }, [map, visible])

  return null
}
