/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OTP_URL: string
  readonly VITE_OTP_DEPARTURE_TIME: string
  readonly VITE_OTP_TRANSIT_MODES: string
  readonly VITE_OTP_TRANSIT_ITINERARIES: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_ANTHROPIC_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
