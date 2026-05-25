import { useEffect } from 'react'
import { useMap } from '../Map/MapContext'

const APP_ID  = import.meta.env.VITE_TMB_APP_ID  as string | undefined
const APP_KEY = import.meta.env.VITE_TMB_APP_KEY as string | undefined
const TMB_BASE = 'https://api.tmb.cat/v1/transit'

const SOURCE_LINES    = 'tmb-metro-lines'
const SOURCE_STATIONS = 'tmb-metro-stations'
const LAYER_LINES     = 'metro-lines'
const LAYER_CIRCLES   = 'metro-circles'
const LAYER_LABELS    = 'metro-labels'

const LINE_REF_RE = /L\d+[NS]?/g

function tmbUrl(path: string): string {
  return `${TMB_BASE}${path}?app_id=${APP_ID}&app_key=${APP_KEY}`
}

async function fetchGeoJson(path: string): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(tmbUrl(path))
  return res.json() as Promise<GeoJSON.FeatureCollection>
}

// Parse PICTO like "L2L3L4" → ["L2", "L3", "L4"]
function pictoLines(picto: string): string[] {
  return picto.match(LINE_REF_RE) ?? []
}

export function MetroLayer() {
  const map = useMap()

  useEffect(() => {
    if (!map || !APP_ID || !APP_KEY) return
    let cancelled = false

    Promise.all([
      fetchGeoJson('/linies/metro'),
      fetchGeoJson('/estacions'),
    ])
      .then(([linesRaw, stationsRaw]) => {
        if (cancelled || map.getSource(SOURCE_LINES)) return

        // Build lineRef → official color from TMB lines data
        const lineColor = new Map<string, string>()
        for (const f of linesRaw.features) {
          const ref   = f.properties?.NOM_LINIA as string
          const color = '#' + (f.properties?.COLOR_LINIA as string ?? '888888')
          if (ref) lineColor.set(ref, color)
        }

        // Attach color to each line feature
        const linesGeoJson: GeoJSON.FeatureCollection = {
          ...linesRaw,
          features: linesRaw.features.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              color: '#' + (f.properties?.COLOR_LINIA as string ?? '888888'),
            },
          })),
        }

        // Attach color to each station feature (first line from PICTO)
        const stationsGeoJson: GeoJSON.FeatureCollection = {
          ...stationsRaw,
          features: stationsRaw.features.map((f) => {
            const lines = pictoLines((f.properties?.PICTO as string) ?? '')
            const color = lines[0] ? (lineColor.get(lines[0]) ?? '#888888') : '#888888'
            return { ...f, properties: { ...f.properties, color } }
          }),
        }

        // Lines
        map.addSource(SOURCE_LINES, { type: 'geojson', data: linesGeoJson })
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

        // Stations
        map.addSource(SOURCE_STATIONS, { type: 'geojson', data: stationsGeoJson })
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
            'text-field': ['get', 'NOM_ESTACIO'],
            'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 10,
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
          minzoom: 14,
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
