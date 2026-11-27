import { describe, it, expect } from 'vitest'
import type { BuildingArea, BuildingData } from '../buildings/buildingData'
import type { BuildingSettings } from '../buildings/buildingScore'
import { DEFAULT_CONDITIONS } from '../buildings/conditions'
import { auditSettings, guard, influence, passes } from './scoreAudit'

const AREAS: BuildingArea[] = [
  { code: '01', name: 'el Raval', kind: 'barri', price: 3000 },
  { code: '02', name: 'Sarrià', kind: 'barri', price: 6000 },
  { code: '08101', name: 'Hospitalet', kind: 'muni', price: 2000 },
]

function makeData(rows: Record<string, (number | null)[]>): BuildingData {
  const count = Object.values(rows)[0].length
  const cols = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Float32Array.from(v.map((x) => x ?? NaN))]))
  return {
    meta: {
      count, columns: [], areas: AREAS, price_bounds: { p5: 2000, p95: 6000 },
      categories: ['supermarket'], landmarks: ['placa_cat'], minutes_cap: { walk: 30, cityCore: 120 },
    },
    count, cols,
  }
}

// Three Barcelona buildings and one in Hospitalet. Building 0 meets both conditions; 1 is loud; 2 is far and pricey.
const DATA = makeData({
  min_supermarket: [3, 4, 25, 2],
  lden_avg: [55, 72, 50, 40],
  area: [0, 0, 1, 2],
  dwellings: [10, 30, 60, 500],
})

const SETTINGS: BuildingSettings = {
  weights: { poiAccess: 1, noise: 1, cityCore: 0, openPrice: 0, localsOpinion: 0, age: 0 },
  conditions: DEFAULT_CONDITIONS, enabledLandmarkIds: ['placa_cat'], enabledCategories: ['supermarket'],
  riskStrengths: { flood: 0, fire: 0, street: 0 }, ageEras: [], vibe: null,
}

describe('auditSettings (TODO-073)', () => {
  const r = auditSettings(DATA, SETTINGS)

  it('counts Barcelona homes only, weighted by dwellings', () => {
    // 100 Barcelona homes: services met by 10 + 30, noise by 10 + 60
    expect(r.metShare.poiAccess).toBeCloseTo(40)
    expect(r.metShare.noise).toBeCloseTo(70)
    expect(r.metCount.map(Math.round)).toEqual([0, 90, 10])
    expect(r.allMet).toBeCloseTo(10)
    expect(r.best).toBe(100)
    expect(r.bands.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })

  it('the influence of the conditions adds up to 100', () => {
    const sum = Object.values(r.influence).reduce((a, b) => a + b!, 0)
    expect(sum).toBeCloseTo(100)
  })
})

describe('influence', () => {
  it('a condition that never varies explains nothing', () => {
    const rows = [{ w: 1, c: [100, 0] }, { w: 1, c: [100, 100] }, { w: 2, c: [100, 50] }]
    expect(influence(['poiAccess', 'noise'], rows)).toEqual({ poiAccess: 0, noise: 100 })
  })
  it('two conditions moving together share the spread equally', () => {
    const rows = [{ w: 1, c: [0, 0] }, { w: 1, c: [100, 100] }]
    expect(influence(['poiAccess', 'noise'], rows)).toEqual({ poiAccess: 50, noise: 50 })
  })
  it('is empty without spread or rows', () => {
    expect(influence(['noise'], [])).toEqual({})
    expect(influence(['noise'], [{ w: 1, c: [50] }, { w: 1, c: [50] }])).toEqual({})
  })
})

describe('guard', () => {
  it('passes when someone meets every condition and each is met by enough homes', () => {
    expect(passes(guard(auditSettings(DATA, SETTINGS)))).toBe(true)
  })
  it('fails on a condition met by almost no home — the error that made "Centre" unmeetable', () => {
    const strict = { ...SETTINGS, conditions: { ...DEFAULT_CONDITIONS, noiseMaxDb: 45 } }
    const g = guard(auditSettings(DATA, strict))
    expect(g.someoneMeetsAll).toBe(false)
    expect(g.rare).toEqual(['noise'])
    expect(passes(g)).toBe(false)
  })
})
