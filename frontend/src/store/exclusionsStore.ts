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

const EXCLUSIONS_VISIBLE_KEY = 'bcn_exclusion_zones_visible'

function loadExclusionsVisible(): boolean {
  try {
    const v = localStorage.getItem(EXCLUSIONS_VISIBLE_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export interface ExclusionsState {
  zones: ExclusionZone[]
  /** Active map drawing mode, or null when not drawing. */
  drawingMode: DrawingMode | null
  /** Whether the exclusion zones layer is visible on the map. */
  exclusionsVisible: boolean
  /** Adds a zone (auto-generates id). Area zones with a duplicate areaId are ignored. Returns the id. */
  addZone: (zone: Omit<ExclusionZone, 'id'>) => string
  removeZone: (id: string) => void
  clearZones: () => void
  setDrawingMode: (mode: DrawingMode | null) => void
  setExclusionsVisible: (visible: boolean) => void
}

export const useExclusionsStore = create<ExclusionsState>((set, get) => ({
  zones: loadZones(),
  drawingMode: null,
  exclusionsVisible: loadExclusionsVisible(),

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

  setExclusionsVisible: (visible) => {
    try { localStorage.setItem(EXCLUSIONS_VISIBLE_KEY, String(visible)) } catch { /* ignore */ }
    set({ exclusionsVisible: visible })
  },
}))
