export interface ServiceCategory {
  id: string
  label: string
  emoji: string
  topN: number
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
