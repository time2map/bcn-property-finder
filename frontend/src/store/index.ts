import { create } from 'zustand'
import type { MultiPolygon, Polygon } from 'geojson'
import { ALL_LANDMARK_IDS } from '../services/cityCore/landmarks'
import { DEFAULT_RISK_STRENGTHS, type RiskStrengths } from '../services/climateRisk/climateRisk'
import { DEFAULT_TOP_PCT, type Bounds } from '../services/bestZonesConfig'
import { ALL_AGE_ERA_IDS } from '../services/buildings/buildingAge'
import { DEFAULT_CONDITIONS, type Conditions } from '../services/buildings/conditions'
import { features } from '../features'
import {
  ALL_WALK_CATEGORY_IDS, DEFAULT_COMPOSITE_WEIGHTS, DEFAULT_LANDMARK_IDS, DEFAULT_WALK_CATEGORY_IDS,
  type CompositeWeights, type ScoreSettings,
} from '../services/buildings/firstVisit'
import type { AreaRank } from '../services/areas/areaRank'
import { allowLocals, decodeConfig, type UrlSettings } from '../services/urlConfig'
import type { WishId } from '../services/funnel/funnelWishes'
import {
  CONDITION_KEYS, DEFAULT_COMMUTE_MINUTES, DEFAULT_FLAT_AREA_M2, FLAT_AREA_RANGE, activeConditions, priceAfterAreaChange,
  type ConditionKey, type SettingsPatch,
} from '../services/conditionOptions'

// Defined with the other first-visit settings (TODO-058), exported here as before.
export { ALL_WALK_CATEGORY_IDS, DEFAULT_COMPOSITE_WEIGHTS, type CompositeWeights }

/** The one map layer a person looks at (TODO-052); the store keeps the four visibility flags. */
export type MapLayerId = 'none' | 'noise' | 'river' | 'street' | 'wildfire'

/** The layer shown, by priority noise > river > street > wildfire when more than one flag is on. */
export function mapLayerOf(s: Pick<AppState, 'noiseLayerVisible' | 'floodLayerVisible' | 'streetFloodingLayerVisible' | 'wildfireLayerVisible'>): MapLayerId {
  if (s.noiseLayerVisible) return 'noise'
  if (s.floodLayerVisible) return 'river'
  if (s.streetFloodingLayerVisible) return 'street'
  if (s.wildfireLayerVisible) return 'wildfire'
  return 'none'
}

export interface AppState {
  workplace: [number, number] | null
  minutes: number
  zoom: number
  mapCenter: [number, number]
  resultPolygon: Polygon | MultiPolygon | null
  noiseLayerVisible: boolean
  // Best zones — feature 038. Viewport captured by "Draw best zones"; null = no zones.
  bestZonesBounds: Bounds | null
  bestZonesTopPct: number
  /** Best zones only inside the isochrone and outside exclusion zones. */
  bestZonesRestrict: boolean
  /** How many best areas the current view has (set by BestZones); null = off or not computed yet. */
  bestZonesCount: number | null
  // Landmark selection for city core component inside composite — feature 021/022
  enabledLandmarkIds: readonly string[]
  // Idealista price dots layer — feature 019
  idealistaPricesVisible: boolean
  idealistaPriceRange: [number, number]
  idealistaPriceBounds: [number, number] | null
  // Composite Index layer — feature 022
  compositeVisible: boolean
  compositeWeights: CompositeWeights
  /** Colour scale of the buildings: 0–100, or stretched over the commute zone (077); set by BuildingsLayer. */
  compositeColorRange: [number, number]
  // Climate risk penalties + view layers — feature 036
  compositeRiskStrengths: RiskStrengths
  floodLayerVisible: boolean
  wildfireLayerVisible: boolean
  // Street flooding view layer — feature 037
  streetFloodingLayerVisible: boolean
  streetFloodingReturnPeriod: 't10' | 't100'
  // Building-level index — TODO-046
  /** Walkability categories the user keeps; walkability is recomputed over them. */
  enabledWalkCategories: readonly string[]
  /** Building-age eras the user likes (TODO-047); all by default. */
  ageEras: readonly string[]
  /** What is OK for the user, in real units (049). */
  conditions: Conditions
  /** Size (m²) of the flat the budget word is for (TODO-031); the budget shown is `priceMaxEurM2` × this. */
  flatAreaM2: number
  /** Order in which the conditions were added = their priority (TODO-031; used by the ranked list, 051). */
  conditionOrder: ConditionKey[]
  /** The person has been through the onboarding (or skipped it). */
  onboarded: boolean
  /** The onboarding panel is showing: first visit, or "Change" in the panel. */
  onboardingOpen: boolean
  /** "Find your one building" funnel (TODO-076, prototype): open, the wishes picked in order, the sea within reach. */
  funnelOpen: boolean
  funnelPicks: WishId[]
  funnelSea: boolean
  setFunnelOpen: (open: boolean) => void
  pickFunnelWish: (wish: WishId) => void
  /** Drops the last pick ("Back"). */
  undoFunnelWish: () => void
  /** Drops every pick and the sea ("Start again"). */
  resetFunnel: () => void
  setFunnelSea: (sea: boolean) => void
  /** Row (= feature id) of the clicked building; null = no card. */
  selectedBuilding: number | null
  /** Index (`AreaRank.index`) of the area whose card is open (TODO-064); never together with a building. */
  selectedArea: number | null
  /** Latest score of every building (by row), set by BuildingsLayer; Best zones average it per cell. */
  buildingScores: Uint8Array | null
  /** Areas ranked by how many of their homes fit (TODO-051), set by BuildingsLayer after each rescoring. */
  areaRanks: AreaRank[] | null
  /** Null removes the daily trip (078), and its commute zone with it. */
  setWorkplace: (wp: [number, number] | null) => void
  /** The next click on the map sets the place of the daily trip (078). */
  commutePicking: boolean
  setCommutePicking: (on: boolean) => void
  setMinutes: (minutes: number) => void
  setZoom: (zoom: number) => void
  setMapCenter: (center: [number, number]) => void
  setResultPolygon: (polygon: Polygon | MultiPolygon | null) => void
  setNoiseLayerVisible: (visible: boolean) => void
  /** Exactly one of the layers (or none), saved with one update. */
  setMapLayer: (layer: MapLayerId) => void
  setBestZonesBounds: (bounds: Bounds | null) => void
  setBestZonesTopPct: (topPct: number) => void
  setBestZonesRestrict: (restrict: boolean) => void
  setBestZonesCount: (count: number | null) => void
  setEnabledLandmarkIds: (ids: readonly string[]) => void
  setIdealistaPricesVisible: (visible: boolean) => void
  setIdealistaPriceRange: (range: [number, number]) => void
  setIdealistaPriceBounds: (bounds: [number, number]) => void
  setCompositeVisible: (visible: boolean) => void
  setCompositeWeights: (weights: CompositeWeights) => void
  setCompositeColorRange: (range: [number, number]) => void
  setCompositeRiskStrengths: (strengths: RiskStrengths) => void
  setFloodLayerVisible: (visible: boolean) => void
  setWildfireLayerVisible: (visible: boolean) => void
  setStreetFloodingLayerVisible: (visible: boolean) => void
  setStreetFloodingReturnPeriod: (rp: 't10' | 't100') => void
  setEnabledWalkCategories: (ids: readonly string[]) => void
  setAgeEras: (ids: readonly string[]) => void
  setConditions: (conditions: Conditions) => void
  /** Another flat size keeps the budget in euros, so the price per m² moves; one update, one rescoring. */
  setFlatArea: (areaM2: number) => void
  /** Sets everything a profile or the sentence editor can set, with one store update (one rescoring). */
  applySettings: (patch: SettingsPatch) => void
  completeOnboarding: () => void
  openOnboarding: () => void
  setSelectedBuilding: (row: number | null) => void
  setSelectedArea: (index: number | null) => void
  setBuildingScores: (scores: Uint8Array | null) => void
  setAreaRanks: (ranks: AreaRank[] | null) => void
  /** "Details about this building" on the card is open (TODO-070); kept while the person moves between buildings. */
}

function isValidMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= 15 && n <= 120 && n % 5 === 0
}

export const DEFAULT_CENTER: [number, number] = [2.1734, 41.3851]

export function isochroneCacheKey(workplace: [number, number], minutes: number): string {
  return `bcn_isochrone:${workplace[0].toFixed(5)},${workplace[1].toFixed(5)},${minutes}`
}

function readIsochroneCache(workplace: [number, number], minutes: number): Polygon | MultiPolygon | null {
  try {
    const raw = localStorage.getItem(isochroneCacheKey(workplace, minutes))
    return raw ? (JSON.parse(raw) as Polygon | MultiPolygon) : null
  } catch {
    return null
  }
}

const DEFAULT_ZOOM = 12
const WORKPLACE_KEY = 'bcn_workplace'
const NOISE_LAYER_KEY = 'bcn_noise_layer_visible'
const CITY_CORE_LANDMARKS_KEY = 'bcn_city_core_landmarks'
const COMPOSITE_VISIBLE_KEY = 'bcn_composite_visible'
const COMPOSITE_WEIGHTS_KEY = 'bcn_composite_weights'
const COMPOSITE_RISK_STRENGTHS_KEY = 'bcn_composite_risk_strengths'
const FLOOD_LAYER_KEY = 'bcn_flood_layer_visible'
const WILDFIRE_LAYER_KEY = 'bcn_wildfire_layer_visible'
const STREET_FLOODING_LAYER_KEY = 'bcn_street_flooding_layer_visible'
const BEST_ZONES_TOP_PCT_KEY = 'bcn_best_zones_top_pct'
const BEST_ZONES_RESTRICT_KEY = 'bcn_best_zones_restrict'
const WALK_CATEGORIES_KEY = 'bcn_walk_categories'
const AGE_ERAS_KEY = 'bcn_age_eras'
const CONDITIONS_KEY = 'bcn_conditions'
const CONDITION_ORDER_KEY = 'bcn_condition_order'
const ONBOARDED_KEY = 'bcn_onboarded'
const FLAT_AREA_KEY = 'bcn_flat_area_m2'

function loadFlatArea(): number {
  try {
    const v = Number(localStorage.getItem(FLAT_AREA_KEY))
    if (Number.isFinite(v) && v >= FLAT_AREA_RANGE.min && v <= FLAT_AREA_RANGE.max) return v
  } catch { /* ignore */ }
  return DEFAULT_FLAT_AREA_M2
}

/** Settings a returning visitor has saved; the onboarding does not overwrite them (TODO-031). */
const SAVED_SETTINGS_KEYS = [
  COMPOSITE_WEIGHTS_KEY, CONDITIONS_KEY, WALK_CATEGORIES_KEY, CITY_CORE_LANDMARKS_KEY, AGE_ERAS_KEY,
  COMPOSITE_RISK_STRENGTHS_KEY,
]

export function hasSavedSettings(): boolean {
  try {
    return SAVED_SETTINGS_KEYS.some((k) => localStorage.getItem(k) !== null)
  } catch {
    return false
  }
}

function loadConditionOrder(): ConditionKey[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONDITION_ORDER_KEY) ?? 'null') as unknown
    return Array.isArray(parsed) ? parsed.filter((k): k is ConditionKey => CONDITION_KEYS.includes(k as ConditionKey)) : []
  } catch {
    return []
  }
}

function persist(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

function loadConditions(): Conditions {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONDITIONS_KEY) ?? 'null') as Partial<Record<keyof Conditions, unknown>> | null
    const keys = Object.keys(DEFAULT_CONDITIONS) as (keyof Conditions)[]
    return Object.fromEntries(keys.map((k) => {
      const v = parsed?.[k]
      return [k, typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_CONDITIONS[k]]
    })) as unknown as Conditions
  } catch {
    return DEFAULT_CONDITIONS
  }
}

/**
 * A stored id list, unknown ids dropped; `dflt` when nothing valid is stored. With `oldDefaultIsAll`, a stored list
 * of every id reads as `dflt` too: until TODO-073 "all" was the default of the services and the City Core places,
 * and the profiles saved it, so such a list almost always means "the default" rather than a choice.
 */
export function loadIds(key: string, all: readonly string[], dflt: readonly string[] = all, oldDefaultIsAll = false): readonly string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
    const known = Array.isArray(parsed) ? parsed.filter((id) => all.includes(id)) : []
    if (oldDefaultIsAll && known.length === all.length && dflt.length < all.length) return dflt
    if (known.length > 0) return known
  } catch { /* ignore */ }
  return dflt
}

export function readWorkplaceFromStorage(): [number, number] | null {
  try {
    const raw = localStorage.getItem(WORKPLACE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.length === 2 && !isNaN(parsed[0]) && !isNaN(parsed[1])) {
      return [parsed[0] as number, parsed[1] as number]
    }
    return null
  } catch {
    return null
  }
}

export function readUrlParams(): Pick<AppState, 'minutes' | 'zoom' | 'mapCenter'> {
  const params = new URLSearchParams(window.location.search)
  const cx = parseFloat(params.get('cx') ?? '')
  const cy = parseFloat(params.get('cy') ?? '')
  const rawMinutes = parseInt(params.get('minutes') ?? '', 10)
  const rawZoom = parseFloat(params.get('zoom') ?? '')

  return {
    mapCenter: !isNaN(cx) && !isNaN(cy) ? [cx, cy] : DEFAULT_CENTER,
    minutes: isValidMinutes(rawMinutes) ? rawMinutes : DEFAULT_COMMUTE_MINUTES,
    zoom: !isNaN(rawZoom) && rawZoom >= 1 && rawZoom <= 22 ? rawZoom : DEFAULT_ZOOM,
  }
}

function loadCompositeWeights(): CompositeWeights {
  try {
    const raw = localStorage.getItem(COMPOSITE_WEIGHTS_KEY)
    if (!raw) return DEFAULT_COMPOSITE_WEIGHTS
    const parsed = JSON.parse(raw) as Partial<CompositeWeights>
    // Weights stored before 049 were 1–10: anything above 0 means the condition is on.
    const on = (k: keyof CompositeWeights) => ((parsed[k] ?? DEFAULT_COMPOSITE_WEIGHTS[k]) > 0 ? 1 : 0)
    return {
      poiAccess: on('poiAccess'),
      noise: on('noise'),
      cityCore: on('cityCore'),
      openPrice: on('openPrice'),
      // Flag off: no row to turn it back off, so a stored value must not apply.
      localsOpinion: features.localsOpinion ? on('localsOpinion') : 0,
      age: on('age'),
    }
  } catch {
    return DEFAULT_COMPOSITE_WEIGHTS
  }
}

function loadRiskStrengths(): RiskStrengths {
  try {
    const raw = localStorage.getItem(COMPOSITE_RISK_STRENGTHS_KEY)
    if (!raw) return DEFAULT_RISK_STRENGTHS
    const parsed = JSON.parse(raw) as Partial<RiskStrengths>
    return {
      flood: parsed.flood ?? DEFAULT_RISK_STRENGTHS.flood,
      fire: parsed.fire ?? DEFAULT_RISK_STRENGTHS.fire,
      street: parsed.street ?? DEFAULT_RISK_STRENGTHS.street,
    }
  } catch {
    return DEFAULT_RISK_STRENGTHS
  }
}

function loadBoolKey(key: string, dflt = false): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? dflt : raw === 'true'
  } catch {
    return dflt
  }
}

/** What the map starts with when nothing is saved and the link says nothing (the base of a `c` link). */
export const URL_DEFAULTS: UrlSettings = {
  weights: DEFAULT_COMPOSITE_WEIGHTS,
  conditions: DEFAULT_CONDITIONS,
  walkCategories: DEFAULT_WALK_CATEGORY_IDS,
  landmarkIds: DEFAULT_LANDMARK_IDS,
  eras: ALL_AGE_ERA_IDS,
  riskStrengths: DEFAULT_RISK_STRENGTHS,
  order: activeConditions(DEFAULT_COMPOSITE_WEIGHTS, DEFAULT_RISK_STRENGTHS, []),
  flatAreaM2: DEFAULT_FLAT_AREA_M2,
}

/** The settings that define the map, as a link carries them (TODO-053). */
/** The settings the buildings are scored with (no locals' opinion data). */
export function scoreSettingsOf(s: AppState): ScoreSettings {
  return {
    weights: s.compositeWeights, conditions: s.conditions, enabledLandmarkIds: s.enabledLandmarkIds,
    enabledCategories: s.enabledWalkCategories, riskStrengths: s.compositeRiskStrengths, ageEras: s.ageEras,
  }
}

export function settingsOf(s: AppState): UrlSettings {
  return {
    weights: s.compositeWeights, conditions: s.conditions, walkCategories: s.enabledWalkCategories,
    landmarkIds: s.enabledLandmarkIds, eras: s.ageEras, riskStrengths: s.compositeRiskStrengths,
    order: s.conditionOrder, flatAreaM2: s.flatAreaM2,
  }
}

/** The configuration in the address (`c`, TODO-053); it wins over what is saved. Null when there is none. */
function readUrlSettings(): UrlSettings | null {
  try {
    const s = decodeConfig(new URLSearchParams(window.location.search).get('c'), URL_DEFAULTS)
    return s && { ...s, weights: allowLocals(s.weights) }
  } catch {
    return null
  }
}

/** `?funnel` in the address opens the "find your one building" prototype (TODO-076). */
function hasFunnelParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('funnel')
  } catch {
    return false
  }
}

/** A configuration from a link is kept, so the recipient has it on the next visit too. */
function saveUrlSettings(s: UrlSettings): void {
  persist(COMPOSITE_WEIGHTS_KEY, s.weights)
  persist(CONDITIONS_KEY, s.conditions)
  persist(WALK_CATEGORIES_KEY, s.walkCategories)
  persist(CITY_CORE_LANDMARKS_KEY, s.landmarkIds)
  persist(AGE_ERAS_KEY, s.eras)
  persist(COMPOSITE_RISK_STRENGTHS_KEY, s.riskStrengths)
  persist(CONDITION_ORDER_KEY, s.order)
  try { localStorage.setItem(FLAT_AREA_KEY, String(s.flatAreaM2)) } catch { /* ignore */ }
}

export const useStore = create<AppState>((set, get) => {
  const { minutes, zoom, mapCenter } = readUrlParams()
  const workplace = readWorkplaceFromStorage()
  const url = readUrlSettings()
  if (url) saveUrlSettings(url)
  const weights = url ? url.weights : loadCompositeWeights()
  const riskStrengths = url ? url.riskStrengths : loadRiskStrengths()
  const onboarded = loadBoolKey(ONBOARDED_KEY)
  // The new panel shows one layer at a time: of several saved ones only the first stays on.
  const saved = {
    noiseLayerVisible: loadBoolKey(NOISE_LAYER_KEY),
    floodLayerVisible: loadBoolKey(FLOOD_LAYER_KEY),
    streetFloodingLayerVisible: loadBoolKey(STREET_FLOODING_LAYER_KEY),
    wildfireLayerVisible: loadBoolKey(WILDFIRE_LAYER_KEY),
  }
  const only = features.onboarding ? mapLayerOf(saved) : null
  const layerFlag = (id: MapLayerId, key: keyof typeof saved) => (only === null ? saved[key] : only === id)
  return {
    workplace,
    minutes,
    zoom,
    mapCenter,
    resultPolygon: workplace ? readIsochroneCache(workplace, minutes) : null,
    noiseLayerVisible: layerFlag('noise', 'noiseLayerVisible'),
    enabledLandmarkIds: url ? url.landmarkIds : loadIds(CITY_CORE_LANDMARKS_KEY, ALL_LANDMARK_IDS, DEFAULT_LANDMARK_IDS, true),
    setWorkplace: (workplace) => {
      try {
        if (workplace) localStorage.setItem(WORKPLACE_KEY, JSON.stringify(workplace))
        else localStorage.removeItem(WORKPLACE_KEY)
      } catch { /* ignore */ }
      set(workplace ? { workplace } : { workplace, resultPolygon: null })
    },
    commutePicking: false,
    setCommutePicking: (commutePicking) => set({ commutePicking }),
    setMinutes: (minutes) => set({ minutes }),
    setZoom: (zoom) => set({ zoom }),
    setMapCenter: (mapCenter) => set({ mapCenter }),
    setResultPolygon: (resultPolygon) => set({ resultPolygon }),
    setNoiseLayerVisible: (visible) => {
      try { localStorage.setItem(NOISE_LAYER_KEY, String(visible)) } catch { /* ignore */ }
      set({ noiseLayerVisible: visible })
    },
    setMapLayer: (layer) => {
      const next = {
        noiseLayerVisible: layer === 'noise', floodLayerVisible: layer === 'river',
        streetFloodingLayerVisible: layer === 'street', wildfireLayerVisible: layer === 'wildfire',
      }
      try {
        localStorage.setItem(NOISE_LAYER_KEY, String(next.noiseLayerVisible))
        localStorage.setItem(FLOOD_LAYER_KEY, String(next.floodLayerVisible))
        localStorage.setItem(STREET_FLOODING_LAYER_KEY, String(next.streetFloodingLayerVisible))
        localStorage.setItem(WILDFIRE_LAYER_KEY, String(next.wildfireLayerVisible))
      } catch { /* ignore */ }
      set(next)
    },
    bestZonesBounds: null,
    setBestZonesBounds: (bestZonesBounds) => set({ bestZonesBounds }),
    bestZonesTopPct: (() => {
      try {
        const v = Number(localStorage.getItem(BEST_ZONES_TOP_PCT_KEY))
        if (v > 0 && v <= 100) return v
      } catch { /* ignore */ }
      return DEFAULT_TOP_PCT
    })(),
    setBestZonesTopPct: (topPct) => {
      try { localStorage.setItem(BEST_ZONES_TOP_PCT_KEY, String(topPct)) } catch { /* ignore */ }
      set({ bestZonesTopPct: topPct })
    },
    bestZonesRestrict: (() => {
      try { return localStorage.getItem(BEST_ZONES_RESTRICT_KEY) !== 'false' } catch { return true }
    })(),
    bestZonesCount: null,
    setBestZonesCount: (bestZonesCount) => set({ bestZonesCount }),
    setBestZonesRestrict: (restrict) => {
      try { localStorage.setItem(BEST_ZONES_RESTRICT_KEY, String(restrict)) } catch { /* ignore */ }
      set({ bestZonesRestrict: restrict })
    },
    setEnabledLandmarkIds: (ids) => {
      try { localStorage.setItem(CITY_CORE_LANDMARKS_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
      set({ enabledLandmarkIds: ids })
    },
    idealistaPricesVisible: false,
    idealistaPriceRange: [300_000, 1_000_000],
    idealistaPriceBounds: null,
    setIdealistaPricesVisible: (idealistaPricesVisible) => set({ idealistaPricesVisible }),
    setIdealistaPriceRange: (idealistaPriceRange) => set({ idealistaPriceRange }),
    setIdealistaPriceBounds: (idealistaPriceBounds) => set({ idealistaPriceBounds }),
    compositeVisible: loadBoolKey(COMPOSITE_VISIBLE_KEY, true),
    compositeWeights: weights,
    compositeColorRange: [0, 100],
    setCompositeColorRange: (compositeColorRange) => set({ compositeColorRange }),
    setCompositeVisible: (visible) => {
      try { localStorage.setItem(COMPOSITE_VISIBLE_KEY, String(visible)) } catch { /* ignore */ }
      set({ compositeVisible: visible })
    },
    setCompositeWeights: (weights) => {
      try { localStorage.setItem(COMPOSITE_WEIGHTS_KEY, JSON.stringify(weights)) } catch { /* ignore */ }
      set({ compositeWeights: weights })
    },
    compositeRiskStrengths: riskStrengths,
    setCompositeRiskStrengths: (strengths) => {
      try { localStorage.setItem(COMPOSITE_RISK_STRENGTHS_KEY, JSON.stringify(strengths)) } catch { /* ignore */ }
      set({ compositeRiskStrengths: strengths })
    },
    floodLayerVisible: layerFlag('river', 'floodLayerVisible'),
    setFloodLayerVisible: (visible) => {
      try { localStorage.setItem(FLOOD_LAYER_KEY, String(visible)) } catch { /* ignore */ }
      set({ floodLayerVisible: visible })
    },
    wildfireLayerVisible: layerFlag('wildfire', 'wildfireLayerVisible'),
    setWildfireLayerVisible: (visible) => {
      try { localStorage.setItem(WILDFIRE_LAYER_KEY, String(visible)) } catch { /* ignore */ }
      set({ wildfireLayerVisible: visible })
    },
    streetFloodingLayerVisible: layerFlag('street', 'streetFloodingLayerVisible'),
    setStreetFloodingLayerVisible: (visible) => {
      try { localStorage.setItem(STREET_FLOODING_LAYER_KEY, String(visible)) } catch { /* ignore */ }
      set({ streetFloodingLayerVisible: visible })
    },
    streetFloodingReturnPeriod: 't10',
    setStreetFloodingReturnPeriod: (streetFloodingReturnPeriod) => set({ streetFloodingReturnPeriod }),
    enabledWalkCategories: url ? url.walkCategories : loadIds(WALK_CATEGORIES_KEY, ALL_WALK_CATEGORY_IDS, DEFAULT_WALK_CATEGORY_IDS, true),
    setEnabledWalkCategories: (ids) => {
      try { localStorage.setItem(WALK_CATEGORIES_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
      set({ enabledWalkCategories: ids })
    },
    ageEras: url ? url.eras : loadIds(AGE_ERAS_KEY, ALL_AGE_ERA_IDS),
    setAgeEras: (ids) => {
      try { localStorage.setItem(AGE_ERAS_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
      set({ ageEras: ids })
    },
    conditions: url ? url.conditions : loadConditions(),
    setConditions: (conditions) => {
      try { localStorage.setItem(CONDITIONS_KEY, JSON.stringify(conditions)) } catch { /* ignore */ }
      set({ conditions })
    },
    flatAreaM2: url ? url.flatAreaM2 : loadFlatArea(),
    setFlatArea: (areaM2) => {
      const { flatAreaM2, conditions } = get()
      if (areaM2 === flatAreaM2) return
      const next = { ...conditions, priceMaxEurM2: priceAfterAreaChange(conditions.priceMaxEurM2, flatAreaM2, areaM2) }
      try { localStorage.setItem(FLAT_AREA_KEY, String(areaM2)) } catch { /* ignore */ }
      persist(CONDITIONS_KEY, next)
      set({ flatAreaM2: areaM2, conditions: next })
    },
    conditionOrder: url ? url.order : activeConditions(weights, riskStrengths, loadConditionOrder(), features.isochrone && workplace !== null),
    onboarded,
    onboardingOpen: features.onboarding && !onboarded && !url && !hasSavedSettings(),
    applySettings: (patch) => {
      const next: Partial<AppState> = {}
      if (patch.weights) { persist(COMPOSITE_WEIGHTS_KEY, patch.weights); next.compositeWeights = patch.weights }
      if (patch.conditions) { persist(CONDITIONS_KEY, patch.conditions); next.conditions = patch.conditions }
      if (patch.walkCategories) { persist(WALK_CATEGORIES_KEY, patch.walkCategories); next.enabledWalkCategories = patch.walkCategories }
      if (patch.landmarkIds) { persist(CITY_CORE_LANDMARKS_KEY, patch.landmarkIds); next.enabledLandmarkIds = patch.landmarkIds }
      if (patch.eras) { persist(AGE_ERAS_KEY, patch.eras); next.ageEras = patch.eras }
      if (patch.riskStrengths) { persist(COMPOSITE_RISK_STRENGTHS_KEY, patch.riskStrengths); next.compositeRiskStrengths = patch.riskStrengths }
      if (patch.order) { persist(CONDITION_ORDER_KEY, patch.order); next.conditionOrder = patch.order }
      set(next)
    },
    completeOnboarding: () => {
      try { localStorage.setItem(ONBOARDED_KEY, 'true') } catch { /* ignore */ }
      set({ onboarded: true, onboardingOpen: false })
    },
    openOnboarding: () => set({ onboardingOpen: true }),
    funnelOpen: features.oneBuilding && hasFunnelParam(),
    funnelPicks: [],
    funnelSea: false,
    setFunnelOpen: (funnelOpen) => set({ funnelOpen }),
    pickFunnelWish: (wish) => set((s) => (s.funnelPicks.includes(wish) ? {} : { funnelPicks: [...s.funnelPicks, wish] })),
    undoFunnelWish: () => set((s) => ({ funnelPicks: s.funnelPicks.slice(0, -1) })),
    resetFunnel: () => set({ funnelPicks: [], funnelSea: false, selectedBuilding: null }),
    // The sea changes which buildings take part from the start: the picks are kept and replayed.
    setFunnelSea: (funnelSea) => set({ funnelSea }),
    selectedBuilding: null,
    // A building and an area never have a card at the same time: the one picked last stays.
    setSelectedBuilding: (selectedBuilding) =>
      set(selectedBuilding === null ? { selectedBuilding } : { selectedBuilding, selectedArea: null }),
    selectedArea: null,
    setSelectedArea: (selectedArea) =>
      set(selectedArea === null ? { selectedArea } : { selectedArea, selectedBuilding: null }),
    buildingScores: null,
    setBuildingScores: (buildingScores) => set({ buildingScores }),
    areaRanks: null,
    setAreaRanks: (areaRanks) => set({ areaRanks }),
  }
})
