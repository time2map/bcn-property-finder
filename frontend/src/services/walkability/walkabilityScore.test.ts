import { describe, it, expect } from 'vitest'
import { computeWalkabilityScore, WALKABILITY_THRESHOLD_M } from './walkabilityScore'
import { SERVICE_CATEGORIES } from './serviceCategories'
import type { ServiceResult } from './walkabilityTypes'

function makeService(categoryId: string, distanceMeters: number): ServiceResult {
  const cat = SERVICE_CATEGORIES.find((c) => c.id === categoryId)!
  return {
    categoryId,
    label: cat.label,
    emoji: cat.emoji,
    lat: 41.385,
    lon: 2.173,
    distanceMeters,
    walkingMinutes: Math.round(distanceMeters * 1.3 / 80),
  }
}

describe('computeWalkabilityScore', () => {
  it('returns 100 when all categories have a nearby service', () => {
    const services = SERVICE_CATEGORIES.map((cat) =>
      makeService(cat.id, WALKABILITY_THRESHOLD_M - 1),
    )
    expect(computeWalkabilityScore(services)).toBe(100)
  })

  it('returns 0 when no services are within threshold', () => {
    const services = SERVICE_CATEGORIES.map((cat) =>
      makeService(cat.id, WALKABILITY_THRESHOLD_M + 1),
    )
    expect(computeWalkabilityScore(services)).toBe(0)
  })

  it('returns 0 for empty services array', () => {
    expect(computeWalkabilityScore([])).toBe(0)
  })

  it('counts each category at most once even if multiple results present', () => {
    // Two pharmacies within threshold — should still count as 1 category
    const services = [
      makeService('pharmacy', 300),
      makeService('pharmacy', 500),
    ]
    const expected = Math.round(1 / SERVICE_CATEGORIES.length * 100)
    expect(computeWalkabilityScore(services)).toBe(expected)
  })

  it('excludes services exactly at threshold boundary', () => {
    const at = makeService('supermarket', WALKABILITY_THRESHOLD_M)
    const over = makeService('pharmacy', WALKABILITY_THRESHOLD_M + 1)
    // at threshold is NOT within (<= check)
    const score = computeWalkabilityScore([at, over])
    // at is <= WALKABILITY_THRESHOLD_M so it IS counted
    expect(score).toBe(Math.round(1 / SERVICE_CATEGORIES.length * 100))
  })

  it('returns partial score for mixed coverage', () => {
    // 5 out of 10 categories within threshold = 50%
    const within = ['supermarket', 'pharmacy', 'park', 'metro', 'cafe'].map((id) =>
      makeService(id, 500),
    )
    const outside = ['school', 'kindergarten', 'clinic', 'restaurant', 'beach'].map((id) =>
      makeService(id, 2000),
    )
    const score = computeWalkabilityScore([...within, ...outside])
    expect(score).toBe(50)
  })
})
