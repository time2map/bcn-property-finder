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

export const useStore = create<AppState>((set) => ({
  ...readUrlParams(),
  resultPolygon: null,
  setWorkplace: (workplace) => set({ workplace }),
  setMinutes: (minutes) => set({ minutes }),
  setResultPolygon: (resultPolygon) => set({ resultPolygon }),
}))
