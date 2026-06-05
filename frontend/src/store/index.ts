import { create } from 'zustand'
import type { MultiPolygon, Polygon } from 'geojson'

export interface AppState {
  workplace: [number, number] | null
  minutes: number
  zoom: number
  mapCenter: [number, number]
  resultPolygon: Polygon | MultiPolygon | null
  noiseLayerVisible: boolean
  // Livability index layer (H3 grid) — feature 017
  livabilityVisible: boolean
  livabilityConsiderNoise: boolean
  mapAttribution: string
  // Index of the export area being hovered (in panel or on map), for cross-highlighting. null = none.
  hoveredAreaIndex: number | null
  // Idealista export areas — computed on demand (button click), not reactively.
  // Both arrays are parallel (same length).
  idealistaAreas: Polygon[]
  idealistaUrls: string[]
  // Whether the export area zones are shown on the map (user can toggle while links stay).
  idealistaZonesVisible: boolean
  // Area boundaries layer (barris / districts / municipalities) — feature 020
  barrioBoundariesVisible: boolean
  // Idealista price heatmap layer — feature 019
  idealistaPricesVisible: boolean
  idealistaPriceRange: [number, number]
  idealistaPriceBounds: [number, number] | null
  idealistaPricesMode: 'dots' | 'index'
  setWorkplace: (wp: [number, number] | null) => void
  setMinutes: (minutes: number) => void
  setZoom: (zoom: number) => void
  setMapCenter: (center: [number, number]) => void
  setResultPolygon: (polygon: Polygon | MultiPolygon | null) => void
  setNoiseLayerVisible: (visible: boolean) => void
  setLivabilityVisible: (visible: boolean) => void
  setLivabilityConsiderNoise: (consider: boolean) => void
  setMapAttribution: (attribution: string) => void
  setHoveredAreaIndex: (index: number | null) => void
  setIdealistaAreas: (areas: Polygon[], urls: string[]) => void
  clearIdealistaAreas: () => void
  setIdealistaZonesVisible: (visible: boolean) => void
  setBarrioBoundariesVisible: (visible: boolean) => void
  setIdealistaPricesVisible: (visible: boolean) => void
  setIdealistaPriceRange: (range: [number, number]) => void
  setIdealistaPriceBounds: (bounds: [number, number]) => void
  setIdealistaPricesMode: (mode: 'dots' | 'index') => void
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
const LIVABILITY_VISIBLE_KEY = 'bcn_livability_visible'
const LIVABILITY_NOISE_KEY = 'bcn_livability_consider_noise'
const BARRIO_BOUNDARIES_VISIBLE_KEY = 'bcn_barrio_boundaries_visible'

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

function loadNoiseLayerVisible(): boolean {
  try {
    return localStorage.getItem(NOISE_LAYER_KEY) === 'true'
  } catch {
    return false
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
    // Restored synchronously from localStorage — no flash of empty state on reload
    resultPolygon: workplace ? readIsochroneCache(workplace, minutes) : null,
    noiseLayerVisible: loadNoiseLayerVisible(),
    livabilityVisible: loadBoolKey(LIVABILITY_VISIBLE_KEY),
    livabilityConsiderNoise: loadBoolKey(LIVABILITY_NOISE_KEY),
    barrioBoundariesVisible: (() => {
      // default ON: show boundaries unless user has explicitly turned them off
      const v = localStorage.getItem(BARRIO_BOUNDARIES_VISIBLE_KEY)
      return v === null ? true : v === 'true'
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
    setLivabilityVisible: (visible) => {
      try { localStorage.setItem(LIVABILITY_VISIBLE_KEY, String(visible)) } catch { /* ignore */ }
      set({ livabilityVisible: visible })
    },
    setLivabilityConsiderNoise: (consider) => {
      try { localStorage.setItem(LIVABILITY_NOISE_KEY, String(consider)) } catch { /* ignore */ }
      set({ livabilityConsiderNoise: consider })
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
    idealistaPricesVisible: false,
    idealistaPriceRange: [200_000, 600_000],
    idealistaPriceBounds: null,
    idealistaPricesMode: 'dots',
    setBarrioBoundariesVisible: (visible) => {
      try { localStorage.setItem(BARRIO_BOUNDARIES_VISIBLE_KEY, String(visible)) } catch { /* ignore */ }
      set({ barrioBoundariesVisible: visible })
    },
    setIdealistaPricesVisible: (idealistaPricesVisible) => set({ idealistaPricesVisible }),
    setIdealistaPriceRange: (idealistaPriceRange) => set({ idealistaPriceRange }),
    setIdealistaPriceBounds: (idealistaPriceBounds) => set({ idealistaPriceBounds }),
    setIdealistaPricesMode: (idealistaPricesMode) => set({ idealistaPricesMode }),
  }
})
