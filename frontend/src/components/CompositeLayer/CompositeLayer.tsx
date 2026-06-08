import { useContext, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { loadBundles, loadPriceMap, loadOpenPriceMeta, type CellBundle } from '../../services/composite/compositeData'
import { computeComposite, type CompositeWeights, type OpenPriceBounds } from '../../services/composite/compositeScore'
import { buildScoreFillColorForRange } from './scoreRamp'
import { addLayerOrdered } from '../Map/layerOrder'

export const SOURCE_ID = 'composite-h3'
export const FILL_LAYER_ID = 'composite-fill'
export const GAP_LAYER_ID = 'composite-gap-outline'

interface ScoredFeature {
  type: 'Feature'
  geometry: GeoJSON.Polygon
  properties: {
    h3: string
    score: number
    hasGap: boolean
    poiScore: number
    noiseScore: number | null
    cityScore: number
    openPriceScore: number | null
    priceScore: number | null
  }
}

function buildGeoJSON(
  bundles: CellBundle[],
  priceMap: Map<string, number>,
  openPriceBounds: OpenPriceBounds,
  weights: ReturnType<typeof useStore.getState>['compositeWeights'],
  enabledLandmarkIds: readonly string[],
  priceRange: [number, number],
): GeoJSON.FeatureCollection {
  const features: ScoredFeature[] = bundles.map((b) => {
    const { score, hasGap, components } = computeComposite(
      { ...b, medianPrice: priceMap.get(b.h3) ?? null },
      weights,
      enabledLandmarkIds,
      priceRange,
      openPriceBounds,
    )
    return {
      type: 'Feature',
      geometry: b.geometry,
      properties: {
        h3: b.h3,
        score,
        hasGap,
        poiScore: components.poiAccess,
        noiseScore: components.noise,
        cityScore: components.cityCore,
        openPriceScore: components.openPrice,
        priceScore: components.price,
      },
    }
  })
  return { type: 'FeatureCollection', features }
}

function scoreRangeFilter(min: number, max: number): maplibregl.FilterSpecification {
  return ['all',
    ['>=', ['get', 'score'], min],
    ['<=', ['get', 'score'], max],
  ] as maplibregl.FilterSpecification
}

function gapFilter(min: number, max: number): maplibregl.FilterSpecification {
  return ['all',
    ['==', ['get', 'hasGap'], true],
    ['>=', ['get', 'score'], min],
    ['<=', ['get', 'score'], max],
  ] as maplibregl.FilterSpecification
}

function formatScore(v: number | null): string {
  return v === null ? '—' : String(v)
}

function buildBreakdownHTML(
  props: Record<string, unknown>,
  weights: CompositeWeights,
): string {
  const rows: string[] = []
  const row = (label: string, val: string) =>
    `<tr><td style="padding-right:8px;color:#888">${label}</td><td style="text-align:right">${val}</td></tr>`

  if (weights.poiAccess > 0)
    rows.push(row('POI Access', formatScore(props.poiScore as number)))
  if (weights.noise > 0)
    rows.push(row('Noise', formatScore(props.noiseScore as number | null)))
  if (weights.cityCore > 0)
    rows.push(row('City Core', formatScore(props.cityScore as number)))
  if (weights.openPrice > 0)
    rows.push(row('Market Price', formatScore(props.openPriceScore as number | null)))
  if (weights.price > 0)
    rows.push(row('Price (Idealista)', formatScore(props.priceScore as number | null)))

  if (rows.length === 0) return ''
  return `<table style="width:100%;border-collapse:collapse;margin-top:4px">${rows.join('')}</table>`
}

export function CompositeLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.compositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const scoreRange = useStore((s) => s.compositeScoreRange)

  const bundlesRef = useRef<CellBundle[] | null>(null)
  const priceMapRef = useRef<Map<string, number> | null>(null)
  const openPriceMetaRef = useRef<OpenPriceBounds | null>(null)
  const weightsRef = useRef<CompositeWeights>(weights)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => { weightsRef.current = weights }, [weights])

  // Lazy-load all data sources the first time the layer is enabled.
  useEffect(() => {
    if (!visible || bundlesRef.current) return
    let cancelled = false
    Promise.all([loadBundles(), loadPriceMap(), loadOpenPriceMeta()])
      .then(([bundles, priceMap, openPriceMeta]) => {
        if (cancelled) return
        bundlesRef.current = bundles
        priceMapRef.current = priceMap
        openPriceMetaRef.current = openPriceMeta
        setDataLoaded(true)
      })
      .catch((err) => console.error('Composite layer data failed to load', err))
    return () => { cancelled = true }
  }, [visible])

  // Add/update MapLibre source + layers whenever scores need recomputing.
  useEffect(() => {
    if (!map || !bundlesRef.current || !priceMapRef.current || !openPriceMetaRef.current) return
    const data = buildGeoJSON(
      bundlesRef.current,
      priceMapRef.current,
      openPriceMetaRef.current,
      weights,
      enabledLandmarkIds,
      priceRange,
    )

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(data)
    } else {
      const [sMin, sMax] = scoreRange
      map.addSource(SOURCE_ID, { type: 'geojson', data })

      addLayerOrdered(map, {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: scoreRangeFilter(sMin, sMax),
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': buildScoreFillColorForRange(sMin, sMax, 'score'),
          'fill-opacity': 0.6,
        },
      }, FILL_LAYER_ID)

      addLayerOrdered(map, {
        id: GAP_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: gapFilter(sMin, sMax),
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.7 },
      }, GAP_LAYER_ID)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dataLoaded, weights, enabledLandmarkIds, priceRange])

  // Update fill-color expression + filters when score range changes.
  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return
    const [sMin, sMax] = scoreRange
    map.setPaintProperty(
      FILL_LAYER_ID,
      'fill-color',
      buildScoreFillColorForRange(sMin, sMax, 'score'),
    )
    map.setFilter(FILL_LAYER_ID, scoreRangeFilter(sMin, sMax))
    map.setFilter(GAP_LAYER_ID, gapFilter(sMin, sMax))
  }, [map, scoreRange, dataLoaded])

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
      const breakdown = buildBreakdownHTML(props, weightsRef.current)
      const gapNote = props.hasGap
        ? '<div style="color:#aaa;font-size:10px;margin-top:4px">⬤ Missing data for some components</div>'
        : ''
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:11px;line-height:1.5;min-width:130px">
             <strong>Composite: ${props.score}</strong>
             ${breakdown}${gapNote}
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
