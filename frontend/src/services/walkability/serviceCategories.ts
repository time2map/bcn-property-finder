import type { ServiceCategory } from './walkabilityTypes'

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'supermarket',
    label: 'Supermarket',
    emoji: '🏪',
    topN: 3,
    matches: (p) => p.shop === 'supermarket',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    emoji: '💊',
    topN: 1,
    matches: (p) => p.amenity === 'pharmacy',
  },
  {
    id: 'park',
    label: 'Park',
    emoji: '🌿',
    topN: 3,
    matches: (p) => p.leisure === 'park',
  },
  {
    id: 'school',
    label: 'School',
    emoji: '🎓',
    topN: 2,
    matches: (p) => p.amenity === 'school',
  },
  {
    id: 'kindergarten',
    label: 'Kindergarten',
    emoji: '🧸',
    topN: 2,
    matches: (p) => p.amenity === 'kindergarten',
  },
  {
    id: 'clinic',
    label: 'Clinic',
    emoji: '🏥',
    topN: 1,
    matches: (p) => p.amenity === 'doctors' || p.amenity === 'clinic',
  },
  {
    id: 'metro',
    label: 'Metro',
    emoji: '🚇',
    topN: 1,
    // Use station=subway only — subway_entrance gives one node per physical door (3-5 per station)
    matches: (p) => p.station === 'subway',
  },
  {
    id: 'cafe',
    label: 'Cafe',
    emoji: '☕',
    topN: 1,
    matches: (p) => p.amenity === 'cafe',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    emoji: '🍽️',
    topN: 3,
    matches: (p) => p.amenity === 'restaurant',
  },
  {
    id: 'beach',
    label: 'Beach',
    emoji: '🏖️',
    topN: 1,
    matches: (p) => p.natural === 'beach',
  },
]
