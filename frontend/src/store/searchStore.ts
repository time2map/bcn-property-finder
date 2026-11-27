import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'
import type { Bounds } from '../services/bestZonesConfig'

/** What the search box picked (044). The map-side component reacts to it. */
export type SearchSelection =
  | { kind: 'area'; requestId: number; label: string; bounds: Bounds; outline: FeatureCollection }
  | { kind: 'address'; requestId: number; label: string; coords: [number, number] }

interface SearchState {
  selection: SearchSelection | null
  /** The search field is open (the brand bar's search button toggles it). */
  open: boolean
  setOpen: (open: boolean) => void
  selectArea: (label: string, bounds: Bounds, outline: FeatureCollection) => void
  selectAddress: (label: string, coords: [number, number]) => void
  clear: () => void
}

let nextRequestId = 1

export const useSearchStore = create<SearchState>((set) => ({
  selection: null,
  open: false,
  // Closing also drops the picked place, so the field and the outline never disagree.
  setOpen: (open) => set(open ? { open } : { open, selection: null }),
  selectArea: (label, bounds, outline) =>
    set({ selection: { kind: 'area', requestId: nextRequestId++, label, bounds, outline } }),
  selectAddress: (label, coords) =>
    set({ selection: { kind: 'address', requestId: nextRequestId++, label, coords } }),
  clear: () => set({ selection: null }),
}))
