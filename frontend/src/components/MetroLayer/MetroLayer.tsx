import { useEffect } from 'react'
import { useMap } from '../Map/MapContext'

const SOURCE_ID = 'bcn-metro'
const LAYER_CIRCLE = 'metro-circles'
const LAYER_LABEL = 'metro-labels'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// Fetch BCN metro route relations + their station nodes in one call
const OVERPASS_QUERY = `[out:json][timeout:60];
rel["type"="route"]["route"="subway"]["network"="Metro de Barcelona"]->.lines;
node(r.lines)["railway"="station"]->.stations;
(.lines;.stations;);
out body;`

// Fallback colors by line ref when OSM colour tag is absent
const LINE_COLORS: Record<string, string> = {
  L1: '#cc1a1a', L2: '#8a2a7a', L3: '#2a7a50', L4: '#c8a800',
  L5: '#1a2e6a', L6: '#8a5aa0', L7: '#8a5aa0', L8: '#d04a8a',
  L9: '#c87020', L9N: '#c87020', L9S: '#c87020',
  L10: '#1a70b0', L10N: '#1a70b0', L10S: '#1a70b0',
  L11: '#7ab035',
}
const FALLBACK_COLOR = '#888888'

interface OverpassRelation {
  type: 'relation'
  id: number
  tags?: Record<string, string>
  members: Array<{ type: string; ref: number; role: string }>
}
interface OverpassNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}
type OverpassElement = OverpassRelation | OverpassNode

async function fetchStations(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(OVERPASS_URL, { method: 'POST', body: OVERPASS_QUERY })
  const data: { elements: OverpassElement[] } = await res.json()

  const relations = data.elements.filter((el): el is OverpassRelation => el.type === 'relation')
  const nodes     = data.elements.filter((el): el is OverpassNode     => el.type === 'node')

  // Build nodeId → line color from route relations
  const nodeColors = new Map<number, string>()
  for (const rel of relations) {
    const lineRef = rel.tags?.ref?.toUpperCase() ?? ''
    const color = rel.tags?.colour ?? rel.tags?.color ?? LINE_COLORS[lineRef] ?? FALLBACK_COLOR
    for (const member of rel.members) {
      if (member.type === 'node' && !nodeColors.has(member.ref)) {
        nodeColors.set(member.ref, color)
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features: nodes.map((node) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [node.lon, node.lat] },
      properties: {
        name: node.tags?.name ?? '',
        color: nodeColors.get(node.id) ?? FALLBACK_COLOR,
      },
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
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 3],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8,
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
        if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL)
        if (map.getLayer(LAYER_CIRCLE)) map.removeLayer(LAYER_CIRCLE)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map may already be destroyed */ }
    }
  }, [map])

  return null
}
