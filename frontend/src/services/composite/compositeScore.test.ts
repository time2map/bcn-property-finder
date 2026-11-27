import { describe, it, expect } from 'vitest'
import { budgetCeiling, computeComposite, hasConditions, type ComponentScores, type CompositeWeights } from './compositeScore'

const NONE: ComponentScores = { poiAccess: null, noise: null, cityCore: null, openPrice: null, localsOpinion: null, age: null }
const components = (c: Partial<ComponentScores>): ComponentScores => ({ ...NONE, ...c })

const WALK_NOISE: CompositeWeights = { poiAccess: 1, noise: 1, cityCore: 0, openPrice: 0 }

describe('computeComposite (049: mean over the conditions that are on)', () => {
  it('averages the conditions that are on and ignores the others', () => {
    const r = computeComposite({ components: components({ poiAccess: 100, noise: 50, openPrice: 0 }) }, WALK_NOISE)
    expect(r.score).toBe(75)
    expect(r.hasGap).toBe(false)
  })

  it('a condition that is on without data gives a range: score = max (dropped), scoreMin = worst (counts 0) (060)', () => {
    const r = computeComposite({ components: components({ poiAccess: 100, noise: null }) }, WALK_NOISE)
    expect(r.score).toBe(100)
    expect(r.scoreMin).toBe(50)
    expect(r.hasGap).toBe(true)
  })

  it('without gaps min equals max (060)', () => {
    const r = computeComposite({ components: components({ poiAccess: 100, noise: 50 }) }, WALK_NOISE)
    expect(r.scoreMin).toBe(r.score)
  })

  it('max counts the missing condition as 100, min as 0 (060, TODO-073)', () => {
    const w = { ...WALK_NOISE, cityCore: 1 }
    const r = computeComposite({ components: components({ poiAccess: 90, noise: 60, cityCore: null }) }, w)
    // (90 + 60 + 100) / 3, not the renormalised (90 + 60) / 2 = 75 of before.
    expect(r.score).toBe(83)
    expect(r.baseScore).toBe(83)
    expect(r.scoreMin).toBe(50)
    expect(r.scoreMin).toBeLessThanOrEqual(r.score)
  })

  it('every condition on is missing → 0–100 (060, TODO-073)', () => {
    const r = computeComposite({ components: NONE }, WALK_NOISE)
    expect(r.score).toBe(100)
    expect(r.scoreMin).toBe(0)
    expect(r.hasGap).toBe(true)
  })

  it('a missing condition with weight 0 is not a gap (060)', () => {
    const r = computeComposite({ components: components({ poiAccess: 70, noise: null }) }, { ...WALK_NOISE, noise: 0 })
    expect(r.hasGap).toBe(false)
    expect(r.scoreMin).toBe(70)
  })

  it('no condition on → 0', () => {
    const r = computeComposite({ components: components({ poiAccess: 100 }) }, { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 })
    expect(r.score).toBe(0)
  })

  it("locals' opinion from a small sample is a gap like missing data (042, 060)", () => {
    const weights = { ...WALK_NOISE, noise: 0, localsOpinion: 1 }
    const r = computeComposite({ components: components({ poiAccess: 80, localsOpinion: 100 }), localsLowN: true }, weights)
    expect(r.score).toBe(90)
    expect(r.scoreMin).toBe(40)
    expect(r.hasGap).toBe(true)
    const off = computeComposite({ components: components({ poiAccess: 80 }), localsLowN: true }, { ...weights, localsOpinion: 0 })
    expect(off.hasGap).toBe(false)
  })

  it('building age counts like any other condition (047)', () => {
    const r = computeComposite({ components: components({ poiAccess: 80, age: 0 }) }, { ...WALK_NOISE, noise: 0, age: 1 })
    expect(r.score).toBe(40)
  })
})

describe('computeComposite — climate risk penalties (036)', () => {
  const WALK_ONLY: CompositeWeights = { poiAccess: 1, noise: 0, cityCore: 0, openPrice: 0 }
  const NO_RISK = { flood: 0, fire: 0, street: 0 }
  const walk80 = components({ poiAccess: 80 })

  it('does not penalise when no strengths are passed', () => {
    const r = computeComposite({ components: walk80, risks: { ...NO_RISK, flood: 1 } }, WALK_ONLY)
    expect(r.score).toBe(80)
    expect(r.penalties).toEqual({ flood: 0, fire: 0, street: 0 })
  })

  it('keeps safe buildings unchanged; missing risks are no risk', () => {
    expect(computeComposite({ components: walk80, risks: NO_RISK }, WALK_ONLY, { flood: 10, fire: 10, street: 0 }).score).toBe(80)
    expect(computeComposite({ components: walk80 }, WALK_ONLY, { flood: 10, fire: 10, street: 0 }).score).toBe(80)
  })

  it('penalises a flooded building and reports the points lost', () => {
    const r = computeComposite({ components: walk80, risks: { ...NO_RISK, flood: 1 } }, WALK_ONLY, { flood: 5, fire: 5, street: 0 })
    expect(r.baseScore).toBe(80)
    expect(r.score).toBe(40)
    expect(r.penalties).toEqual({ flood: 40, fire: 0, street: 0 })
  })

  it('penalises by fire risk and by street flooding (037)', () => {
    expect(computeComposite({ components: walk80, risks: { ...NO_RISK, fire: 0.5 } }, WALK_ONLY, { flood: 5, fire: 10, street: 0 })
      .penalties.fire).toBe(40)
    expect(computeComposite({ components: walk80, risks: { ...NO_RISK, street: 1 } }, WALK_ONLY, { flood: 5, fire: 5, street: 5 })
      .penalties).toEqual({ flood: 0, fire: 0, street: 40 })
  })

  it('applies the penalties to both ends of the range (060)', () => {
    const r = computeComposite(
      { components: components({ poiAccess: 80, noise: null }), risks: { ...NO_RISK, flood: 1 } },
      { ...WALK_ONLY, noise: 1 },
      { flood: 5, fire: 5, street: 0 },
    )
    // Range 40–90 before the penalty, halved by the full-strength-5 river flood.
    expect(r.score).toBe(45)
    expect(r.scoreMin).toBe(20)
  })
})

describe('hasConditions (061)', () => {
  it('is false when every weight is 0 or absent', () => {
    expect(hasConditions({ poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 })).toBe(false)
    expect(hasConditions({ poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0, localsOpinion: 0, age: 0 })).toBe(false)
  })

  it('is true when any condition is on, including the optional ones', () => {
    expect(hasConditions({ poiAccess: 0, noise: 1, cityCore: 0, openPrice: 0 })).toBe(true)
    expect(hasConditions({ poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0, age: 1 })).toBe(true)
    expect(hasConditions({ poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0, localsOpinion: 1 })).toBe(true)
  })

  it('counts "avoid risks" as a condition', () => {
    const none = { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }
    expect(hasConditions(none, { flood: 5, fire: 5, street: 5 })).toBe(true)
    expect(hasConditions(none, { flood: 0, fire: 0, street: 0 })).toBe(false)
  })

  it('with only risks on, a safe home scores 100 and a risky one loses points', () => {
    const none = { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }
    const strengths = { flood: 5, fire: 5, street: 5 }
    expect(computeComposite({ components: components({}) }, none, strengths).score).toBe(100)
    const r = computeComposite({ components: components({}), risks: { flood: 1, fire: 0, street: 0 } }, none, strengths)
    expect(r.score).toBe(50)
    expect(r.hasGap).toBe(false)
  })
})

describe('budget ceiling (TODO-073)', () => {
  const ALL: CompositeWeights = { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1 }

  it('rises from the top of "Partial" at budget score 0 to no ceiling at 100', () => {
    expect(budgetCeiling(0, 65)).toBe(64)
    expect(budgetCeiling(50, 65)).toBe(82)
    expect(budgetCeiling(100, 65)).toBe(100)
  })

  it('a home 25% over the budget is at most a partial match, however good the rest', () => {
    const r = computeComposite({ components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: 0 }) }, ALL)
    expect(r.baseScore).toBe(75)
    expect(r.score).toBe(64)
    expect(r.budgetCap).toBe(11)
  })

  it('half-way into the fall-off the ceiling is 82', () => {
    const r = computeComposite({ components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: 50 }) }, ALL)
    expect(r.score).toBe(82) // mean 88
  })

  it('does not lift a lower score, and costs nothing within the budget', () => {
    const low = computeComposite({ components: components({ poiAccess: 20, noise: 20, cityCore: 20, openPrice: 0 }) }, ALL)
    expect(low.score).toBe(15)
    expect(low.budgetCap).toBe(0)
    const ok = computeComposite({ components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: 100 }) }, ALL)
    expect(ok.score).toBe(100)
    expect(ok.budgetCap).toBe(0)
  })

  it('applies after the risks and to both ends of a range', () => {
    const r = computeComposite(
      { components: components({ poiAccess: 100, noise: null, cityCore: 100, openPrice: 0 }) }, ALL, { flood: 0, fire: 0, street: 0 },
    )
    expect(r.score).toBe(64) // range 50–75 before the cap
    expect(r.scoreMin).toBe(50)
  })

  it('no ceiling without price data, with the budget off, or when the budget is not hard', () => {
    const noData = computeComposite({ components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: null }) }, ALL)
    expect(noData.score).toBe(100)
    const off = computeComposite({ components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: 0 }) }, { ...ALL, openPrice: 0 })
    expect(off.score).toBe(100)
    const soft = computeComposite(
      { components: components({ poiAccess: 100, noise: 100, cityCore: 100, openPrice: 0 }) }, ALL, undefined, false,
    )
    expect(soft.score).toBe(75)
  })
})
