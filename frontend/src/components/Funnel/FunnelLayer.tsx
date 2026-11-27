import { useEffect, useRef } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { addLayerOrdered } from '../Map/layerOrder'
import { useStore } from '../../store'
import { useFunnel } from '../../hooks/useFunnel'
import { NOT_IN_PLAY, STILL_IN } from '../../services/funnel/funnel'

// "Find your one building" (TODO-076): every building that takes part as a dot. The ones still in play are bright,
// the ones a pick dropped are grey, the winner is the largest. The map fits the buildings left once there are few.
const FUNNEL_SOURCE = 'funnel'
const FUNNEL_OUT_LAYER = 'funnel-out'
const FUNNEL_IN_LAYER = 'funnel-in'
const FUNNEL_WINNER_LAYER = 'funnel-winner'
const LAYERS = [FUNNEL_OUT_LAYER, FUNNEL_IN_LAYER, FUNNEL_WINNER_LAYER]
/** Fit the map to the buildings left when there are at most this many. */
const FIT_MAX = 500
/** Room for the panel on the left when fitting. */
const FIT_PADDING = { top: 60, bottom: 60, left: 460, right: 60 }

const radius = (z11: number, z16: number): maplibregl.ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], 11, z11, 16, z16]

function addLayers(map: maplibregl.Map) {
  addLayerOrdered(map, {
    id: FUNNEL_OUT_LAYER, type: 'circle', source: FUNNEL_SOURCE, filter: ['!=', ['get', 's'], STILL_IN],
    paint: { 'circle-radius': radius(1.2, 3.5), 'circle-color': '#495057', 'circle-opacity': 0.45 },
  }, FUNNEL_OUT_LAYER)
  addLayerOrdered(map, {
    id: FUNNEL_IN_LAYER, type: 'circle', source: FUNNEL_SOURCE, filter: ['==', ['get', 's'], STILL_IN],
    paint: {
      'circle-radius': radius(2.5, 7), 'circle-color': '#e8590c',
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1,
    },
  }, FUNNEL_IN_LAYER)
  addLayerOrdered(map, {
    id: FUNNEL_WINNER_LAYER, type: 'circle', source: FUNNEL_SOURCE, filter: ['==', ['get', 'w'], 1],
    paint: {
      'circle-radius': radius(7, 13), 'circle-color': '#c92a2a',
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
    },
  }, FUNNEL_WINNER_LAYER)
}

function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(FUNNEL_SOURCE)) map.removeSource(FUNNEL_SOURCE)
}

export function FunnelLayer() {
  const map = useMap()
  const open = useStore((s) => s.funnelOpen)
  const { loaded, run, result } = useFunnel()
  const lastFit = useRef<number | null>(null)

  useEffect(() => {
    if (!map) return
    if (!open || !loaded || !run) {
      removeLayers(map)
      lastFit.current = null
      return
    }
    const { fd, buildings } = loaded
    const lng = buildings.cols.lng
    const lat = buildings.cols.lat
    const winner = result?.winner ?? -1
    const features: GeoJSON.Feature[] = []
    for (let k = 0; k < fd.rows.length; k++) {
      const s = run.outAt[k]
      if (s === NOT_IN_PLAY) continue
      const row = fd.rows[k]
      features.push({
        type: 'Feature', id: row,
        geometry: { type: 'Point', coordinates: [lng[row], lat[row]] },
        properties: { s, w: k === winner ? 1 : 0 },
      })
    }
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
    const source = map.getSource(FUNNEL_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) source.setData(data)
    else {
      map.addSource(FUNNEL_SOURCE, { type: 'geojson', data })
      addLayers(map)
    }

    const left = run.alive.length
    if (left <= FIT_MAX && left > 0 && lastFit.current !== left) {
      lastFit.current = left
      let w = 180, s = 90, e = -180, n = -90
      for (const k of run.alive) {
        const row = fd.rows[k]
        w = Math.min(w, lng[row]); e = Math.max(e, lng[row])
        s = Math.min(s, lat[row]); n = Math.max(n, lat[row])
      }
      map.fitBounds([[w, s], [e, n]], { padding: FIT_PADDING, maxZoom: 17, duration: 800 })
    }
  }, [map, open, loaded, run, result])

  useEffect(() => () => { if (map) removeLayers(map) }, [map])

  return null
}
