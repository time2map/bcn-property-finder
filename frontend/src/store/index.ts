import { create } from 'zustand'
import type { MultiPolygon, Polygon } from 'geojson'
import { ALL_LANDMARK_IDS } from '../services/cityCore/landmarks'

export interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  openPrice: number
  price: number
}

export const DEFAULT_COMPOSITE_WEIGHTS: CompositeWeights = {
  poiAccess: 6,
  noise: 7,
  cityCore: 8,
  openPrice: 10,
  price: 0,
}

export interface AppState {
  workplace: [number, number] | null
  minutes: number
  zoom: number
  mapCenter: [number, number]
  resultPolygon: Polygon | MultiPolygon | null
  noiseLayerVisible: boolean
  mapAttribution: string
  hoveredAreaIndex: number | null
  idealistaAreas: Polygon[]
  idealistaUrls: string[]
  idealistaZonesVisible: boolean
  // Landmark selection for city core component inside composite — feature 021/022
  enabledLandmarkIds: readonly string[]
  // Idealista price dots layer — feature 019
  idealistaPricesVisible: boolean
  idealistaPriceRange: [number, number]
  idealistaPriceBounds: [number, number] | null
  // Composite Index layer — feature 022
  compositeVisible: boolean
  compositeWeights: CompositeWeights
  compositeScoreRange: [number, number]
  // Hex detail card — feature 025
  selectedHexH3: string | null
  setWorkplace: (wp: [number, number] | null) => void
  setMinutes: (minutes: number) => void
  setZoom: (zoom: number) => void
  setMapCenter: (center: [number, number]) => void
  setResultPolygon: (polygon: Polygon | MultiPolygon | null) => void
  setNoiseLayerVisible: (visible: boolean) => void
  setMapAttribution: (attribution: string) => void
  setHoveredAreaIndex: (index: number | null) => void
  setIdealistaAreas: (areas: Polygon[], urls: string[]) => void
  clearIdealistaAreas: () => void
  setIdealistaZonesVisible: (visible: boolean) => void
  setEnabledLandmarkIds: (ids: readonly string[]) => void
  setIdealistaPricesVisible: (visible: boolean) => void
  setIdealistaPriceRange: (range: [number, number]) => void
  setIdealistaPriceBounds: (bounds: [number, number]) => void
  setCompositeVisible: (visible: boolean) => void
  setCompositeWeights: (weights: CompositeWeights) => void
  setCompositeScoreRange: (range: [number, number]) => void
  setSelectedHexH3: (h3: string | null) => void
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
const COMPOSITE_SCORE_RANGE_KEY = 'bcn_composite_score_range'

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
    minutes: isValidMinutes(rawMinutes) ? rawMinutes : 60,
    zoom: !isNaN(rawZoom) && rawZoom >= 1 && rawZoom <= 22 ? rawZoom : DEFAULT_ZOOM,
  }
}

function loadCompositeWeights(): CompositeWeights {
  try {
    const raw = localStorage.getItem(COMPOSITE_WEIGHTS_KEY)
    if (!raw) return DEFAULT_COMPOSITE_WEIGHTS
    const parsed = JSON.parse(raw) as Partial<CompositeWeights>
    return {
      poiAccess: parsed.poiAccess ?? DEFAULT_COMPOSITE_WEIGHTS.poiAccess,
      noise: parsed.noise ?? DEFAULT_COMPOSITE_WEIGHTS.noise,
      cityCore: parsed.cityCore ?? DEFAULT_COMPOSITE_WEIGHTS.cityCore,
      openPrice: parsed.openPrice ?? DEFAULT_COMPOSITE_WEIGHTS.openPrice,
      price: parsed.price ?? DEFAULT_COMPOSITE_WEIGHTS.price,
    }
  } catch {
    return DEFAULT_COMPOSITE_WEIGHTS
  }
}

function loadBoolKey(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

export const useStore = create<AppState>((set) => {
  const { minutes, zoom, mapCenter } = readUrlParams()
  const workplace = readWorkplaceFromStorage()
  return {
    workplace,
    minutes,
    zoom,
    mapCenter,
    resultPolygon: workplace ? readIsochroneCache(workplace, minutes) : null,
    noiseLayerVisible: loadBoolKey(NOISE_LAYER_KEY),
    enabledLandmarkIds: (() => {
      try {
        const raw = localStorage.getItem(CITY_CORE_LANDMARKS_KEY)
        if (!raw) return ALL_LANDMARK_IDS
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
      } catch { /* ignore */ }
      return ALL_LANDMARK_IDS
    })(),
    setWorkplace: (workplace) => {
      try {
        if (workplace) localStorage.setItem(WORKPLACE_KEY, JSON.stringify(workplace))
        else localStorage.removeItem(WORKPLACE_KEY)
      } catch { /* ignore */ }
      set({ workplace })
    },
    setMinutes: (minutes) => set({ minutes }),
    setZoom: (zoom) => set({ zoom }),
    setMapCenter: (mapCenter) => set({ mapCenter }),
    setResultPolygon: (resultPolygon) => set({ resultPolygon }),
    setNoiseLayerVisible: (visible) => {
      try { localStorage.setItem(NOISE_LAYER_KEY, String(visible)) } catch { /* ignore */ }
      set({ noiseLayerVisible: visible })
    },
    mapAttribution: '',
    setMapAttribution: (mapAttribution) => set({ mapAttribution }),
    hoveredAreaIndex: null,
    setHoveredAreaIndex: (hoveredAreaIndex) => set({ hoveredAreaIndex }),
    idealistaAreas: [],
    idealistaUrls: [],
    idealistaZonesVisible: true,
    setIdealistaAreas: (idealistaAreas, idealistaUrls) =>
      set({ idealistaAreas, idealistaUrls, idealistaZonesVisible: true }),
    clearIdealistaAreas: () =>
      set({ idealistaAreas: [], idealistaUrls: [], hoveredAreaIndex: null }),
    setIdealistaZonesVisible: (idealistaZonesVisible) => set({ idealistaZonesVisible }),
    setEnabledLandmarkIds: (ids) => {
      try { localStorage.setItem(CITY_CORE_LANDMARKS_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
      set({ enabledLandmarkIds: ids })
    },
    idealistaPricesVisible: false,
    idealistaPriceRange: [200_000, 600_000],
    idealistaPriceBounds: null,
    setIdealistaPricesVisible: (idealistaPricesVisible) => set({ idealistaPricesVisible }),
    setIdealistaPriceRange: (idealistaPriceRange) => set({ idealistaPriceRange }),
    setIdealistaPriceBounds: (idealistaPriceBounds) => set({ idealistaPriceBounds }),
    compositeVisible: loadBoolKey(COMPOSITE_VISIBLE_KEY),
    compositeWeights: loadCompositeWeights(),
    compositeScoreRange: (() => {
      try {
        const raw = localStorage.getItem(COMPOSITE_SCORE_RANGE_KEY)
        if (!raw) return [0, 100] as [number, number]
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number]
      } catch { /* ignore */ }
      return [0, 100] as [number, number]
    })(),
    setCompositeVisible: (visible) => {
      try { localStorage.setItem(COMPOSITE_VISIBLE_KEY, String(visible)) } catch { /* ignore */ }
      set({ compositeVisible: visible })
    },
    setCompositeWeights: (weights) => {
      try { localStorage.setItem(COMPOSITE_WEIGHTS_KEY, JSON.stringify(weights)) } catch { /* ignore */ }
      set({ compositeWeights: weights })
    },
    setCompositeScoreRange: (range) => {
      try { localStorage.setItem(COMPOSITE_SCORE_RANGE_KEY, JSON.stringify(range)) } catch { /* ignore */ }
      set({ compositeScoreRange: range })
    },
    selectedHexH3: null,
    setSelectedHexH3: (selectedHexH3) => set({ selectedHexH3 }),
  }
})
