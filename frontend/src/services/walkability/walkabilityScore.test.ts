import { describe, it, expect } from 'vitest'
import {
  categoryAccess,
  categorySubScore,
  computeWalkabilityScore,
  WALK_DECAY_M,
  WALK_RMAX_M,
} from './walkabilityScore'
import { SERVICE_CATEGORIES } from './serviceCategories'

describe('categoryAccess (distance decay)', () => {
  it('is 0 with no objects', () => {
    expect(categoryAccess([])).toBe(0)
  })

  it('weights a co-located object as 1 and decays with distance', () => {
    expect(categoryAccess([0])).toBeCloseTo(1, 5)
    expect(categoryAccess([WALK_DECAY_M])).toBeCloseTo(Math.exp(-1), 5) // ~0.368
    expect(categoryAccess([0])).toBeGreaterThan(categoryAccess([WALK_DECAY_M]))
  })

  it('ignores objects beyond the max radius', () => {
    expect(categoryAccess([WALK_RMAX_M + 1])).toBe(0)
  })

  it('accumulates multiple objects', () => {
    expect(categoryAccess([0, 0])).toBeCloseTo(2, 5)
    expect(categoryAccess([0, 0])).toBeGreaterThan(categoryAccess([0]))
  })
})

describe('categorySubScore (saturation)', () => {
  it('is 0 with no objects and within (0,1) otherwise', () => {
    expect(categorySubScore([], 1)).toBe(0)
    const s = categorySubScore([100], 1)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  it('increases with more objects but with diminishing returns', () => {
    const one = categorySubScore([0], 1)
    const two = categorySubScore([0, 0], 1)
    const three = categorySubScore([0, 0, 0], 1)
    expect(two).toBeGreaterThan(one)
    expect(three).toBeGreaterThan(two)
    // each extra object adds less than the previous
    expect(two - one).toBeLessThan(one)
    expect(three - two).toBeLessThan(two - one)
  })
})

describe('computeWalkabilityScore', () => {
  const allCategories = (distancesM: number[]) =>
    new Map(SERVICE_CATEGORIES.map((c) => [c.id, distancesM]))

  it('returns 0 for an empty map', () => {
    expect(computeWalkabilityScore(new Map())).toBe(0)
  })

  it('rewards closer objects', () => {
    const near = computeWalkabilityScore(new Map([['supermarket', [100]]]))
    const far = computeWalkabilityScore(new Map([['supermarket', [1400]]]))
    expect(near).toBeGreaterThan(far)
  })

  it('rewards more objects of the same category', () => {
    const few = computeWalkabilityScore(new Map([['supermarket', [200]]]))
    const many = computeWalkabilityScore(new Map([['supermarket', [200, 250, 300, 350]]]))
    expect(many).toBeGreaterThan(few)
  })

  it('rewards broader category coverage', () => {
    const single = computeWalkabilityScore(new Map([['supermarket', [100]]]))
    const broad = computeWalkabilityScore(allCategories([100]))
    expect(broad).toBeGreaterThan(single)
  })

  it('approaches 100 when every category is richly served nearby', () => {
    const rich = computeWalkabilityScore(allCategories([50, 100, 150, 200, 250]))
    expect(rich).toBeGreaterThan(85)
  })
})
