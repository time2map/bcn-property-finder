import { describe, it, expect } from 'vitest'
import { SCORE_BINS, awardTier, homeWeight, parseTiers, rankIn, scoreHistograms, buildingRanks } from './buildingRank'
import type { BuildingArea } from './buildingData'

const AREAS: BuildingArea[] = [
  { code: '01', name: 'el Raval', kind: 'barri', price: null },
  { code: '02', name: 'el Gòtic', kind: 'barri', price: null },
  { code: '08015', name: 'Badalona', kind: 'muni', price: null },
]

/** `n` buildings of `area`, all with `score`. */
const many = (area: number, score: number, n: number) => Array.from({ length: n }, () => ({ area, score }))
function cols(rows: { area: number; score: number }[]) {
  return { scores: Uint8Array.from(rows.map((r) => r.score)), areaCol: Float32Array.from(rows.map((r) => r.area)) }
}

describe('scoreHistograms', () => {
  it('counts per area, for Barcelona (barris only) and for everything', () => {
    const { scores, areaCol } = cols([...many(0, 10, 2), ...many(1, 90, 3), ...many(2, 50, 4)])
    const h = scoreHistograms(scores, areaCol, AREAS)
    expect(h.areas[0]).toHaveLength(SCORE_BINS)
    expect(h.areas[0][10]).toBe(2)
    expect(h.areas[1][90]).toBe(3)
    expect(h.areas[2][50]).toBe(4)
    expect(h.barcelona[50]).toBe(0) // Badalona is not Barcelona
    expect(h.barcelona[10] + h.barcelona[90]).toBe(5)
    expect(h.all.reduce((a, b) => a + b, 0)).toBe(9)
  })
  it('skips buildings without an area in the area counts but keeps them in the total', () => {
    const h = scoreHistograms(Uint8Array.from([40, 40]), Float32Array.from([NaN, 0]), AREAS)
    expect(h.areas[0][40]).toBe(1)
    expect(h.barcelona[40]).toBe(1)
    expect(h.all[40]).toBe(2)
  })
})

describe('rankIn', () => {
  const hist = (rows: Record<number, number>) => {
    const h = new Uint32Array(SCORE_BINS)
    for (const [s, n] of Object.entries(rows)) h[Number(s)] = n
    return h
  }

  it('counts the homes with the same or a higher score, the building itself among them', () => {
    expect(rankIn(hist({ 20: 10, 60: 10, 80: 10, 95: 10 }), 80)).toEqual({ above: 20, n: 40 })
  })
  it('a building tied for the top counts every home on its score against itself', () => {
    expect(rankIn(hist({ 40: 36, 100: 64 }), 100)).toEqual({ above: 64, n: 100 })
  })
  it('a lone best building has one home at or above it', () => {
    expect(rankIn(hist({ 40: 99, 100: 1 }), 100)).toEqual({ above: 1, n: 100 })
  })
  it('is null for an empty scope', () => {
    expect(rankIn(new Uint32Array(SCORE_BINS), 50)).toBeNull()
  })
})

describe('parseTiers', () => {
  it('reads a comma-separated list, narrowest first', () => {
    expect(parseTiers('20,10')).toEqual([10, 20])
    expect(parseTiers(' 5 , 10,20')).toEqual([5, 10, 20])
  })
  it('drops duplicates and values outside 0–100', () => {
    expect(parseTiers('10,10,0,100,abc,-5,20')).toEqual([10, 20])
  })
  it('falls back to Top 10% and Top 20% when nothing is usable', () => {
    expect(parseTiers(undefined)).toEqual([10, 20])
    expect(parseTiers('')).toEqual([10, 20])
    expect(parseTiers('x,,y')).toEqual([10, 20])
  })
})

describe('awardTier', () => {
  const r = (above: number) => ({ above, n: 100 })
  it('is the narrowest tier the rank fits in', () => {
    expect(awardTier(r(1), [10, 20])).toBe(10)
    expect(awardTier(r(10), [10, 20])).toBe(10)
    expect(awardTier(r(11), [10, 20])).toBe(20)
    expect(awardTier(r(20), [10, 20])).toBe(20)
  })
  it('is null outside every tier', () => {
    expect(awardTier(r(21), [10, 20])).toBeNull()
    expect(awardTier(r(100), [10, 20])).toBeNull()
  })
  it('compares shares exactly, with no rounding at the edge', () => {
    // 1 home in 7 is 14.28…%: Top 20%, not Top 10%
    expect(awardTier({ above: 1, n: 7 }, [10, 20])).toBe(20)
    expect(awardTier({ above: 2, n: 21 }, [10, 20])).toBe(10)
  })
})

describe('buildingRanks', () => {
  // el Raval: 60 low (30) and 40 high (80); el Gòtic: 100 high (80); Badalona: 70 at 10 and 30 at 90.
  const { scores, areaCol } = cols([...many(0, 30, 60), ...many(0, 80, 40), ...many(1, 80, 100), ...many(2, 10, 70), ...many(2, 90, 30)])
  const h = scoreHistograms(scores, areaCol, AREAS)

  it('a Barcelona building: barri and the city of Barcelona, each judged alone', () => {
    // 80 is the top of el Raval (40 of 100 homes at 80: Top 50%) and of Barcelona (140 of 200: 70%): use wide tiers
    const r = buildingRanks(h, AREAS, 0, 80, 50, [50, 75])!
    expect(r.local!.name).toBe('el Raval')
    expect(r.local!.kind).toBe('barri')
    expect(r.local!.rank).toEqual({ above: 40, n: 100, tier: 50 })
    expect(r.wide!.scope).toBe('barcelona')
    expect(r.wide!.rank).toEqual({ above: 140, n: 200, tier: 75 })
  })
  it('shows the narrowest tier of each scope', () => {
    // el Raval: 10 homes at 100, 20 at 60, 80 at 20. Score 100 has 10 of 110 homes at or above (9%); score 60 has 30 of 110 (27%).
    const c = cols([...many(0, 20, 80), ...many(0, 60, 20), ...many(0, 100, 10), ...many(1, 100, 100)])
    const hh = scoreHistograms(c.scores, c.areaCol, AREAS)
    expect(buildingRanks(hh, AREAS, 0, 100, 50, [10, 20])!.local!.rank.tier).toBe(10)
    expect(buildingRanks(hh, AREAS, 0, 60, 50, [10, 30])!.local!.rank.tier).toBe(30)
  })
  it('stands out in the barri but not in the city: only the barri line', () => {
    // score 60: 30 of the 110 in el Raval are at or above (27%), 130 of 210 in Barcelona (62%)
    const c = cols([...many(0, 20, 80), ...many(0, 60, 20), ...many(0, 100, 10), ...many(1, 100, 100)])
    const r = buildingRanks(scoreHistograms(c.scores, c.areaCol, AREAS), AREAS, 0, 60, 50, [10, 30])!
    expect(r.local!.rank.tier).toBe(30)
    expect(r.wide).toBeNull()
  })
  it('stands out in the city but not in its barri: only the city line', () => {
    // score 60: 70 of the 100 in el Raval are at or above (70%), 70 of 200 in Barcelona (35%)
    const c = cols([...many(0, 20, 30), ...many(0, 60, 30), ...many(0, 100, 40), ...many(1, 10, 100)])
    const r = buildingRanks(scoreHistograms(c.scores, c.areaCol, AREAS), AREAS, 0, 60, 50, [10, 40])!
    expect(r.local).toBeNull()
    expect(r.wide!.rank.tier).toBe(40)
  })
  it('is null when it stands out nowhere', () => {
    expect(buildingRanks(h, AREAS, 0, 30, 50, [10, 20])).toBeNull()
  })
  it('a building outside Barcelona: the municipality and the whole area', () => {
    const r = buildingRanks(h, AREAS, 2, 90, 50, [30, 50])!
    expect(r.local!.name).toBe('Badalona')
    expect(r.local!.kind).toBe('muni')
    expect(r.local!.rank.tier).toBe(30)
    expect(r.wide!.scope).toBe('metro')
    expect(r.wide!.rank.n).toBe(300)
  })
  it('hides the barri line below the minimum number of buildings', () => {
    const r = buildingRanks(h, AREAS, 0, 80, 101, [50, 75])!
    expect(r.local).toBeNull()
    expect(r.wide!.rank.n).toBe(200)
  })
  it('is null without an area or a scope', () => {
    expect(buildingRanks(h, AREAS, null, 80)).toBeNull()
    expect(buildingRanks(h, AREAS, 9, 80)).toBeNull()
  })
})

describe('homes, not buildings (TODO-073)', () => {
  it('a building counts as many homes as it has dwellings, at least one', () => {
    expect(homeWeight(undefined, 0)).toBe(1)
    expect(homeWeight(Float32Array.from([12, 0, NaN]), 0)).toBe(12)
    expect(homeWeight(Float32Array.from([12, 0, NaN]), 1)).toBe(1)
    expect(homeWeight(Float32Array.from([12, 0, NaN]), 2)).toBe(1)
  })

  it('one block of 90 flats outweighs nine houses: the rank is a share of homes', () => {
    // el Raval: nine houses at 30, one block of 90 flats at 60, one house at 80. A home in the block has 91 of the
    // 100 homes at or above it (Top 91%), not 2 of 11 buildings (Top 18%).
    const { scores, areaCol } = cols([...many(0, 30, 9), ...many(0, 60, 1), ...many(0, 80, 1)])
    const homes = Float32Array.from([...Array(9).fill(1), 90, 1])
    const h = scoreHistograms(scores, areaCol, AREAS, homes)
    expect(h.areas[0][60]).toBe(90)
    expect(h.buildings.areas[0][60]).toBe(1)
    expect(rankIn(h.areas[0], 60)).toEqual({ above: 91, n: 100 })
  })

  it('a plateau is not an award: the best score shared by most of the barri earns no line', () => {
    // 7 buildings at 40, 93 at 63 (the top): 93% of the homes are at or above a building at 63.
    const { scores, areaCol } = cols([...many(0, 40, 7), ...many(0, 63, 93)])
    const h = scoreHistograms(scores, areaCol, AREAS)
    expect(rankIn(h.areas[0], 63)).toEqual({ above: 93, n: 100 })
    expect(buildingRanks(h, AREAS, 0, 63, 50, [10, 20])?.local ?? null).toBeNull()
  })

  it('the minimum size of a barri still counts buildings', () => {
    // 10 buildings with 100 homes each: 1,000 homes but only 10 buildings, under a minimum of 50.
    const { scores, areaCol } = cols([...many(0, 20, 9), ...many(0, 90, 1)])
    const h = scoreHistograms(scores, areaCol, AREAS, Float32Array.from(Array(10).fill(100)))
    expect(buildingRanks(h, AREAS, 0, 90, 50, [10, 20])?.local ?? null).toBeNull()
    expect(buildingRanks(h, AREAS, 0, 90, 10, [10, 20])!.local!.rank).toEqual({ above: 100, n: 1000, tier: 10 })
  })
})
