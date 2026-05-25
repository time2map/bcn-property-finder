import { useEffect, useRef } from 'react'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useStore } from '../../store'

const SOURCE_ID = 'isochrone'
const MASK_LAYER_ID = 'isochrone-mask'
const LINE_LAYER_ID = 'isochrone-line'
const LABEL_LAYER_ID = 'isochrone-label'

const WORLD_RING: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
]

function buildSourceData(
  polygon: Polygon | MultiPolygon | null,
  minutes: number,
): FeatureCollection {
  if (!polygon) return { type: 'FeatureCollection', features: [] }

  const holes =
    polygon.type === 'MultiPolygon'
      ? polygon.coordinates.map((poly) => poly[0])
      : [polygon.coordinates[0]]

  const mask: Feature = {
    type: 'Feature',
    properties: { layer: 'mask' },
    geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] },
  }

  const outline: Feature = {
    type: 'Feature',
    properties: { layer: 'outline', text: `${minutes} min from work` },
    geometry: polygon,
  }

  return { type: 'FeatureCollection', features: [mask, outline] }
}

export function IsochroneLayer() {
  const map = useMap()
  const resultPolygon = useStore((s) => s.resultPolygon)
  const minutes = useStore((s) => s.minutes)

  const resultPolygonRef = useRef(resultPolygon)
  resultPolygonRef.current = resultPolygon
  const minutesRef = useRef(minutes)
  minutesRef.current = minutes

  useEffect(() => {
    if (!map) return

    const setup = () => {
      if (map.getSource(SOURCE_ID)) return
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildSourceData(resultPolygonRef.current, minutesRef.current),
      })
      map.addLayer({
        id: MASK_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'layer'], 'mask'],
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'layer'], 'outline'],
        paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'layer'], 'outline'],
        layout: {
          'text-field': ['get', 'text'],
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 13,
          'symbol-placement': 'line',
          'symbol-spacing': 200,
          'text-offset': [0, -0.8],
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.4)',
          'text-halo-width': 1,
        },
      })
    }

    setup()

    return () => {
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID)
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData?.(buildSourceData(resultPolygon, minutes))
  }, [map, resultPolygon, minutes])

  return null
}
