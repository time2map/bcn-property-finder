export interface IdealistaProperty {
  id: string
  url: string

  price: number
  pricePerSqm: number

  areaSqm: number
  bedrooms: number
  bathrooms: number

  street: string
  neighborhood: string
  city: string

  floor: string
  hasLift: boolean
  yearBuilt: number | null

  orientation: string[]
  condition: string
  amenities: string[]
  basicFeatures: string[]

  description: string

  energyConsumption: string | null
  energyCO2: string | null

  photos: string[]
}
