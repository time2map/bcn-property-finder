import { describe, it, expect } from 'vitest'
import { insideCoverage, locateOutcome, metresBetween, nearestBuilding, pickNearest } from './locate'

// Three homes near Sagrada Família, one far away in the north of the metro area.
const COLS = {
  lng: Float32Array.from([2.1744, 2.1750, 2.1800, 2.2400]),
  lat: Float32Array.from([41.4036, 41.4040, 41.4100, 41.5000]),
}

describe('metresBetween', () => {
  it('measures about 111 m per 0.001° of latitude', () => {
    expect(metresBetween(2.17, 41.4, 2.17, 41.401)).toBeCloseTo(110.5, 0)
  })
  it('measures shorter east-west steps at this latitude', () => {
    const d = metresBetween(2.17, 41.4, 2.171, 41.4)
    expect(d).toBeGreaterThan(80)
    expect(d).toBeLessThan(86)
  })
})

describe('nearestBuilding', () => {
  it('finds the closest home within the limit', () => {
    expect(nearestBuilding(2.17445, 41.40362, COLS, 40)).toBe(0)
    expect(nearestBuilding(2.17495, 41.40395, COLS, 40)).toBe(1)
  })
  it('returns null when every home is farther than the limit', () => {
    expect(nearestBuilding(2.1700, 41.4000, COLS, 40)).toBeNull()
  })
  it('ignores homes without a position', () => {
    const cols = { lng: Float32Array.from([NaN, 2.1744]), lat: Float32Array.from([NaN, 41.4036]) }
    expect(nearestBuilding(2.1744, 41.4036, cols, 40)).toBe(1)
  })
})

describe('insideCoverage', () => {
  it('accepts a point among the homes and rejects one far outside', () => {
    expect(insideCoverage(2.176, 41.405, COLS)).toBe(true)
    expect(insideCoverage(-3.7, 40.4, COLS)).toBe(false)
  })
})

describe('locateOutcome', () => {
  it('opens the home in front of the person', () => {
    expect(locateOutcome(2.17445, 41.40362, COLS, 40)).toEqual({ kind: 'building', row: 0 })
  })
  it('flies to the position when no home is that close', () => {
    expect(locateOutcome(2.1780, 41.4070, COLS, 40)).toEqual({ kind: 'nobuilding' })
  })
  it('says the person is outside the map area', () => {
    expect(locateOutcome(-3.7, 40.4, COLS, 40)).toEqual({ kind: 'outside' })
  })
})

describe('pickNearest', () => {
  it('takes the home whose centre is nearest to the tap', () => {
    expect(pickNearest([2, 0, 1], 2.17492, 41.40398, COLS)).toBe(1)
  })
  it('takes the first (topmost) one while positions are not loaded', () => {
    expect(pickNearest([2, 0], 2.17, 41.4, null)).toBe(2)
  })
  it('returns null for no candidates', () => {
    expect(pickNearest([], 2.17, 41.4, COLS)).toBeNull()
  })
})
