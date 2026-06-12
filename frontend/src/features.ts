export const features = {
  isochrone: import.meta.env.VITE_FEATURE_ISOCHRONE === 'true',
  exclusions: import.meta.env.VITE_FEATURE_EXCLUSIONS === 'true',
  pins: import.meta.env.VITE_FEATURE_PINS === 'true',
  idealistaPrices: import.meta.env.VITE_FEATURE_IDEALISTA_PRICES === 'true',
  screenshot: import.meta.env.VITE_FEATURE_SCREENSHOT === 'true',
} as const
