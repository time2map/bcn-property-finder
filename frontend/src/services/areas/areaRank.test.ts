import { describe, it, expect } from 'vitest'
import { rankAreas, NO_DATA } from './areaRank'
import type { BuildingArea } from '../buildings/buildingData'

const AREAS: BuildingArea[] = [
  { code: '01', name: 'el Raval', kind: 'barri', price: 4000 },
  { code: '02', name: 'el Gòtic', kind: 'barri', price: 4500 },
  { code: '08101', name: 'Hospitalet', kind: 'muni', price: 2500 },
  { code: '08904', name: 'Badia', kind: 'muni', price: null },
]
const BANDS = [85, 65, 40] as const

/** Buildings: area index repeated, scores, and per-condition component arrays. */
function build(rows: { area: number; score: number; noise?: number; poi?: number }[]) {
  return {
    scores: Uint8Array.from(rows.map((r) => r.score)),
    areaCol: Float32Array.from(rows.map((r) => r.area)),
    components: {
      noise: Uint8Array.from(rows.map((r) => r.noise ?? NO_DATA)),
      poiAccess: Uint8Array.from(rows.map((r) => r.poi ?? NO_DATA)),
    },
  }
}

describe('rankAreas', () => {
  it('counts buildings, the mean score and the shares of good and great homes per area', () => {
    const { scores, areaCol, components } = build([
      { area: 0, score: 90 }, { area: 0, score: 70 }, { area: 0, score: 50 }, { area: 0, score: 10 },
    ])
    const [r] = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1)
    expect(r.n).toBe(4)
    expect(r.mean).toBe(55)
    expect(r.shareGreat).toBe(25) // 90
    expect(r.shareGood).toBe(50) // 90 and 70: good or better
    expect(r.name).toBe('el Raval')
    expect(r.kind).toBe('barri')
  })

  it('ranks by the share of good homes, ties by mean score', () => {
    const { scores, areaCol, components } = build([
      { area: 0, score: 90 }, { area: 0, score: 10 }, // 50 % good, mean 50
      { area: 1, score: 70 }, { area: 1, score: 80 }, // 100 % good, mean 75
      { area: 2, score: 66 }, { area: 2, score: 100 }, // 100 % good, mean 83
    ])
    const ranks = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1)
    expect(ranks.map((r) => r.name)).toEqual(['Hospitalet', 'el Gòtic', 'el Raval'])
  })

  it('puts areas with too few buildings after the ranked ones, flagged', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => ({ area: 0, score: 20 })),
      { area: 1, score: 100 }, // best share, but one building only
    ]
    const { scores, areaCol, components } = build(rows)
    const ranks = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 3)
    expect(ranks.map((r) => [r.name, r.ranked])).toEqual([['el Raval', true], ['el Gòtic', false]])
  })

  it('leaves out areas without buildings and buildings without an area', () => {
    const { scores, areaCol, components } = build([{ area: 0, score: 80 }, { area: NaN, score: 99 }])
    const ranks = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1)
    expect(ranks).toHaveLength(1)
    expect(ranks[0].n).toBe(1)
  })

  it('names the three strongest conditions of an area, ignoring buildings without data', () => {
    const rows = [
      { area: 0, score: 80, noise: 100, poi: 40 },
      { area: 0, score: 80, noise: 80, poi: 60 },
      { area: 0, score: 80, noise: NO_DATA, poi: 60 },
    ]
    const { scores, areaCol } = build(rows)
    const components = {
      ...build(rows).components,
      cityCore: Uint8Array.from([30, 30, 30]),
      openPrice: Uint8Array.from([70, 70, 70]),
    }
    const [r] = rankAreas(scores, areaCol, AREAS, components, ['noise', 'poiAccess', 'cityCore', 'openPrice'], BANDS, 1)
    // means: noise 90, poiAccess 53.3, cityCore 30, openPrice 70
    expect(r.strongest).toEqual(['noise', 'openPrice', 'poiAccess'])
  })

  it('has no strongest conditions when none are on or no data exists', () => {
    const { scores, areaCol, components } = build([{ area: 0, score: 80 }])
    expect(rankAreas(scores, areaCol, AREAS, components, [], BANDS, 1)[0].strongest).toEqual([])
    expect(rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1)[0].strongest).toEqual([])
  })

  it('returns nothing for no buildings', () => {
    expect(rankAreas(new Uint8Array(), new Float32Array(), AREAS, {}, [], BANDS, 1)).toEqual([])
  })

  it('aggregates 174k buildings fast enough to run after every rescoring', () => {
    const n = 174_000
    const scores = new Uint8Array(n)
    const areaCol = new Float32Array(n)
    const comp = new Uint8Array(n)
    for (let i = 0; i < n; i++) { scores[i] = (i * 37) % 101; areaCol[i] = i % 4; comp[i] = (i * 11) % 101 }
    const t0 = performance.now()
    rankAreas(scores, areaCol, AREAS, { noise: comp, poiAccess: comp, cityCore: comp }, ['noise', 'poiAccess', 'cityCore'], BANDS, 50)
    // The target is ~30 ms; the budget leaves room for a slow CI machine.
    expect(performance.now() - t0).toBeLessThan(150)
  })

  describe('incomplete data (060)', () => {
    const rows = [
      { area: 0, score: 80 }, { area: 0, score: 80 }, { area: 0, score: 80 }, { area: 0, score: 80 },
      { area: 1, score: 80 }, { area: 1, score: 80 }, { area: 1, score: 80 }, { area: 1, score: 80 },
    ]
    const { scores, areaCol, components } = build(rows)

    it('shares the buildings with a range and hatches the area above the threshold only', () => {
      // area 0: 1 of 4 = 25 %, area 1: 2 of 4 = 50 %
      const gap = Uint8Array.from([1, 0, 0, 0, 1, 1, 0, 0])
      const ranks = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1, gap, 0.3)
      const byIndex = (i: number) => ranks.find((r) => r.index === i)!
      expect(byIndex(0).gapShare).toBeCloseTo(0.25)
      expect(byIndex(0).incomplete).toBe(false)
      expect(byIndex(1).gapShare).toBeCloseTo(0.5)
      expect(byIndex(1).incomplete).toBe(true)
    })

    it('a share exactly at the threshold is not hatched ("more than")', () => {
      const gap = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0])
      const [r] = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1, gap, 0.25)
        .filter((x) => x.index === 0)
      expect(r.incomplete).toBe(false)
    })

    it('an area with too few buildings to be ranked is never hatched, however many have gaps (060)', () => {
      // a handful of stray buildings assigned to a municipality must not hatch the polygon they happen to sit in
      const [r] = rankAreas(Uint8Array.from([80, 80]), Float32Array.from([0, 0]), AREAS, components, [], BANDS, 50,
        Uint8Array.from([1, 1]), 0.3)
      expect(r.gapShare).toBe(1)
      expect(r.ranked).toBe(false)
      expect(r.incomplete).toBe(false)
    })

    it('without a gap array nothing is incomplete', () => {
      for (const r of rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 1)) {
        expect(r.gapShare).toBe(0)
        expect(r.incomplete).toBe(false)
      }
    })

    it('the mean is over the given scores, which are the max values', () => {
      const [r] = rankAreas(Uint8Array.from([100, 60]), Float32Array.from([0, 0]), AREAS, components, [], BANDS, 1,
        Uint8Array.from([1, 0]), 0.3)
      expect(r.mean).toBe(80)
    })
  })
})

describe('rankAreas by homes (TODO-073)', () => {
  // el Raval: three houses at 90, one block of 60 flats at 30. Hospitalet: four houses at 70.
  const { scores, areaCol, components } = build([
    { area: 0, score: 90, noise: 100 }, { area: 0, score: 90, noise: 100 }, { area: 0, score: 90, noise: 100 },
    { area: 0, score: 30, noise: 0 },
    { area: 2, score: 70, noise: 50 }, { area: 2, score: 70, noise: 50 }, { area: 2, score: 70, noise: 50 },
    { area: 2, score: 70, noise: 50 },
  ])
  const homes = Float32Array.from([1, 1, 1, 60, 1, 1, 1, 1])
  const ranks = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 4, null, 0.3, homes)
  const raval = ranks.find((r) => r.name === 'el Raval')!

  it('shares and means count homes; the building count stays for the size limit', () => {
    expect(raval.n).toBe(63)
    expect(raval.buildings).toBe(4)
    expect(raval.shareGood).toBeCloseTo((100 * 3) / 63)
    expect(raval.mean).toBeCloseTo((3 * 90 + 60 * 30) / 63)
    expect(raval.ranked).toBe(true)
  })

  it('an area of many good houses ranks above one of a few good houses and a large poor block', () => {
    expect(ranks[0].name).toBe('Hospitalet')
  })

  it('without the column every building counts once, as before', () => {
    const raw = rankAreas(scores, areaCol, AREAS, components, ['noise'], BANDS, 4)
    const r = raw.find((x) => x.name === 'el Raval')!
    expect(r.n).toBe(4)
    expect(r.shareGood).toBe(75) // 3 of 4 buildings, against 3 of 63 homes above
  })
})
