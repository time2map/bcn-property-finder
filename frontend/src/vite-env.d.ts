/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OTP_URL: string
  readonly VITE_OTP_DEPARTURE_TIME: string
  readonly VITE_OTP_TRANSIT_MODES: string
  readonly VITE_OTP_TRANSIT_ITINERARIES: string
  readonly VITE_SITE_URL?: string
  readonly VITE_CTA_URL?: string
  readonly VITE_CTA_UTM_SOURCE?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_ANTHROPIC_MODEL?: string
  readonly VITE_FEATURE_ISOCHRONE?: string
  readonly VITE_FEATURE_EXCLUSIONS?: string
  readonly VITE_FEATURE_PINS?: string
  readonly VITE_FEATURE_IDEALISTA_PRICES?: string
  readonly VITE_FEATURE_SCREENSHOT?: string
  readonly VITE_FEATURE_LOCALS_OPINION?: string
  readonly VITE_FEATURE_FACADE_PHOTO?: string
  readonly VITE_FEATURE_ONBOARDING?: string
  readonly VITE_FEATURE_AREAS?: string
  readonly VITE_FEATURE_ONE_BUILDING?: string
  readonly VITE_FUNNEL_STEPS?: string
  readonly VITE_FUNNEL_TARGET?: string
  readonly VITE_FUNNEL_STRICTNESS?: string
  readonly VITE_FUNNEL_MIN_DWELLINGS?: string
  readonly VITE_FLAT_AREA_M2?: string
  readonly VITE_QUIZ_FLAT_AREA_OPTIONS?: string
  readonly VITE_QUIZ_BUDGET_OPTIONS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
