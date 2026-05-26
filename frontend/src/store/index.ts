import { create } from 'zustand'
import type { MultiPolygon, Polygon } from 'geojson'

export interface AppState {
  workplace: [number, number] | null
  minutes: number
  zoom: number
  mapCenter: [number, number]
  resultPolygon: Polygon | MultiPolygon | null
  noiseLayerVisible: boolean
  mapAttribution: string
  setWorkplace: (wp: [number, number] | null) => void
  setMinutes: (minutes: number) => void
  setZoom: (zoom: number) => void
  setMapCenter: (center: [number, number]) => void
  setResultPolygon: (polygon: Polygon | MultiPolygon | null) => void
  setNoiseLayerVisible: (visible: boolean) => void
  setMapAttribution: (attribution: string) => void
}

function isValidMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= 15 && n <= 120 && n % 5 === 0
}

// Plaça de Catalunya — shown on first load when no URL params are present
const DEFAULT_WORKPLACE: [number, number] = [2.1687, 41.3874]

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

export function readUrlParams(): Pick<AppState, 'workplace' | 'minutes' | 'zoom' | 'mapCenter'> {
  const params = new URLSearchParams(window.location.search)
  const lng = parseFloat(params.get('lng') ?? '')
  const lat = parseFloat(params.get('lat') ?? '')
  const cx = parseFloat(params.get('cx') ?? '')
  const cy = parseFloat(params.get('cy') ?? '')
  const rawMinutes = parseInt(params.get('minutes') ?? '', 10)
  const rawZoom = parseFloat(params.get('zoom') ?? '')

  return {
    workplace: !isNaN(lng) && !isNaN(lat) ? [lng, lat] : DEFAULT_WORKPLACE,
    mapCenter: !isNaN(cx) && !isNaN(cy) ? [cx, cy] : DEFAULT_CENTER,
    minutes: isValidMinutes(rawMinutes) ? rawMinutes : 60,
    zoom: !isNaN(rawZoom) && rawZoom >= 1 && rawZoom <= 22 ? rawZoom : DEFAULT_ZOOM,
  }
}

const NOISE_LAYER_KEY = 'bcn_noise_layer_visible'

function loadNoiseLayerVisible(): boolean {
  try {
    return localStorage.getItem(NOISE_LAYER_KEY) === 'true'
  } catch {
    return false
  }
}

export const useStore = create<AppState>((set) => {
  const { workplace, minutes, zoom, mapCenter } = readUrlParams()
  return {
    workplace,
    minutes,
    zoom,
    mapCenter,
    // Restored synchronously from localStorage — no flash of empty state on reload
    resultPolygon: workplace ? readIsochroneCache(workplace, minutes) : null,
    noiseLayerVisible: loadNoiseLayerVisible(),
    setWorkplace: (workplace) => set({ workplace }),
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
  }
})
