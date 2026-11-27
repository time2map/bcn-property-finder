import i18n from '../../i18n'
import { formatNumber } from '../../i18n/format'
import { useEffect } from 'react'
import type { FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { addLayerOrdered } from '../Map/layerOrder'
import { ensureHatchImages, HATCH_WIDE } from '../Map/hatchPattern'
import { useStore } from '../../store'
import { hasConditions } from '../../services/composite/compositeScore'
import { useAreaJoin } from '../../hooks/useAreaJoin'
import { useStartAreaRanks } from '../../hooks/useStartAreaRanks'
import { buildStateColorForRange } from '../BuildingsLayer/scoreRamp'
import { AREA_VIEW_MAX_ZOOM } from '../../services/areas/areaRank'
import { selectAreaFeature } from '../../services/areas/areaSelect'
import { MAP_TEXT_FONT } from '../Map/mapFont'

// Area view (TODO-051): below z13 the map shows the barris and municipalities coloured by the mean score of
// their homes, instead of 174k dots. From z13 the buildings take over.
export const AREAS_SOURCE_ID = 'areas'
export const AREAS_FILL_ID = 'areas-fill'
/** Wide diagonal hatch over the areas with many incomplete-data homes (060). */
export const AREAS_HATCH_ID = 'areas-hatch'
export const AREAS_LINE_ID = 'areas-line'
export const AREAS_LABEL_ID = 'areas-label'
const LAYER_IDS = [AREAS_FILL_ID, AREAS_HATCH_ID, AREAS_LINE_ID, AREAS_LABEL_ID]

/** "1,240" — fixed grouping, the same text in every locale. */
const group = (n: number) => formatNumber(n, { maximumFractionDigits: 0 })

export function AreasLayer() {
  const map = useMap()
  const join = useAreaJoin()
  useStartAreaRanks()
  // Hidden while the funnel (TODO-076) is open: it draws its own buildings.
  const visible = useStore((s) => s.compositeVisible && !s.funnelOpen && hasConditions(s.compositeWeights, s.compositeRiskStrengths))
  const ranks = useStore((s) => s.areaRanks)
  const range = useStore((s) => s.compositeColorRange)

  // Source and layers, once the polygons are matched to the areas of the score data.
  useEffect(() => {
    if (!map || !join || map.getSource(AREAS_SOURCE_ID)) return
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: [...join].map(([index, f]) => ({ ...f, id: index, properties: { ...f.properties, areaIndex: index } })),
    }
    map.addSource(AREAS_SOURCE_ID, { type: 'geojson', data })
    const layout = { visibility: visible ? 'visible' : 'none' } as const
    const base = { source: AREAS_SOURCE_ID, maxzoom: AREA_VIEW_MAX_ZOOM }
    addLayerOrdered(map, {
      ...base, id: AREAS_FILL_ID, type: 'fill', layout,
      paint: { 'fill-color': buildStateColorForRange(...useStore.getState().compositeColorRange), 'fill-opacity': 0.75 },
    }, AREAS_FILL_ID)
    ensureHatchImages(map)
    addLayerOrdered(map, {
      ...base, id: AREAS_HATCH_ID, type: 'fill', layout,
      paint: {
        'fill-pattern': HATCH_WIDE.id,
        'fill-opacity': ['case', ['boolean', ['feature-state', 'incomplete'], false], 1, 0],
      },
    }, AREAS_HATCH_ID)
    addLayerOrdered(map, {
      ...base, id: AREAS_LINE_ID, type: 'line', layout,
      paint: { 'line-color': '#4b5563', 'line-width': 0.8, 'line-opacity': 0.55 },
    }, AREAS_LINE_ID)
    addLayerOrdered(map, {
      ...base, id: AREAS_LABEL_ID, type: 'symbol',
      layout: { ...layout, 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': MAP_TEXT_FONT },
      paint: { 'text-color': '#1f2937', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
    }, AREAS_LABEL_ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, join])

  // Mean (max) score and the incomplete-data mark of every area → feature state (the same ramp as the buildings).
  useEffect(() => {
    if (!map || !join || !ranks || !map.getSource(AREAS_SOURCE_ID)) return
    for (const r of ranks) {
      if (join.has(r.index)) map.setFeatureState({ source: AREAS_SOURCE_ID, id: r.index }, { score: r.mean, incomplete: r.incomplete })
    }
    if (performance.getEntriesByName('areas-colored').length === 0) performance.mark('areas-colored')
  }, [map, join, ranks])

  // Boost contrast changes the colour range of the buildings; the areas follow.
  useEffect(() => {
    if (!map || !map.getLayer(AREAS_FILL_ID)) return
    map.setPaintProperty(AREAS_FILL_ID, 'fill-color', buildStateColorForRange(range[0], range[1]))
  }, [map, range, join])

  // Hidden together with the index.
  useEffect(() => {
    if (!map || !map.getLayer(AREAS_FILL_ID)) return
    for (const id of LAYER_IDS) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible, join])

  // Hover: "62% good match · 1,240 homes"; click: fly to the area and outline it, like the list does.
  useEffect(() => {
    if (!map || !join) return
    let popup: maplibregl.Popup | null = null
    const hide = () => { popup?.remove(); popup = null }
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      if (typeof id !== 'number') return
      const rank = useStore.getState().areaRanks?.find((r) => r.index === id)
      map.getCanvas().style.cursor = 'pointer'
      hide()
      if (!rank) return
      popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'match-tooltip' })
        .setLngLat(e.lngLat)
        .setText(i18n.t('panel:tip.area', { count: rank.n, name: rank.name, pct: Math.round(rank.shareGood), n: group(rank.n) }))
        .addTo(map)
    }
    const onLeave = () => { map.getCanvas().style.cursor = ''; hide() }
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      const feature = typeof id === 'number' ? join.get(id) : undefined
      if (feature) selectAreaFeature(feature, id as number)
    }
    map.on('mousemove', AREAS_FILL_ID, onMove)
    map.on('mouseleave', AREAS_FILL_ID, onLeave)
    map.on('click', AREAS_FILL_ID, onClick)
    return () => {
      hide()
      map.off('mousemove', AREAS_FILL_ID, onMove)
      map.off('mouseleave', AREAS_FILL_ID, onLeave)
      map.off('click', AREAS_FILL_ID, onClick)
    }
  }, [map, join])

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (!map) return
      try {
        for (const id of [...LAYER_IDS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(AREAS_SOURCE_ID)) map.removeSource(AREAS_SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  return null
}
