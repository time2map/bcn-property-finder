export const features = {
  isochrone: import.meta.env.VITE_FEATURE_ISOCHRONE === 'true',
  exclusions: import.meta.env.VITE_FEATURE_EXCLUSIONS === 'true',
  pins: import.meta.env.VITE_FEATURE_PINS === 'true',
  idealistaPrices: import.meta.env.VITE_FEATURE_IDEALISTA_PRICES === 'true',
  screenshot: import.meta.env.VITE_FEATURE_SCREENSHOT === 'true',
  bestZones: import.meta.env.VITE_FEATURE_BEST_ZONES === 'true',
  localsOpinion: import.meta.env.VITE_FEATURE_LOCALS_OPINION === 'true',
  /** TODO-046: Catastro facade photo in the building card (hotlinked; terms of use not stated). */
  facadePhoto: import.meta.env.VITE_FEATURE_FACADE_PHOTO === 'true',
  /** TODO-031: profiles + one editable sentence on the first visit, and the "Your conditions" row. */
  onboarding: import.meta.env.VITE_FEATURE_ONBOARDING === 'true',
  /** TODO-051: ranked list of areas ("Your areas") and the area view below z13. */
  areas: import.meta.env.VITE_FEATURE_AREAS === 'true',
  /** TODO-076: "find your one building" funnel, a prototype opened with `?funnel` in the address (desktop). */
  oneBuilding: import.meta.env.VITE_FEATURE_ONE_BUILDING === 'true',
  /** TODO-066: commercial launch. Switches off the layers whose licences are not confirmed (docs/DATA_LICENSES.md). */
  commercialUse: import.meta.env.VITE_COMMERCIAL_USE === 'true',
} as const
