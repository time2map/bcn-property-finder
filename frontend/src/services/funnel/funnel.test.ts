import { describe, it, expect } from 'vitest'
import { NOT_IN_PLAY, STILL_IN, canCut, cutBy, finalPick, runFunnel, startAlive, stepShare, topPercent } from './funnel'
import { DEFAULT_FUNNEL_CONFIG, type FunnelConfig } from './funnelConfig'
import type { FunnelData, WishId } from './funnelWishes'
import { percentiles } from './percentile'

const CFG: FunnelConfig = DEFAULT_FUNNEL_CONFIG

/** Funnel data straight from goodness columns (higher is better). */
function fd(values: Partial<Record<WishId, number[]>>, sea?: number[]): FunnelData {
  const n = Object.values(values)[0]!.length
  const v: FunnelData['values'] = {}
  const pct: FunnelData['pct'] = {}
  for (const [w, arr] of Object.entries(values) as [WishId, number[]][]) {
    v[w] = Float64Array.from(arr)
    pct[w] = percentiles(v[w]!)
  }
  return {
    rows: Int32Array.from({ length: n }, (_, i) => 100 + i),
    wishes: Object.keys(values) as WishId[],
    values: v,
    pct,
    seaOk: Uint8Array.from(sea ?? Array(n).fill(0)),
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('stepShare', () => {
  it('splits the narrowing so that the last step ends at the target', () => {
    // equal strictness: the same share at each step; 5 steps from 64 to 2 → 2/64 = (1/2)^5
    const cfg = { ...CFG, strictness: [1, 1, 1, 1, 1] }
    expect(stepShare(64, 0, cfg)).toBeCloseTo(0.5)
    // at the last step the whole remaining narrowing is taken
    expect(stepShare(10, 4, cfg)).toBeCloseTo(0.2)
  })

  it('the first step is the strictest with the default strictness', () => {
    const first = stepShare(35000, 0, CFG)
    expect(first).toBeCloseTo((2 / 35000) ** (3 / 10))
    expect(first).toBeLessThan(0.06)
  })

  it('keeps at least one building and never more than all', () => {
    expect(stepShare(1, 0, CFG)).toBe(1)
    expect(stepShare(3, 4, { ...CFG, target: 10 })).toBe(1)
  })
})

describe('cutBy', () => {
  it('keeps the best share, with the threshold in the wish units', () => {
    const data = fd({ quiet: range(10).map((i) => -50 - i) }) // building 0 is the quietest
    const { alive, threshold } = cutBy(data, startAlive(data, false), 'quiet', 4, { ...CFG, target: 3 })
    expect(Array.from(alive)).toEqual([0, 1, 2])
    expect(threshold).toBe(-52)
  })

  it('keeps tied buildings together', () => {
    const data = fd({ metro: [-1, -1, -1, -1, -5, -6, -7, -8, -9, -10] })
    const { alive } = cutBy(data, startAlive(data, false), 'metro', 4, { ...CFG, target: 2 })
    expect(Array.from(alive)).toEqual([0, 1, 2, 3])
  })

  it('puts buildings with no data last', () => {
    const data = fd({ park: [NaN, -1, -2, NaN] })
    const { alive } = cutBy(data, startAlive(data, false), 'park', 4, { ...CFG, target: 1 })
    expect(Array.from(alive)).toEqual([1])
  })
})

describe('canCut', () => {
  it('is false when a wish would keep more than 90% of the buildings', () => {
    const data = fd({ bars: [...Array(19).fill(-1), -3], quiet: range(20).map((i) => -i) })
    const alive = startAlive(data, false)
    expect(canCut(data, alive, 'bars', 0, CFG)).toBe(false)
    expect(canCut(data, alive, 'quiet', 0, CFG)).toBe(true)
  })
})

describe('startAlive', () => {
  it('with the sea, only buildings within reach of it', () => {
    const data = fd({ quiet: [1, 2, 3] }, [0, 1, 1])
    expect(Array.from(startAlive(data, true))).toEqual([1, 2])
    expect(Array.from(startAlive(data, false))).toEqual([0, 1, 2])
  })
})

describe('runFunnel', () => {
  const n = 200
  const data = fd({
    quiet: range(n).map((i) => -(i % 37)),
    metro: range(n).map((i) => -(i % 11)),
    park: range(n).map((i) => -(i % 7)),
    shops: range(n).map((i) => -(i % 13)),
    new: range(n).map((i) => i),
    bars: Array(n).fill(-1),
  })

  it('applies the wishes in order and records each step', () => {
    const run = runFunnel(data, ['quiet', 'metro', 'park'], false, CFG)
    expect(run.steps.map((s) => s.wish)).toEqual(['quiet', 'metro', 'park'])
    expect(run.steps[0].before).toBe(n)
    for (let j = 1; j < run.steps.length; j++) expect(run.steps[j].before).toBe(run.steps[j - 1].after)
    expect(run.alive.length).toBe(run.steps[2].after)
  })

  it('skips a wish that cannot cut, and stops after the configured steps', () => {
    const run = runFunnel(data, ['bars', 'quiet', 'metro', 'park', 'shops', 'new', 'bars'], false, CFG)
    expect(run.steps.map((s) => s.wish)).toEqual(['quiet', 'metro', 'park', 'shops', 'new'])
  })

  it('records the step each building dropped out at', () => {
    const run = runFunnel(data, ['quiet', 'metro'], false, CFG)
    const out = Array.from(run.outAt)
    expect(out.filter((v) => v === 1)).toHaveLength(run.steps[0].before - run.steps[0].after)
    expect(out.filter((v) => v === 2)).toHaveLength(run.steps[1].before - run.steps[1].after)
    expect(out.filter((v) => v === STILL_IN)).toHaveLength(run.alive.length)
    for (const k of run.alive) expect(run.outAt[k]).toBe(STILL_IN)
  })

  it('buildings out of reach of the sea are not in play when the sea is asked for', () => {
    const withSea = fd({ quiet: [-1, -2, -3, -4] }, [1, 1, 0, 1])
    const run = runFunnel(withSea, [], true, CFG)
    expect(Array.from(run.outAt)).toEqual([STILL_IN, STILL_IN, NOT_IN_PLAY, STILL_IN])
  })

  it('ends near the target after five steps', () => {
    const run = runFunnel(data, ['quiet', 'metro', 'park', 'shops', 'new'], false, CFG)
    expect(run.alive.length).toBeGreaterThanOrEqual(1)
    expect(run.alive.length).toBeLessThanOrEqual(5)
  })

  it('a different order of the same wishes may end elsewhere, but is always the same for the same order', () => {
    const a = runFunnel(data, ['quiet', 'metro', 'park', 'shops', 'new'], false, CFG)
    const b = runFunnel(data, ['quiet', 'metro', 'park', 'shops', 'new'], false, CFG)
    expect(Array.from(a.alive)).toEqual(Array.from(b.alive))
  })
})

describe('finalPick', () => {
  it('picks the best on the wishes weighted by their order; the others are the spot, best first', () => {
    const data = fd({ quiet: [-50, -40, -45], metro: [-1, -9, -5] })
    // weights 5 (quiet) and 4 (metro). Percentiles: quiet 0 / 1 / 0.5, metro 1 / 0 / 0.5
    // → scores 4, 5, 4.5: building 1 wins, then 2, then 0
    const r = finalPick(data, Int32Array.from([0, 1, 2]), ['quiet', 'metro'], CFG)
    expect(r.winner).toBe(1)
    expect(r.spot).toEqual([2, 0])
    expect(r.pct.map((p) => p.wish)).toEqual(['quiet', 'metro'])
    expect(r.pct[0].pct).toBe(1)
  })

  it('a tie goes to the first building in row order', () => {
    const data = fd({ quiet: [-50, -50] })
    expect(finalPick(data, Int32Array.from([0, 1]), ['quiet'], CFG).winner).toBe(0)
  })
})

describe('topPercent', () => {
  it('turns a percentile into "top N%", at least 1', () => {
    expect(topPercent(0.96)).toBe(4)
    expect(topPercent(1)).toBe(1)
    expect(topPercent(0.5)).toBe(50)
    expect(topPercent(0)).toBe(100)
  })
})
