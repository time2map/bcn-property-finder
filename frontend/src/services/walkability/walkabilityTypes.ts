export interface ServiceCategory {
  id: string
  label: string
  emoji: string
  topN: number
  // Walkability scoring (decay + saturation, feature 010/017):
  // saturation — how fast this category's sub-score approaches 1. Small = one nearby object is
  //   nearly enough (essentials); large = more/closer objects keep adding (amenity richness).
  // weight — relative importance of this category in the aggregate.
  saturation: number
  weight: number
  matches: (props: Record<string, unknown>) => boolean
}

export interface ServiceResult {
  categoryId: string
  label: string
  emoji: string
  name?: string
  lat: number
  lon: number
  distanceMeters: number
  walkingMinutes: number
}
