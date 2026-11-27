import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { loadBuildings, loadScores, type BuildingData } from '../../services/buildings/buildingData'
import { scoreBuilding } from '../../services/buildings/buildingScore'
import { scoreClient } from '../../services/buildings/scoreClient'
import type { ScoreResult } from '../../services/buildings/scoreProtocol'
import { matchTooltip, type ConditionId } from '../../services/match/matchSummary'
import { AREA_VIEW_MAX_ZOOM, rankAreas } from '../../services/areas/areaRank'
import { loadBarriVibe, type BarriVibeData } from '../../services/localsOpinion/localsOpinion'
import { buildStateColorForRange, colorRange } from './scoreRamp'
import { inBestZone } from '../BestZones/inBestZone'
import { addLayerOrdered } from '../Map/layerOrder'
import { visibleBounds } from '../Map/visibleBounds'
import { features } from '../../features'
import { hasConditions } from '../../services/composite/compositeScore'
import { ensureHatchImages, HATCH_THIN } from '../Map/hatchPattern'
import { pickNearest } from '../../services/locate'
import { DOUBLE_TAP_GRACE_MS, TAP_TOLERANCE_PX } from '../../services/phoneConfig'
import { commitAfterGrace } from './doubleTapGrace'
import { dataUrl } from '../../services/dataUrl'

// Building-level Livability Index (TODO-046). Tiles carry only geometry and a numeric feature id (= row of the
// score columns): dots up to z13, footprints from z14. Scores are computed in JS and set as feature state.
export const SOURCE_ID = 'buildings'
export const SOURCE_LAYER = 'b'
export const DOT_LAYER_ID = 'buildings-dots'
export const FILL_LAYER_ID = 'buildings-fill'
/** Light diagonal hatch over the footprints with an incomplete-data range (060); replaces the black gap outline. */
export const HATCH_LAYER_ID = 'buildings-hatch'
export const HOVER_LAYER_ID = 'buildings-hover-outline'
const LAYER_IDS = [DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID]
const PMTILES_URL = `pmtiles://${dataUrl('buildings.pmtiles')}`
/** Pause after the last settings change before rescoring (scoring all buildings takes ~0.4 s). */
const RESCORE_DELAY_MS = 150
/** Hover tooltip (TODO-050): footprints only (z14+), after the pointer rests on a building. */
const TOOLTIP_MIN_ZOOM = 14
const TOOLTIP_DELAY_MS = 60

const POINT: maplibregl.FilterSpecification = ['==', ['geometry-type'], 'Point']
const POLYGON: maplibregl.FilterSpecification = ['==', ['geometry-type'], 'Polygon']
const state = (key: string): maplibregl.ExpressionSpecification => ['boolean', ['feature-state', key], false]

interface Loaded { buildings: BuildingData; vibe: BarriVibeData | null }
/** The scores that the feature states of a map hold now. */
interface Applied { map: maplibregl.Map; score: Uint8Array; gap: Uint8Array }
/** A scoring result with what it was computed for. */
interface Scored { result: ScoreResult; weights: Partial<Record<ConditionId, number>>; buildings: BuildingData; t0: number }

export function BuildingsLayer() {
  const map = useContext(MapContext)
  // Neutral map (061): nothing is drawn, hovered or clicked while no condition is on.
  // Hidden while the funnel (TODO-076) is open: it draws its own buildings.
  const visible = useStore((s) => s.compositeVisible && !s.funnelOpen && hasConditions(s.compositeWeights, s.compositeRiskStrengths))
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const enabledCategories = useStore((s) => s.enabledWalkCategories)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const ageEras = useStore((s) => s.ageEras)
  const conditions = useStore((s) => s.conditions)
  const contrastBoost = useStore((s) => s.contrastBoost)
  const selected = useStore((s) => s.selectedBuilding)
  const setSelectedBuilding = useStore((s) => s.setSelectedBuilding)

  const [data, setData] = useState<Loaded | null>(null)
  const scoresRef = useRef<Uint8Array | null>(null)
  const buildingsRef = useRef<Loaded | null>(null)
  buildingsRef.current = data

  // Lazy-load the score columns the first time the index is shown. The positions come later (TODO-058): only
  // Boost contrast needs them here.
  useEffect(() => {
    if (!visible || data) return
    let cancelled = false
    Promise.all([loadScores(), features.localsOpinion ? loadBarriVibe() : null])
      .then(([buildings, vibe]) => { if (!cancelled) setData({ buildings, vibe }) })
      .catch((err) => console.error('Building layer data failed to load', err))
    return () => { cancelled = true }
  }, [visible, data])

  const [positionsReady, setPositionsReady] = useState(false)
  useEffect(() => {
    if (!contrastBoost || positionsReady) return
    let cancelled = false
    loadBuildings()
      .then(() => { if (!cancelled) setPositionsReady(true) })
      .catch((err) => console.error('Building positions failed to load', err))
    return () => { cancelled = true }
  }, [contrastBoost, positionsReady])

  /**
   * Sets the colour scale: fixed 0–100 by default (TODO-050); with "Boost contrast" on, fitted (TODO-032) to the
   * buildings whose centroid is in the visible part of the map (once the positions have loaded).
   */
  const recolor = useCallback(() => {
    const scores = scoresRef.current
    if (!map || !data || !scores || !map.getLayer(FILL_LAYER_ID)) return
    const inView: number[] = []
    if (contrastBoost) {
      if (!positionsReady) return
      const [w, s, e, n] = visibleBounds(map)
      const { lng, lat } = data.buildings.cols
      for (let i = 0; i < scores.length; i++) {
        if (lng[i] >= w && lng[i] <= e && lat[i] >= s && lat[i] <= n) inView.push(scores[i])
      }
    }
    const range = colorRange(contrastBoost, inView)
    if (!range) return
    const prev = useStore.getState().compositeColorRange
    if (prev[0] !== range[0] || prev[1] !== range[1]) useStore.getState().setCompositeColorRange(range)
    const color = buildStateColorForRange(range[0], range[1])
    map.setPaintProperty(FILL_LAYER_ID, 'fill-color', color)
    map.setPaintProperty(DOT_LAYER_ID, 'circle-color', color)
  }, [map, data, contrastBoost, positionsReady])

  // Switching Boost contrast on or off recolours at once.
  useEffect(() => { recolor() }, [recolor])

  // Source and layers, as soon as the index is shown: the tiles are fetched while the scores are still on their way
  // (TODO-058). Nothing is painted before the scores arrive (the colour is transparent without a score).
  useEffect(() => {
    if (!map || !(visible || data) || map.getSource(SOURCE_ID)) return
    map.addSource(SOURCE_ID, { type: 'vector', url: PMTILES_URL })
    const layout = { visibility: visible ? 'visible' : 'none' } as const
    const color = buildStateColorForRange(...useStore.getState().compositeColorRange)
    ensureHatchImages(map)
    // The area view (TODO-051) takes over below this zoom. The footprint layers get the same limit (the tiles have
    // footprints from z14 only), so no building tiles are fetched while the area view is shown (TODO-058).
    const zoomLimit = features.areas ? { minzoom: AREA_VIEW_MAX_ZOOM } : {}
    const base = { source: SOURCE_ID, 'source-layer': SOURCE_LAYER, layout, ...zoomLimit }
    addLayerOrdered(map, {
      ...base, id: DOT_LAYER_ID, type: 'circle', filter: POINT,
      paint: {
        'circle-color': color, 'circle-opacity': 0.85,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 2.5],
      },
    }, DOT_LAYER_ID)
    addLayerOrdered(map, {
      ...base, id: FILL_LAYER_ID, type: 'fill', filter: POLYGON,
      paint: { 'fill-color': color, 'fill-opacity': 0.75 },
    }, FILL_LAYER_ID)
    addLayerOrdered(map, {
      ...base, id: HATCH_LAYER_ID, type: 'fill', filter: POLYGON,
      paint: { 'fill-pattern': HATCH_THIN.id, 'fill-opacity': ['case', state('gap'), 1, 0] },
    }, HATCH_LAYER_ID)
    addLayerOrdered(map, {
      ...base, id: HOVER_LAYER_ID, type: 'line', filter: POLYGON,
      paint: {
        'line-color': '#ffffff', 'line-width': 2,
        'line-opacity': ['case', ['any', state('hover'), state('selected')], 0.95, 0],
      },
    }, HOVER_LAYER_ID)
  }, [map, visible, data])

  // Scores of every building, whenever the user's settings change. Scoring runs in a worker (TODO-058), so the
  // page stays responsive; the result arrives a moment later, and one that a newer change made pointless is
  // dropped. It does not wait for the map: at start the scores are computed while the base map is loading. The first
  // pass runs at once; later ones wait for a pause (dragging a slider would otherwise rescore 170k buildings per
  // step).
  const [scored, setScored] = useState<Scored | null>(null)
  const scoredOnceRef = useRef(false)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    const run = () => {
      const t0 = performance.now()
      scoreClient.score(data.buildings, {
        weights, conditions, enabledLandmarkIds, enabledCategories, riskStrengths, ageEras, vibe: data.vibe,
      }, features.areas).then((result) => {
        if (cancelled || !result) return
        scoredOnceRef.current = true
        setScored({ result, weights, buildings: data.buildings, t0 })
      })
    }
    if (!scoredOnceRef.current) {
      run()
      return () => { cancelled = true }
    }
    const timer = setTimeout(run, RESCORE_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [data, weights, conditions, enabledLandmarkIds, enabledCategories, riskStrengths, ageEras])

  // Scores → feature state, once the map has the source. Only buildings whose score changed get a new state.
  // `applied` is what the feature states of this map hold now.
  const appliedRef = useRef<Applied | null>(null)
  const recolorRef = useRef(recolor)
  recolorRef.current = recolor
  useEffect(() => {
    if (!map || !scored || !map.getSource(SOURCE_ID)) return
    const { score, gap, components } = scored.result
    const prev = appliedRef.current?.map === map ? appliedRef.current : null
    if (prev?.score === score) return
    let changed = 0
    for (let i = 0; i < score.length; i++) {
      if (prev && prev.score[i] === score[i] && prev.gap[i] === gap[i]) continue
      map.setFeatureState({ source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: i }, { score: score[i], gap: gap[i] === 1 })
      changed++
    }
    if (!appliedRef.current) performance.mark('buildings-colored')
    appliedRef.current = { map, score, gap }
    scoresRef.current = score
    useStore.getState().setBuildingScores(score)
    if (components) {
      const on = (Object.keys(components) as ConditionId[]).filter((k) => (scored.weights[k] ?? 0) > 0)
      useStore.getState().setAreaRanks(
        rankAreas(
          score, scored.buildings.cols.area, scored.buildings.meta.areas, components, on, undefined, undefined, gap, undefined,
          scored.buildings.cols.dwellings,
        ),
      )
    }
    recolorRef.current()
    if (import.meta.env.DEV) {
      console.debug(`buildings: ${score.length} scored, ${changed} changed, ${Math.round(performance.now() - scored.t0)} ms`)
    }
  }, [map, scored])

  // Refit the colour scale (Boost contrast only) once the map stops moving.
  useEffect(() => {
    if (!map) return
    const onMoveEnd = () => recolor()
    map.on('moveend', onMoveEnd)
    return () => { map.off('moveend', onMoveEnd) }
  }, [map, recolor])

  // Visibility toggle without removing layers.
  useEffect(() => {
    if (!map || !map.getLayer(FILL_LAYER_ID)) return
    for (const id of LAYER_IDS) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    if (!visible) setSelectedBuilding(null)
  }, [map, visible, data, setSelectedBuilding])

  // White outline on the selected building.
  useEffect(() => {
    if (!map || selected === null || !map.getSource(SOURCE_ID)) return
    const target = { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: selected }
    map.setFeatureState(target, { selected: true })
    return () => { if (map.getSource(SOURCE_ID)) map.setFeatureState(target, { selected: false }) }
  }, [map, selected, data])

  // Hover outline + pointer; click opens the building card (feature 038: a best zone owns its clicks).
  useEffect(() => {
    if (!map) return
    let hovered: number | null = null
    let tipTimer: ReturnType<typeof setTimeout> | undefined
    let popup: maplibregl.Popup | null = null
    const hideTip = () => {
      clearTimeout(tipTimer)
      popup?.remove()
      popup = null
    }
    /** "Good match · 78 — meets 3 of 4" a moment after the pointer rests on a building (not on touch screens). */
    const showTip = (id: number, lngLat: maplibregl.LngLat) => {
      clearTimeout(tipTimer)
      popup?.remove()
      popup = null
      if (map.getZoom() < TOOLTIP_MIN_ZOOM) return
      if (typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches) return
      tipTimer = setTimeout(() => {
        const st = useStore.getState()
        const buildings = buildingsRef.current
        if (!buildings) return
        const r = scoreBuilding(buildings.buildings, id, {
          weights: st.compositeWeights, conditions: st.conditions, enabledLandmarkIds: st.enabledLandmarkIds,
          enabledCategories: st.enabledWalkCategories, riskStrengths: st.compositeRiskStrengths, ageEras: st.ageEras,
          vibe: buildings.vibe,
        })
        popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'match-tooltip' })
          .setLngLat(lngLat)
          .setText(matchTooltip(r.score, undefined, r.hasGap))
          .addTo(map)
      }, TOOLTIP_DELAY_MS)
    }
    const hover = (id: number, on: boolean) =>
      map.setFeatureState({ source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id }, { hover: on })
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      if (typeof id !== 'number') return
      map.getCanvas().style.cursor = 'pointer'
      if (hovered === id) return
      if (hovered !== null) hover(hovered, false)
      hovered = id
      hover(id, true)
      showTip(id, e.lngLat)
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      if (hovered !== null) hover(hovered, false)
      hovered = null
      hideTip()
    }
    // A tap on a touch screen waits a moment: a second touch is the start of a double-tap zoom (TODO-062).
    let cancelPending: (() => void) | null = null
    const pick = (id: number) => {
      const apply = () => {
        const st = useStore.getState()
        st.setSelectedBuilding(st.selectedBuilding === id ? null : id)
      }
      cancelPending?.()
      cancelPending = null
      const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
      if (touch) cancelPending = commitAfterGrace(map, DOUBLE_TAP_GRACE_MS, apply)
      else apply()
    }
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id
      if (typeof id !== 'number' || inBestZone(map, e)) return
      hideTip()
      pick(id)
    }
    // A finger is wider than a footprint (TODO-062): when nothing is exactly under it, take the home nearest to
    // the tap within TAP_TOLERANCE_PX. Touch screens only; a mouse keeps pointing exactly.
    const onNearTap = (e: maplibregl.MapMouseEvent) => {
      if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return
      const layers = [FILL_LAYER_ID, DOT_LAYER_ID].filter((id) => map.getLayer(id))
      if (layers.length === 0 || map.queryRenderedFeatures(e.point, { layers }).length > 0) return // exact hits: onClick
      if (inBestZone(map, e)) return
      const t = TAP_TOLERANCE_PX
      const near = map.queryRenderedFeatures([[e.point.x - t, e.point.y - t], [e.point.x + t, e.point.y + t]], { layers })
      const ids = near.map((f) => f.id).filter((id): id is number => typeof id === 'number')
      const cols = buildingsRef.current?.buildings.cols
      const id = pickNearest(ids, e.lngLat.lng, e.lngLat.lat, cols?.lng && cols.lat ? { lng: cols.lng, lat: cols.lat } : null)
      if (id === null) return
      hideTip()
      pick(id)
    }
    map.on('click', onNearTap)
    for (const layer of [FILL_LAYER_ID, DOT_LAYER_ID]) {
      map.on('mousemove', layer, onMove)
      map.on('mouseleave', layer, onLeave)
      map.on('click', layer, onClick)
    }
    return () => {
      hideTip()
      cancelPending?.()
      map.off('click', onNearTap)
      for (const layer of [FILL_LAYER_ID, DOT_LAYER_ID]) {
        map.off('mousemove', layer, onMove)
        map.off('mouseleave', layer, onLeave)
        map.off('click', layer, onClick)
      }
    }
  }, [map])

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (!map) return
      for (const id of [...LAYER_IDS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
