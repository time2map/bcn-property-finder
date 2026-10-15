import { useContext, useEffect, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { loadBundles, loadOpenPriceMeta, type CellBundle } from '../../services/composite/compositeData'
import { computeComposite, type OpenPriceBounds } from '../../services/composite/compositeScore'
import type { RiskStrengths } from '../../services/climateRisk/climateRisk'
import { buildScoreFillColorForRange } from './scoreRamp'
import { addLayerOrdered } from '../Map/layerOrder'
import { FILL_LAYER_ID as BEST_ZONES_FILL_LAYER_ID } from '../BestZones/BestZonesLayer'

export const SOURCE_ID = 'composite-h3'
export const FILL_LAYER_ID = 'composite-fill'
export const GAP_LAYER_ID = 'composite-gap-outline'
export const HOVER_LAYER_ID = 'composite-hover-outline'

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
    floodPenalty: number
    firePenalty: number
    streetPenalty: number
  }
}

function buildGeoJSON(
  bundles: CellBundle[],
  openPriceBounds: OpenPriceBounds,
  weights: ReturnType<typeof useStore.getState>['compositeWeights'],
  enabledLandmarkIds: readonly string[],
  riskStrengths: RiskStrengths,
): GeoJSON.FeatureCollection {
  const features: ScoredFeature[] = bundles.map((b) => {
    const { score, hasGap, components, penalties } = computeComposite(
      b,
      weights,
      enabledLandmarkIds,
      openPriceBounds,
      riskStrengths,
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
        floodPenalty: penalties.flood,
        firePenalty: penalties.fire,
        streetPenalty: penalties.street,
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

/** Inside a drawn best zone the zone owns hover and click (feature 038), not the hex underneath. */
function inBestZone(map: maplibregl.Map, e: maplibregl.MapLayerMouseEvent): boolean {
  return !!map.getLayer(BEST_ZONES_FILL_LAYER_ID) &&
    map.queryRenderedFeatures(e.point, { layers: [BEST_ZONES_FILL_LAYER_ID] }).length > 0
}

export function CompositeLayer() {
  const map = useContext(MapContext)
  const visible = useStore((s) => s.compositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const setSelectedHexH3 = useStore((s) => s.setSelectedHexH3)

  const bundlesRef = useRef<CellBundle[] | null>(null)
  const openPriceMetaRef = useRef<OpenPriceBounds | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Lazy-load all data sources the first time the layer is enabled.
  useEffect(() => {
    if (!visible || bundlesRef.current) return
    let cancelled = false
    Promise.all([loadBundles(), loadOpenPriceMeta()])
      .then(([bundles, openPriceMeta]) => {
        if (cancelled) return
        bundlesRef.current = bundles
        openPriceMetaRef.current = openPriceMeta
        setDataLoaded(true)
      })
      .catch((err) => console.error('Composite layer data failed to load', err))
    return () => { cancelled = true }
  }, [visible])

  // Add/update MapLibre source + layers whenever scores need recomputing.
  useEffect(() => {
    if (!map || !bundlesRef.current || !openPriceMetaRef.current) return
    const data = buildGeoJSON(
      bundlesRef.current,
      openPriceMetaRef.current,
      weights,
      enabledLandmarkIds,
      riskStrengths,
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

      addLayerOrdered(map, {
        id: HOVER_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'h3'], ''] as maplibregl.FilterSpecification,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.9 },
      }, HOVER_LAYER_ID)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dataLoaded, weights, enabledLandmarkIds, riskStrengths])

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
    if (map.getLayer(HOVER_LAYER_ID)) map.setLayoutProperty(HOVER_LAYER_ID, 'visibility', vis)
    if (!visible) setSelectedHexH3(null)
  }, [map, visible, dataLoaded, setSelectedHexH3])

  // Hover: white outline + pointer cursor. No tooltip (too noisy) — details open on click.
  useEffect(() => {
    if (!map) return
    const outline = (h3: string) =>
      map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'h3'], h3] as maplibregl.FilterSpecification)
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const h3 = e.features?.[0]?.properties?.h3 as string | undefined
      if (!h3) return
      map.getCanvas().style.cursor = 'pointer'
      outline(inBestZone(map, e) ? '' : h3)
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      outline('')
    }
    map.on('mousemove', FILL_LAYER_ID, onMove)
    map.on('mouseleave', FILL_LAYER_ID, onLeave)
    return () => {
      map.off('mousemove', FILL_LAYER_ID, onMove)
      map.off('mouseleave', FILL_LAYER_ID, onLeave)
    }
  }, [map])

  // Click handler — open detail card.
  useEffect(() => {
    if (!map) return
    function onClick(e: maplibregl.MapLayerMouseEvent) {
      const h3 = e.features?.[0]?.properties?.h3 as string | undefined
      if (!h3 || !map || inBestZone(map, e)) return
      useStore.getState().setSelectedHexH3(
        useStore.getState().selectedHexH3 === h3 ? null : h3
      )
    }
    map.on('click', FILL_LAYER_ID, onClick)
    return () => { map.off('click', FILL_LAYER_ID, onClick) }
  }, [map])

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (!map) return
      if (map.getLayer(HOVER_LAYER_ID)) map.removeLayer(HOVER_LAYER_ID)
      if (map.getLayer(GAP_LAYER_ID)) map.removeLayer(GAP_LAYER_ID)
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
