import { create } from 'zustand'
import type { MultiPolygon, Polygon } from 'geojson'

export interface AppState {
  workplace: [number, number] | null
  minutes: number
  resultPolygon: Polygon | MultiPolygon | null
  setWorkplace: (wp: [number, number] | null) => void
  setMinutes: (minutes: number) => void
  setResultPolygon: (polygon: Polygon | MultiPolygon | null) => void
}

function isValidMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= 15 && n <= 120 && n % 5 === 0
}

// Plaça de Catalunya — shown on first load when no URL params are present
const DEFAULT_WORKPLACE: [number, number] = [2.1687, 41.3874]

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

export function readUrlParams(): Pick<AppState, 'workplace' | 'minutes'> {
  const params = new URLSearchParams(window.location.search)
  const lng = parseFloat(params.get('lng') ?? '')
  const lat = parseFloat(params.get('lat') ?? '')
  const rawMinutes = parseInt(params.get('minutes') ?? '', 10)

  return {
    workplace: !isNaN(lng) && !isNaN(lat) ? [lng, lat] : DEFAULT_WORKPLACE,
    minutes: isValidMinutes(rawMinutes) ? rawMinutes : 60,
  }
}

export const useStore = create<AppState>((set) => {
  const { workplace, minutes } = readUrlParams()
  return {
    workplace,
    minutes,
    // Restored synchronously from localStorage — no flash of empty state on reload
    resultPolygon: workplace ? readIsochroneCache(workplace, minutes) : null,
    setWorkplace: (workplace) => set({ workplace }),
    setMinutes: (minutes) => set({ minutes }),
    setResultPolygon: (resultPolygon) => set({ resultPolygon }),
  }
})
