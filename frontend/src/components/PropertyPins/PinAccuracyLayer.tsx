import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { usePinsStore } from '../../store/pinsStore'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

const SOURCE_ID = 'pin-accuracy'
const FILL_LAYER = 'pin-accuracy-fill'
const LINE_LAYER = 'pin-accuracy-line'

function buildData(pins: ReturnType<typeof usePinsStore.getState>['pins']): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: pins
      .filter((p) => p.accuracyPolygon != null)
      .map((p) => ({
        type: 'Feature',
        geometry: p.accuracyPolygon!,
        properties: { id: p.id },
      })),
  }
}

export function PinAccuracyLayer() {
  const map = useMap()
  const { pins } = usePinsStore()

  // Setup source and layers once map is ready
  useEffect(() => {
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: buildData(pins),
    })

    map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': '#228be6',
        'fill-opacity': 0.12,
      },
    })

    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': '#228be6',
        'line-width': 1.5,
        'line-opacity': 0.5,
        'line-dasharray': [4, 3],
      },
    })

    return () => {
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
      if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when pins change
  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData?.(buildData(pins))
  }, [map, pins])

  return null
}
