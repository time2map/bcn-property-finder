import { create } from 'zustand'
import type { Polygon } from 'geojson'

export type TransportMode = 'foot-walking' | 'cycling-regular' | 'driving-car'

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

const VALID_MODES: TransportMode[] = ['foot-walking', 'cycling-regular', 'driving-car']
const VALID_MINUTES = [15, 20, 30, 45]

export function readUrlParams(): Pick<AppState, 'workplace' | 'mode' | 'minutes'> {
  const params = new URLSearchParams(window.location.search)
  const lng = parseFloat(params.get('lng') ?? '')
  const lat = parseFloat(params.get('lat') ?? '')
  const rawMode = params.get('mode') as TransportMode
  const rawMinutes = parseInt(params.get('minutes') ?? '', 10)

  return {
    workplace: !isNaN(lng) && !isNaN(lat) ? [lng, lat] : null,
    mode: VALID_MODES.includes(rawMode) ? rawMode : 'foot-walking',
    minutes: VALID_MINUTES.includes(rawMinutes) ? rawMinutes : 30,
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
