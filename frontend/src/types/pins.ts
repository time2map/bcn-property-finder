export interface PinAnalytics {
  walkingMinutes?: number
  publicTransportMinutes?: number
  cyclingMinutes?: number
  drivingMinutes?: number
  travelIndex?: number
  noiseLden?: number
  noiseScore?: number
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
  analytics?: PinAnalytics
  accuracyPolygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  createdAt: string
}
