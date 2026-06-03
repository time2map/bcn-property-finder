import { useEffect } from 'react'
import type { Feature, FeatureCollection } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { useExclusionsStore } from '../../store/exclusionsStore'
import type { ExclusionZone } from '../../types/exclusions'

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

/** Renders all exclusion ("no-go") zones as a red semi-transparent fill + outline. */
export function ExclusionLayer() {
  const map = useMap()
  const zones = useExclusionsStore((s) => s.zones)

  useEffect(() => {
    if (!map) return

    if (!map.getSource(SOURCE_ID)) {
      // Start empty; the data effect below fills it (and keeps it in sync with zones).
      map.addSource(SOURCE_ID, { type: 'geojson', data: buildSourceData([]) })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#E03131', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#E03131', 'line-width': 1.5, 'line-opacity': 0.9 },
      })
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

  return null
}
