import { create } from 'zustand'
import type * as maplibregl from 'maplibre-gl'

/**
 * The map instance for UI that lives outside the map context, such as the "Best areas" block of the filter
 * panel (which needs the visible bounds). Set by Map.tsx.
 */
interface MapState {
  map: maplibregl.Map | null
  setMap: (map: maplibregl.Map | null) => void
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  setMap: (map) => set({ map }),
}))
