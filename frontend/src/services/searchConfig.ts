/** Search box settings (044). Defaults live in .env.local.example / .env.production. */
export const SEARCH_MIN_CHARS = Number(import.meta.env.VITE_SEARCH_MIN_CHARS ?? 3)
export const SEARCH_DEBOUNCE_MS = Number(import.meta.env.VITE_SEARCH_DEBOUNCE_MS ?? 300)
export const SEARCH_ADDRESS_ZOOM = Number(import.meta.env.VITE_SEARCH_ADDRESS_ZOOM ?? 17)
export const SEARCH_MAX_RESULTS = Number(import.meta.env.VITE_SEARCH_MAX_RESULTS ?? 5)
