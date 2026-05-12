import { create } from 'zustand'
import type { Polygon } from 'geojson'

export type TransportMode = 'foot' | 'cycling' | 'driving'

export interface AppState {
  workplace: [number, number] | null
  mode: TransportMode
  minutes: number
  resultPolygon: Polygon | null
  setWorkplace: (wp: [number, number] | null) => void
  setMode: (mode: TransportMode) => void
  setMinutes: (minutes: number) => void
  setResultPolygon: (polygon: Polygon | null) => void
}

const VALID_MODES: TransportMode[] = ['foot', 'cycling', 'driving']

function isValidMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= 15 && n <= 120 && n % 5 === 0
}

// Plaça de Catalunya — shown on first load when no URL params are present
const DEFAULT_WORKPLACE: [number, number] = [2.1687, 41.3874]

export function readUrlParams(): Pick<AppState, 'workplace' | 'mode' | 'minutes'> {
  const params = new URLSearchParams(window.location.search)
  const lng = parseFloat(params.get('lng') ?? '')
  const lat = parseFloat(params.get('lat') ?? '')
  const rawMode = params.get('mode') as TransportMode
  const rawMinutes = parseInt(params.get('minutes') ?? '', 10)

  return {
    workplace: !isNaN(lng) && !isNaN(lat) ? [lng, lat] : DEFAULT_WORKPLACE,
    mode: VALID_MODES.includes(rawMode) ? rawMode : 'foot',
    minutes: isValidMinutes(rawMinutes) ? rawMinutes : 60,
  }
}

export const useStore = create<AppState>((set) => ({
  ...readUrlParams(),
  resultPolygon: null,
  setWorkplace: (workplace) => set({ workplace }),
  setMode: (mode) => set({ mode }),
  setMinutes: (minutes) => set({ minutes }),
  setResultPolygon: (resultPolygon) => set({ resultPolygon }),
}))
