import { useContext, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { loadBundles, loadPriceMap, type CellBundle } from '../../services/composite/compositeData'
import { computeComposite } from '../../services/composite/compositeScore'
import { buildScoreFillColor } from './scoreRamp'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'composite-h3'
export const FILL_LAYER_ID = 'composite-fill'
export const GAP_LAYER_ID = 'composite-gap-outline'

const FILL_COLOR = buildScoreFillColor('score')

interface ScoredFeature {
  type: 'Feature'
  geometry: GeoJSON.Polygon
  properties: { h3: string; score: number; hasGap: boolean }
}

function buildGeoJSON(
  bundles: CellBundle[],
  priceMap: Map<string, number>,
  weights: ReturnType<typeof useStore.getState>['compositeWeights'],
  enabledLandmarkIds: readonly string[],
  priceRange: [number, number],
): GeoJSON.FeatureCollection {
  const features: ScoredFeature[] = bundles.map((b) => {
    const { score, hasGap } = computeComposite(
      { ...b, medianPrice: priceMap.get(b.h3) ?? null },
      weights,
      enabledLandmarkIds,
      priceRange,
    )
    return {
      type: 'Feature',
      geometry: b.geometry,
      properties: { h3: b.h3, score, hasGap },
    }
  })
  return { type: 'FeatureCollection', features }
}

export function CompositeLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.compositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const priceRange = useStore((s) => s.idealistaPriceRange)

  const bundlesRef = useRef<CellBundle[] | null>(null)
  const priceMapRef = useRef<Map<string, number> | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Lazy-load both data sources the first time the layer is enabled.
  useEffect(() => {
    if (!visible || bundlesRef.current) return
    let cancelled = false
    Promise.all([loadBundles(), loadPriceMap()])
      .then(([bundles, priceMap]) => {
        if (cancelled) return
        bundlesRef.current = bundles
        priceMapRef.current = priceMap
        setDataLoaded(true)
      })
      .catch((err) => console.error('Composite layer data failed to load', err))
    return () => { cancelled = true }
  }, [visible])

  // Add/update MapLibre source + layers whenever any input changes.
  useEffect(() => {
    if (!map || !bundlesRef.current || !priceMapRef.current) return
    const data = buildGeoJSON(
      bundlesRef.current,
      priceMapRef.current,
      weights,
      enabledLandmarkIds,
      priceRange,
    )

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(data)
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data })

      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': FILL_COLOR,
          'fill-opacity': 0.6,
        },
      }, FILL_LAYER_ID)

      addLayerOrdered(map, {
        id: GAP_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'hasGap'], true] as maplibregl.FilterSpecification,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.7 },
      }, GAP_LAYER_ID)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dataLoaded, weights, enabledLandmarkIds, priceRange])

  // Visibility toggle without removing layers.
  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return
    const vis = visible ? 'visible' : 'none'
    map.setLayoutProperty(FILL_LAYER_ID, 'visibility', vis)
    map.setLayoutProperty(GAP_LAYER_ID, 'visibility', vis)
  }, [map, visible, dataLoaded])

  // Hover tooltip.
  useEffect(() => {
    if (!map) return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })

    function onMove(e: maplibregl.MapLayerMouseEvent) {
      if (!map) return
      const props = e.features?.[0]?.properties
      if (!props) return
      map.getCanvas().style.cursor = 'pointer'
      const gapNote = props.hasGap
        ? '<br/><span style="color:#888;font-size:10px">⬤ Missing data for some components</span>'
        : ''
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.4">
             <strong>Composite Score ${props.score}</strong>${gapNote}
           </div>`,
        )
        .addTo(map)
    }
    function onLeave() {
      if (!map) return
      map.getCanvas().style.cursor = ''
      popup.remove()
    }

    map.on('mousemove', FILL_LAYER_ID, onMove)
    map.on('mouseleave', FILL_LAYER_ID, onLeave)
    return () => {
      map.off('mousemove', FILL_LAYER_ID, onMove)
      map.off('mouseleave', FILL_LAYER_ID, onLeave)
      popup.remove()
    }
  }, [map])

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (!map) return
      if (map.getLayer(GAP_LAYER_ID)) map.removeLayer(GAP_LAYER_ID)
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
