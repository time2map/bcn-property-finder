import { useContext, useEffect } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { useBuildingData } from '../../hooks/useBuildingData'
import { loadBuildingDetail } from '../../services/buildings/buildingDetail'
import { ldenColorExpression } from '../../services/noise/noisePalette'
import { addLayerOrdered } from '../Map/layerOrder'

// Noise next to each facade of the selected building (TODO-046): one circle per side × direction, coloured
// with the official noise palette, at the measurement point 3 m from the wall.
export const FACADES_SOURCE_ID = 'building-facades'
export const FACADES_LAYER_ID = 'building-facades-circles'

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function FacadeNoiseLayer() {
  const map = useContext(MapContext)
  const selected = useStore((s) => s.selectedBuilding)
  const data = useBuildingData(selected !== null)

  useEffect(() => {
    if (!map) return
    if (!map.getSource(FACADES_SOURCE_ID)) {
      map.addSource(FACADES_SOURCE_ID, { type: 'geojson', data: EMPTY })
      addLayerOrdered(map, {
        id: FACADES_LAYER_ID,
        type: 'circle',
        source: FACADES_SOURCE_ID,
        minzoom: 15,
        paint: {
          'circle-color': ldenColorExpression(['get', 'lden']),
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      }, FACADES_LAYER_ID)
    }
    const source = map.getSource(FACADES_SOURCE_ID) as maplibregl.GeoJSONSource
    if (selected === null || !data) {
      source.setData(EMPTY)
      return
    }
    let cancelled = false
    loadBuildingDetail(selected, data.cols.lng[selected], data.cols.lat[selected])
      .then(({ facades }) => {
        if (cancelled) return
        source.setData({
          type: 'FeatureCollection',
          features: facades.map((f) => ({
            type: 'Feature',
            properties: { lden: f.lden, ln: f.ln ?? null, side: f.side, dir: f.dir },
            geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          })),
        })
      })
      .catch((err) => console.error('Facade noise failed to load', err))
    return () => { cancelled = true }
  }, [map, selected, data])

  useEffect(() => {
    return () => {
      if (!map) return
      if (map.getLayer(FACADES_LAYER_ID)) map.removeLayer(FACADES_LAYER_ID)
      if (map.getSource(FACADES_SOURCE_ID)) map.removeSource(FACADES_SOURCE_ID)
    }
  }, [map])

  return null
}
