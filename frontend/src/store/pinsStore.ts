import { create } from 'zustand'
import type { PropertyPin, PinAnalytics } from '../types/pins'

const STORAGE_KEY = 'bcn_property_pins'

function loadPins(): PropertyPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PropertyPin[]) : []
  } catch {
    return []
  }
}

function savePins(pins: PropertyPin[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

export interface PinsState {
  pins: PropertyPin[]
  selectedPinId: string | null
  isAddingPin: boolean
  addPin: (lngLat: [number, number]) => string
  addParsedPin: (pin: PropertyPin) => void
  updatePin: (id: string, patch: Partial<PropertyPin>) => void
  updatePinAnalytics: (id: string, analytics: PinAnalytics) => void
  deletePin: (id: string) => void
  setSelectedPin: (id: string | null) => void
  setIsAddingPin: (val: boolean) => void
}

export const usePinsStore = create<PinsState>((set, get) => ({
  pins: loadPins(),
  selectedPinId: null,
  isAddingPin: false,

  addPin: (lngLat) => {
    const id = crypto.randomUUID()
    const pin: PropertyPin = {
      id,
      coordinates: lngLat,
      createdAt: new Date().toISOString(),
    }
    const pins = [...get().pins, pin]
    savePins(pins)
    set({ pins, selectedPinId: id })
    return id
  },

  addParsedPin: (pin) => {
    const pins = [...get().pins, pin]
    savePins(pins)
    set({ pins, selectedPinId: pin.id })
  },

  updatePin: (id, patch) => {
    const pins = get().pins.map((p) => (p.id === id ? { ...p, ...patch } : p))
    savePins(pins)
    set({ pins })
  },

  updatePinAnalytics: (id, analytics) => {
    const pins = get().pins.map((p) => (p.id === id ? { ...p, analytics } : p))
    savePins(pins)
    set({ pins })
  },

  deletePin: (id) => {
    const pins = get().pins.filter((p) => p.id !== id)
    savePins(pins)
    set({ pins, selectedPinId: get().selectedPinId === id ? null : get().selectedPinId })
  },

  setSelectedPin: (id) => set({ selectedPinId: id }),
  setIsAddingPin: (val) => set({ isAddingPin: val }),
}))
