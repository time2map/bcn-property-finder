import { useEffect } from 'react'
import { useMap } from '../Map/MapContext'

const SOURCE_LINES    = 'fgc-lines'
const SOURCE_STATIONS = 'fgc-stations'
const LAYER_LINES     = 'fgc-line'
const LAYER_CIRCLES   = 'fgc-circle'
const LAYER_LABELS    = 'fgc-label'

export function FgcLayer() {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    let cancelled = false

    Promise.all([
      fetch('/fgc-lines.geojson').then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      fetch('/fgc-stations.geojson').then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
    ])
      .then(([lines, stations]) => {
        if (cancelled || map.getSource(SOURCE_LINES)) return

        map.addSource(SOURCE_LINES, { type: 'geojson', data: lines })
        map.addLayer({
          id: LAYER_LINES,
          type: 'line',
          source: SOURCE_LINES,
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3],
            'line-opacity': 0.6,
          },
          minzoom: 10,
        })

        map.addSource(SOURCE_STATIONS, { type: 'geojson', data: stations })
        map.addLayer({
          id: LAYER_CIRCLES,
          type: 'circle',
          source: SOURCE_STATIONS,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 4],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
          minzoom: 10,
        })
        map.addLayer({
          id: LAYER_LABELS,
          type: 'symbol',
          source: SOURCE_STATIONS,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 9,
            'text-offset': [0, 1.0],
            'text-anchor': 'top',
            'text-max-width': 8,
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-opacity': 0.9,
          },
          minzoom: 12.4,
        })
      })
      .catch(() => { /* fail silently — non-critical overlay */ })

    return () => {
      cancelled = true
      try {
        if (map.getLayer(LAYER_LABELS))  map.removeLayer(LAYER_LABELS)
        if (map.getLayer(LAYER_CIRCLES)) map.removeLayer(LAYER_CIRCLES)
        if (map.getLayer(LAYER_LINES))   map.removeLayer(LAYER_LINES)
        if (map.getSource(SOURCE_STATIONS)) map.removeSource(SOURCE_STATIONS)
        if (map.getSource(SOURCE_LINES))    map.removeSource(SOURCE_LINES)
      } catch { /* map may already be destroyed */ }
    }
  }, [map])

  return null
}
