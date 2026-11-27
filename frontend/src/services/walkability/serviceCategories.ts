import i18n from '../../i18n'
import type { ServiceCategory } from './walkabilityTypes'

// `saturation` (S) tunes how quickly a category satisfies. Essentials (you only need one or two
// nearby) saturate fast → small S. Amenity richness (more & more varied is genuinely better)
// saturates slowly → large S. See walkabilityScore.ts for the decay+saturation formula.
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'supermarket',
    get label() { return i18n.t('conditions:services.supermarket') },
    emoji: '🏪',
    topN: 3,
    saturation: 1.0,
    weight: 1,
    matches: (p) => p.shop === 'supermarket',
  },
  {
    id: 'pharmacy',
    get label() { return i18n.t('conditions:services.pharmacy') },
    emoji: '💊',
    topN: 1,
    saturation: 0.8,
    weight: 1,
    matches: (p) => p.amenity === 'pharmacy',
  },
  {
    id: 'park',
    get label() { return i18n.t('conditions:services.park') },
    emoji: '🌿',
    topN: 3,
    saturation: 1.2,
    weight: 1,
    matches: (p) => p.leisure === 'park',
  },
  {
    id: 'school',
    get label() { return i18n.t('conditions:services.school') },
    emoji: '🎓',
    topN: 2,
    saturation: 1.0,
    weight: 1,
    matches: (p) => p.amenity === 'school',
  },
  {
    id: 'kindergarten',
    get label() { return i18n.t('conditions:services.kindergarten') },
    emoji: '🧸',
    topN: 2,
    saturation: 1.0,
    weight: 1,
    matches: (p) => p.amenity === 'kindergarten',
  },
  {
    id: 'clinic',
    get label() { return i18n.t('conditions:services.clinic') },
    emoji: '🏥',
    topN: 1,
    saturation: 0.8,
    weight: 1,
    matches: (p) => p.amenity === 'doctors' || p.amenity === 'clinic',
  },
  {
    id: 'metro',
    get label() { return i18n.t('conditions:services.metro') },
    emoji: '🚇',
    topN: 1,
    saturation: 0.7,
    weight: 1,
    // Use station=subway only — subway_entrance gives one node per physical door (3-5 per station)
    matches: (p) => p.station === 'subway',
  },
  {
    id: 'cafe',
    get label() { return i18n.t('conditions:services.cafe') },
    emoji: '☕',
    topN: 1,
    saturation: 3.0,
    weight: 1,
    matches: (p) => p.amenity === 'cafe',
  },
  {
    id: 'restaurant',
    get label() { return i18n.t('conditions:services.restaurant') },
    emoji: '🍽️',
    topN: 3,
    saturation: 3.0,
    weight: 1,
    matches: (p) => p.amenity === 'restaurant',
  },
  {
    id: 'beach',
    get label() { return i18n.t('conditions:services.beach') },
    emoji: '🏖️',
    topN: 1,
    saturation: 0.6,
    weight: 1,
    matches: (p) => p.natural === 'beach',
  },
]
