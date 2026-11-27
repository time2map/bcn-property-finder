import { create } from 'zustand'
import type { SheetPosition } from '../services/sheetSnap'

/** An area picked from "Your areas", shown in the sheet at peek (TODO-062). */
export interface PickedArea { name: string; share: number }

interface SheetState {
  position: SheetPosition
  /** How far the map is pushed up by the sheet, in px (peek or half). */
  mapInset: number
  /** Tab of the conditions panel: shared by the panel and the sheet header. */
  tab: 'settings' | 'areas'
  pickedArea: PickedArea | null
  /** Position to return to when the building view closes. */
  restore: SheetPosition | null
  setPosition: (p: SheetPosition) => void
  setMapInset: (px: number) => void
  setTab: (tab: 'settings' | 'areas') => void
  /** The map flies to the area; the sheet drops to peek and says which one. */
  pickArea: (area: PickedArea) => void
  backToList: () => void
  openBuilding: () => void
  closeBuilding: () => void
}

export const useSheetStore = create<SheetState>((set, get) => ({
  position: 'peek',
  mapInset: 0,
  tab: 'settings',
  pickedArea: null,
  restore: null,
  // Opening the sheet any further ends the "area picked" note.
  setPosition: (position) => set(position === 'peek' ? { position } : { position, pickedArea: null }),
  setMapInset: (mapInset) => set({ mapInset }),
  setTab: (tab) => set({ tab }),
  pickArea: (pickedArea) => set({ pickedArea, position: 'peek' }),
  backToList: () => set({ pickedArea: null, tab: 'areas', position: 'half' }),
  // A building opens at peek, so it stays visible on the map; the previous position comes back on close.
  openBuilding: () => set((s) => ({ restore: s.restore ?? s.position, position: 'peek', pickedArea: null })),
  closeBuilding: () => {
    const { restore } = get()
    set({ position: restore ?? get().position, restore: null })
  },
}))
