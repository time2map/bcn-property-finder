import { describe, it, expect } from 'vitest'
import { floodRisk } from '../climateRisk/climateRisk'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import type { BuildingArea, BuildingData } from './buildingData'
import { DEFAULT_CONDITIONS } from './conditions'
import {
  buildingBundle, buildingRisks, doorWaterSeverity, riverZoneShares, scoreAll, scoreBuilding, scoredNoise,
  type BuildingSettings,
} from './buildingScore'

const AREAS: BuildingArea[] = [
  { code: '01', name: 'el Raval', kind: 'barri', price: 4000 },
  { code: '08101', name: "L'Hospitalet de Llobregat", kind: 'muni', price: 2500 },
]

/** Building rows as columns (null = no data), like the decoded score blob. */
function makeData(rows: Record<string, (number | null)[]>): BuildingData {
  const count = Object.values(rows)[0].length
  const cols = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Float32Array.from(v.map((x) => x ?? NaN))]))
  return {
    meta: {
      count, columns: [], areas: AREAS, price_bounds: { p5: 2000, p95: 6000 },
      categories: ['supermarket', 'school', 'park'], landmarks: ['sagrada', 'placa_cat'],
      // The reach of data built since TODO-073: far enough for every slider limit.
      minutes_cap: { walk: 30, cityCore: 120 },
    },
    count,
    cols,
  }
}

// Building 0 in el Raval, building 1 in L'Hospitalet (no noise map, no year).
const DATA = makeData({
  min_supermarket: [3, 12], min_school: [12, 8], min_park: [null, 4],
  cc_sagrada: [10, 80], cc_placa_cat: [45, null],
  lden_avg: [62.4, null], area: [0, 1],
  river_zone: [null, 100], fire_wui: [0, 1], fire_hazard: [0, 0.4],
  street_t10_cm: [30, null], street_t100_cm: [60, null], year_built: [1965, null],
})

const VIBE = { barris: { '01': { satisfAdj: 7.2, lowN: false } } } as unknown as BarriVibeData

const SETTINGS: BuildingSettings = {
  weights: { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1, localsOpinion: 1, age: 0 },
  conditions: DEFAULT_CONDITIONS, // services ≤ 10 min, ≤ 65 dB, places ≤ 30 min, ≤ €4,000/m², residents ≥ 7.5
  enabledLandmarkIds: ['sagrada', 'placa_cat'],
  enabledCategories: ['supermarket', 'school', 'park'],
  riskStrengths: { flood: 5, fire: 5, street: 5 },
  ageEras: ['1900-1939', '1980-2006', '2007-on'],
  vibe: VIBE,
}

describe('building risks', () => {
  it('river zone → the band penalties, by the chance of a flood within 30 years (036, TODO-073)', () => {
    expect(floodRisk(riverZoneShares(10))).toBe(1)
    expect(floodRisk(riverZoneShares(100))).toBeCloseTo(0.27)
    expect(floodRisk(riverZoneShares(500))).toBeCloseTo(0.06)
    expect(floodRisk(riverZoneShares(null))).toBe(0)
  })

  it('water at the door: 0 up to 10 cm, full from 50 cm', () => {
    expect([5, 30, 60, null].map((cm) => doorWaterSeverity(cm))).toEqual([0, 0.5, 1, 0])
  })

  it('street flooding combines the 10- and 100-year rain like the river bands', () => {
    // T10 30 cm → 0.5; T100 60 cm → 1 → 0.5 × 1 + (1 − 0.5) × 0.27
    expect(buildingRisks(DATA, 0).street).toBeCloseTo(0.635)
    expect(buildingRisks(DATA, 1)).toEqual({ flood: expect.closeTo(0.27), fire: expect.closeTo(0.4), street: 0 })
  })
})

describe('conditions per building (049)', () => {
  it('scores each condition from the building columns', () => {
    expect(buildingBundle(DATA, 0, SETTINGS)).toEqual({
      components: {
        poiAccess: 60, // supermarket 3 min → 100, school 12 → 80, park out of reach → 0
        noise: 100, // 62.4 dB within 65
        cityCore: 75, // Sagrada 10 min → 100, Plaça Catalunya 45 → 50
        openPrice: 100, // €4,000 within the budget
        localsOpinion: 70, // 7.2 vs 7.5
        age: 0, // 1965: post-war boom, not a liked era
      },
      localsLowN: false,
      risks: buildingRisks(DATA, 0),
    })
  })

  it("outside Barcelona: municipality price, no Locals' opinion; unknown noise and year are missing data", () => {
    expect(buildingBundle(DATA, 1, SETTINGS).components).toEqual({
      poiAccess: 93, cityCore: 0, noise: null, openPrice: 100, localsOpinion: null, age: null,
    })
  })

  it('data built before TODO-073 reach 19 min: a service then scores 0 there, not at twice the limit', () => {
    const before = { ...DATA, meta: { ...DATA.meta, minutes_cap: undefined } }
    // school 12 min with a 10-min limit: 0 at 18.75 min instead of 20 → 77 instead of 80
    expect(buildingBundle(before, 0, SETTINGS).components.poiAccess).toBe(59)
    // City Core: 45 min with a 30-min limit is still 0 at 60 min (the old reach was 90)
    expect(buildingBundle(before, 0, SETTINGS).components.cityCore).toBe(75)
  })

  it('a stricter condition lowers the score; dropping a service changes walkability', () => {
    const strict = scoreBuilding(DATA, 0, { ...SETTINGS, conditions: { ...DEFAULT_CONDITIONS, noiseMaxDb: 55 } })
    expect(strict.components.noise).toBe(26)
    expect(strict.score).toBeLessThan(scoreBuilding(DATA, 0, SETTINGS).score)
    expect(buildingBundle(DATA, 0, { ...SETTINGS, enabledCategories: ['supermarket', 'park'] }).components.poiAccess).toBe(50)
  })

  it('the mean over the conditions that are on, then the street-flooding penalty', () => {
    // (60 + 100 + 75 + 100 + 70) / 5 = 81; street risk 0.635 at strength 5 → × 0.6825
    expect(scoreBuilding(DATA, 0, SETTINGS)).toMatchObject({ baseScore: 81, score: 55 })
  })

  it("building age against the user's eras (047)", () => {
    const weights = { ...SETTINGS.weights, age: 1 }
    expect(scoreBuilding(DATA, 0, { ...SETTINGS, weights, ageEras: ['1940-1979'] }).score)
      .toBeGreaterThan(scoreBuilding(DATA, 0, { ...SETTINGS, weights }).score)
  })
})

describe('scoreAll', () => {
  it('scores every building and flags missing data', () => {
    const { score, gap } = scoreAll(DATA, SETTINGS)
    expect(score[0]).toBe(scoreBuilding(DATA, 0, SETTINGS).score)
    expect([...gap]).toEqual([0, 1]) // building 1 has no noise data and no Locals' opinion (outside Barcelona)
  })

  it('scoreAll holds the max score; scoreBuilding gives the range for a building with a gap (060)', () => {
    const { score, gap } = scoreAll(DATA, SETTINGS)
    const r = scoreBuilding(DATA, 1, SETTINGS)
    expect(gap[1]).toBe(1)
    expect(score[1]).toBe(r.score)
    expect(r.scoreMin).toBeLessThan(r.score)
    const full = scoreBuilding(DATA, 0, SETTINGS)
    expect(full.scoreMin).toBe(full.score)
  })

  it('returns no component arrays unless asked', () => {
    expect(scoreAll(DATA, SETTINGS).components).toBeUndefined()
  })

  it('withComponents: one array per condition, equal to scoreBuilding, 255 = no data', () => {
    const { components } = scoreAll(DATA, SETTINGS, true)
    for (const i of [0, 1]) {
      const r = scoreBuilding(DATA, i, SETTINGS)
      for (const key of ['poiAccess', 'noise', 'cityCore', 'openPrice', 'localsOpinion', 'age'] as const) {
        expect(components![key][i]).toBe(r.components[key] ?? 255)
      }
    }
    expect(components!.noise[1]).toBe(255) // building 1 has no noise map
  })
})

describe('noise on the street side (TODO-073)', () => {
  // 0: street 70 dB, mean 60 dB; 1: no street side (inside a block), mean 50 dB; 2: no noise map.
  const data = makeData({ lden_street: [70, null, null], lden_avg: [60, 50, null], area: [0, 0, 0] })

  it('uses the street side, else the mean over the facades', () => {
    expect([0, 1, 2].map((i) => scoredNoise(data, i))).toEqual([70, 50, null])
  })

  it('scores the condition on it: 70 dB is 5 over 65, not 60 within it', () => {
    const noise = (i: number) => buildingBundle(data, i, SETTINGS).components.noise
    expect(noise(0)).toBe(50)
    expect(noise(1)).toBe(100)
    expect(noise(2)).toBeNull()
  })
})
