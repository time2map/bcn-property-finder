import type { ServiceResult } from '../services/walkability/walkabilityTypes'

export interface PinAnalytics {
  walkingMinutes?: number
  publicTransportMinutes?: number
  cyclingMinutes?: number
  drivingMinutes?: number
  travelIndex?: number
  noiseLden?: number
  noiseScore?: number
  walkabilityScore?: number
  walkabilityServices?: ServiceResult[]
  calculatedAt: string
}

export interface PropertyPin {
  id: string
  coordinates: [number, number]
  price?: number
  area?: number
  url?: string
  photos?: string[]
  comment?: string
  bedrooms?: number
  bathrooms?: number
  floor?: string
  yearBuilt?: number
  rating?: number // subjective 1–10 score from a viewing
  analytics?: PinAnalytics
  accuracyPolygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  createdAt: string
}
