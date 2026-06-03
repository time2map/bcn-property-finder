import { create } from 'zustand'

const STORAGE_KEY = 'bcn_idealista_base_url'

function readFromStorage(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

interface IdealistaBaseUrlState {
  baseUrl: string | null
  setBaseUrl: (url: string) => void
  clearBaseUrl: () => void
}

export const useIdealistaBaseUrlStore = create<IdealistaBaseUrlState>((set) => ({
  baseUrl: readFromStorage(),
  setBaseUrl: (url) => {
    try { localStorage.setItem(STORAGE_KEY, url) } catch { /* ignore */ }
    set({ baseUrl: url })
  },
  clearBaseUrl: () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ baseUrl: null })
  },
}))
