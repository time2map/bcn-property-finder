import { create } from 'zustand'

/** The "About and data sources" dialog (TODO-066): opened from the brand bar, the phone buttons and the map credit. */
interface AboutState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useAboutStore = create<AboutState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
