import { useEffect } from 'react'
import type { Feature, FeatureCollection } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useExclusionsStore } from '../../store/exclusionsStore'
import type { ExclusionZone } from '../../types/exclusions'
import { addLayerOrdered } from '../Map/layerOrder'

const SOURCE_ID = 'exclusions'
const FILL_LAYER_ID = 'exclusion-fill'
const LINE_LAYER_ID = 'exclusion-line'

function buildSourceData(zones: ExclusionZone[]): FeatureCollection {
  const features: Feature[] = zones.map((z) => ({
    type: 'Feature',
    properties: { id: z.id, name: z.name },
    geometry: z.geometry,
  }))
  return { type: 'FeatureCollection', features }
}

/** Renders all exclusion ("no-go") zones as a dark semi-transparent fill + outline. */
export function ExclusionLayer() {
  const map = useMap()
  const zones = useExclusionsStore((s) => s.zones)
  const exclusionsVisible = useExclusionsStore((s) => s.exclusionsVisible)

  useEffect(() => {
    if (!map) return

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: buildSourceData([]) })
      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#555555', 'fill-opacity': 0.28 },
      }, FILL_LAYER_ID)
      addLayerOrdered(map, {
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#555555', 'line-width': 1.5, 'line-opacity': 0.8 },
      }, LINE_LAYER_ID)
    }

    return () => {
      try {
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // Map may have been destroyed already
      }
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData?.(buildSourceData(zones))
  }, [map, zones])

  useEffect(() => {
    if (!map) return
    const v = exclusionsVisible ? 'visible' : 'none'
    if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, 'visibility', v)
    if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, 'visibility', v)
  }, [map, exclusionsVisible])

  return null
}
