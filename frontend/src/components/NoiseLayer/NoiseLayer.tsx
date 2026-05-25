import { useContext, useEffect } from 'react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'

const SOURCE_ID = 'noise-pmtiles'
const LAYER_ID = 'noise-overlay'
const PMTILES_URL = 'pmtiles:///data/noise.pmtiles'

// Color palette matching official Barcelona acoustic map (QGIS .qml style)
const LDEN_COLOR_STEP = [
  'step', ['get', 'lden'],
  '#b3e0f2',       // < 40
  40,  '#79c8e0',
  45,  '#a8d86e',
  50,  '#d4ed6a',
  55,  '#f5f500',
  60,  '#f5c800',
  65,  '#f57d00',
  70,  '#e02020',
  75,  '#d400d4',
  80,  '#0000c8',
] as maplibregl.ExpressionSpecification

export function NoiseLayer() {
  const map = useContext(MapContext)
  const { noiseLayerVisible } = useStore()

  useEffect(() => {
    if (!map) return

    function addLayer() {
      if (!map) return
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'vector',
          url: PMTILES_URL,
          attribution: 'Strategic Noise Map 2022 · Ajuntament de Barcelona · Open Data BCN',
        })
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          'source-layer': 'noise',
          filter: ['>', ['coalesce', ['get', 'lden'], 0], 0],
          layout: { visibility: 'none' },
          paint: {
            'fill-color': LDEN_COLOR_STEP,
            'fill-opacity': 0.6,
            'fill-outline-color': 'rgba(0,0,0,0.08)',
          },
        })
      }
    }

    // map from MapContext is set only after 'load' — always safe to call directly
    addLayer()

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  useEffect(() => {
    if (!map || !map.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', noiseLayerVisible ? 'visible' : 'none')
  }, [map, noiseLayerVisible])

  return null
}
