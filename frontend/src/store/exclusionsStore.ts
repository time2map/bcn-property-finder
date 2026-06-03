import { create } from 'zustand'
import type { ExclusionZone } from '../types/exclusions'

export const EXCLUSIONS_STORAGE_KEY = 'bcn_exclusion_zones'

function loadZones(): ExclusionZone[] {
  try {
    const raw = localStorage.getItem(EXCLUSIONS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ExclusionZone[]) : []
  } catch {
    return []
  }
}

function saveZones(zones: ExclusionZone[]): void {
  try {
    localStorage.setItem(EXCLUSIONS_STORAGE_KEY, JSON.stringify(zones))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

export type DrawingMode = 'polygon' | 'freehand'

export interface ExclusionsState {
  zones: ExclusionZone[]
  /** Active map drawing mode, or null when not drawing. */
  drawingMode: DrawingMode | null
  /** Adds a zone (auto-generates id). Area zones with a duplicate areaId are ignored. Returns the id. */
  addZone: (zone: Omit<ExclusionZone, 'id'>) => string
  removeZone: (id: string) => void
  clearZones: () => void
  setDrawingMode: (mode: DrawingMode | null) => void
}

export const useExclusionsStore = create<ExclusionsState>((set, get) => ({
  zones: loadZones(),
  drawingMode: null,

  addZone: (zone) => {
    if (zone.areaId) {
      const existing = get().zones.find((z) => z.areaId === zone.areaId)
      if (existing) return existing.id
    }
    const id = crypto.randomUUID()
    const zones = [...get().zones, { ...zone, id }]
    saveZones(zones)
    set({ zones })
    return id
  },

  removeZone: (id) => {
    const zones = get().zones.filter((z) => z.id !== id)
    saveZones(zones)
    set({ zones })
  },

  clearZones: () => {
    saveZones([])
    set({ zones: [] })
  },

  setDrawingMode: (mode) => set({ drawingMode: mode }),
}))
