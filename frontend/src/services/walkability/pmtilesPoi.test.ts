import { describe, it, expect } from 'vitest'
import { haversineMeters, estimateWalkingMinutes, DETOUR_FACTOR, WALK_SPEED_M_PER_MIN } from './pmtilesPoi'
import { SERVICE_CATEGORIES } from './serviceCategories'

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(41.385, 2.173, 41.385, 2.173)).toBe(0)
  })

  it('returns a positive distance for different coordinates', () => {
    const dist = haversineMeters(41.385, 2.173, 41.395, 2.183)
    expect(dist).toBeGreaterThan(0)
  })

  it('approximates ~1km for ~0.009° lat difference at Barcelona latitude', () => {
    // ~1 degree lat ≈ 111.32 km → 0.009° ≈ 1001 m
    const dist = haversineMeters(41.385, 2.173, 41.394, 2.173)
    expect(dist).toBeGreaterThan(950)
    expect(dist).toBeLessThan(1050)
  })

  it('is symmetric', () => {
    const d1 = haversineMeters(41.385, 2.173, 41.395, 2.183)
    const d2 = haversineMeters(41.395, 2.183, 41.385, 2.173)
    expect(d1).toBeCloseTo(d2, 0)
  })
})

describe('estimateWalkingMinutes', () => {
  it('applies detour factor and walking speed', () => {
    const dist = 800
    const expected = Math.round((dist * DETOUR_FACTOR) / WALK_SPEED_M_PER_MIN)
    expect(estimateWalkingMinutes(dist)).toBe(expected)
  })

  it('rounds to integer', () => {
    expect(Number.isInteger(estimateWalkingMinutes(777))).toBe(true)
  })

  it('returns 0 for 0 distance', () => {
    expect(estimateWalkingMinutes(0)).toBe(0)
  })

  it('15-min threshold is ~923m straight-line', () => {
    // 15 min × 80 m/min / 1.3 ≈ 923 m
    const threshold = (15 * WALK_SPEED_M_PER_MIN) / DETOUR_FACTOR
    expect(threshold).toBeCloseTo(923, 0)
    expect(estimateWalkingMinutes(threshold)).toBe(15)
  })
})

describe('SERVICE_CATEGORIES matchers', () => {
  const cat = (id: string) => SERVICE_CATEGORIES.find((c) => c.id === id)!

  it('supermarket matches shop=supermarket', () => {
    expect(cat('supermarket').matches({ shop: 'supermarket' })).toBe(true)
    expect(cat('supermarket').matches({ shop: 'grocery' })).toBe(false)
  })

  it('pharmacy matches amenity=pharmacy', () => {
    expect(cat('pharmacy').matches({ amenity: 'pharmacy' })).toBe(true)
    expect(cat('pharmacy').matches({ amenity: 'hospital' })).toBe(false)
  })

  it('park matches leisure=park', () => {
    expect(cat('park').matches({ leisure: 'park' })).toBe(true)
    expect(cat('park').matches({ leisure: 'playground' })).toBe(false)
  })

  it('school matches amenity=school', () => {
    expect(cat('school').matches({ amenity: 'school' })).toBe(true)
    expect(cat('school').matches({ amenity: 'university' })).toBe(false)
  })

  it('kindergarten matches amenity=kindergarten', () => {
    expect(cat('kindergarten').matches({ amenity: 'kindergarten' })).toBe(true)
    expect(cat('kindergarten').matches({ amenity: 'school' })).toBe(false)
  })

  it('clinic matches amenity=doctors or amenity=clinic', () => {
    expect(cat('clinic').matches({ amenity: 'doctors' })).toBe(true)
    expect(cat('clinic').matches({ amenity: 'clinic' })).toBe(true)
    expect(cat('clinic').matches({ amenity: 'pharmacy' })).toBe(false)
  })

  it('metro matches station=subway (not subway_entrance)', () => {
    expect(cat('metro').matches({ station: 'subway' })).toBe(true)
    expect(cat('metro').matches({ railway: 'subway_entrance' })).toBe(false)
  })

  it('cafe matches only amenity=cafe (not restaurant)', () => {
    expect(cat('cafe').matches({ amenity: 'cafe' })).toBe(true)
    expect(cat('cafe').matches({ amenity: 'restaurant' })).toBe(false)
    expect(cat('cafe').matches({ amenity: 'bar' })).toBe(false)
  })

  it('restaurant matches only amenity=restaurant', () => {
    expect(cat('restaurant').matches({ amenity: 'restaurant' })).toBe(true)
    expect(cat('restaurant').matches({ amenity: 'cafe' })).toBe(false)
  })

  it('metro matches only station=subway (not subway_entrance)', () => {
    expect(cat('metro').matches({ station: 'subway' })).toBe(true)
    expect(cat('metro').matches({ railway: 'subway_entrance' })).toBe(false)
    expect(cat('metro').matches({ railway: 'tram_stop' })).toBe(false)
  })

  it('beach matches natural=beach', () => {
    expect(cat('beach').matches({ natural: 'beach' })).toBe(true)
    expect(cat('beach').matches({ natural: 'coastline' })).toBe(false)
  })
})
