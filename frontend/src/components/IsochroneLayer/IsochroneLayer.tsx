import { useEffect } from 'react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useStore } from '../../store'

const SOURCE_ID = 'isochrone'
const FILL_LAYER_ID = 'isochrone-fill'
const MASK_LAYER_ID = 'isochrone-mask'

// A ring that covers the entire world, used as the outer boundary for the mask
const WORLD_RING: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
]

function buildSourceData(polygon: Polygon | null): FeatureCollection {
  if (!polygon) return { type: 'FeatureCollection', features: [] }

  const fill: Feature = {
    type: 'Feature',
    properties: { layer: 'fill' },
    geometry: polygon,
  }
  const mask: Feature = {
    type: 'Feature',
    properties: { layer: 'mask' },
    // Inverted polygon: world bbox with isochrone ring as a hole
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, polygon.coordinates[0]],
    },
  }
  return { type: 'FeatureCollection', features: [fill, mask] }
}

export function IsochroneLayer() {
  const map = useMap()
  const resultPolygon = useStore((s) => s.resultPolygon)

  // Set up source and layers once the map style is loaded
  useEffect(() => {
    if (!map) return

    const setup = () => {
      if (map.getSource(SOURCE_ID)) return
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildSourceData(null),
      })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'layer'], 'fill'],
        paint: { 'fill-color': '#2f9e44', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: MASK_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'layer'], 'mask'],
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.45 },
      })
    }

    if (map.isStyleLoaded()) {
      setup()
    } else {
      map.once('load', setup)
    }

    return () => {
      try {
        if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  // Update source data whenever the polygon changes
  useEffect(() => {
    if (!map) return

    const update = () => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      source?.setData?.(buildSourceData(resultPolygon))
    }

    if (map.isStyleLoaded()) {
      update()
    } else {
      map.once('load', update)
      return () => { map.off('load', update) }
    }
  }, [map, resultPolygon])

  return null
}
