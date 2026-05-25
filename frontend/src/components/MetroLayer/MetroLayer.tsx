import { useEffect } from 'react'
import { useMap } from '../Map/MapContext'

const SOURCE_ID = 'bcn-metro'
const LAYER_CIRCLE = 'metro-circles'
const LAYER_LABEL = 'metro-labels'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OVERPASS_QUERY = `[out:json][timeout:25];
node["station"="subway"](41.20,1.85,41.60,2.40);
out body;`

interface OverpassNode {
  type: string
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

async function fetchStations(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(OVERPASS_URL, { method: 'POST', body: OVERPASS_QUERY })
  const data: { elements: OverpassNode[] } = await res.json()
  return {
    type: 'FeatureCollection',
    features: data.elements
      .filter((el) => el.type === 'node')
      .map((node) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [node.lon, node.lat] },
        properties: { name: node.tags?.name ?? '' },
      })),
  }
}

export function MetroLayer() {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    let cancelled = false

    fetchStations()
      .then((geojson) => {
        if (cancelled || map.getSource(SOURCE_ID)) return
        map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
        map.addLayer({
          id: LAYER_CIRCLE,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 8],
            'circle-color': '#b00000',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
          minzoom: 10,
        })
        map.addLayer({
          id: LAYER_LABEL,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-max-width': 8,
          },
          paint: {
            'text-color': '#7a0000',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
          minzoom: 12,
        })
      })
      .catch(() => { /* fail silently — non-critical overlay */ })

    return () => {
      cancelled = true
      try {
        if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL)
        if (map.getLayer(LAYER_CIRCLE)) map.removeLayer(LAYER_CIRCLE)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map may already be destroyed */ }
    }
  }, [map])

  return null
}
