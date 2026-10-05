import { describe, it, expect } from 'vitest'
import {
  applyRiskPenalties,
  DEFAULT_RISK_STRENGTHS,
  fireRisk,
  floodRisk,
  mostSevereFloodZone,
  streetFloodRisk,
  type ClimateRiskProps,
} from './climateRisk'

const PENALTIES = { t10: 1, t100: 0.6, t500: 0.25 }

function props(overrides: Partial<ClimateRiskProps> = {}): ClimateRiskProps {
  return {
    flood_t10: 0, flood_t100: 0, flood_t500: 0,
    fire_wui: 0, fire_hazard: 0, fire_class: null, fire_dist_m: null,
    ...overrides,
  }
}

describe('floodRisk', () => {
  it('is 0 outside all zones', () => {
    expect(floodRisk(props(), PENALTIES)).toBe(0)
  })

  it('uses the most severe zone for each share (exclusive bands)', () => {
    // 20% in T10, another 30% only in T100, another 50% only in T500
    const p = props({ flood_t10: 0.2, flood_t100: 0.5, flood_t500: 1 })
    expect(floodRisk(p, PENALTIES)).toBeCloseTo(0.2 * 1 + 0.3 * 0.6 + 0.5 * 0.25)
  })

  it('a cell fully in T10 has risk 1', () => {
    expect(floodRisk(props({ flood_t10: 1, flood_t100: 1, flood_t500: 1 }), PENALTIES)).toBe(1)
  })

  it('treats missing fields (old grid) as no risk', () => {
    expect(floodRisk(props({ flood_t10: null, flood_t100: null, flood_t500: null }), PENALTIES)).toBe(0)
    expect(floodRisk({}, PENALTIES)).toBe(0)
  })

  it('uses env defaults when no penalties are passed', () => {
    expect(floodRisk(props({ flood_t10: 1, flood_t100: 1, flood_t500: 1 }))).toBe(1)
  })
})

describe('fireRisk', () => {
  it('is the WUI share gating the forest hazard', () => {
    expect(fireRisk(props({ fire_wui: 0.5, fire_hazard: 0.8 }))).toBeCloseTo(0.4)
  })

  it('is 0 outside the WUI even next to forest (urban parks)', () => {
    expect(fireRisk(props({ fire_wui: 0, fire_hazard: 0.9 }))).toBe(0)
  })

  it('treats missing fields as no risk', () => {
    expect(fireRisk({})).toBe(0)
  })
})

describe('applyRiskPenalties', () => {
  it('leaves the score unchanged when there is no risk', () => {
    expect(applyRiskPenalties(70, { flood: 0, fire: 0, street: 0 }, { flood: 10, fire: 10, street: 10 }))
      .toEqual({ score: 70, floodPenalty: 0, firePenalty: 0, streetPenalty: 0 })
  })

  it('leaves the score unchanged when strengths are 0', () => {
    expect(applyRiskPenalties(70, { flood: 1, fire: 1, street: 1 }, { flood: 0, fire: 0, street: 0 }))
      .toEqual({ score: 70, floodPenalty: 0, firePenalty: 0, streetPenalty: 0 })
  })

  it('max strength on a full-risk cell drives the score to 0', () => {
    expect(applyRiskPenalties(80, { flood: 1, fire: 0, street: 0 }, { flood: 10, fire: 5, street: 5 }).score).toBe(0)
  })

  it('multiplies both penalties and attributes the lost points', () => {
    // 80 × (1 − 0.5·0.5) = 60 → −20 flood; 60 × (1 − 0.5·0.4) = 48 → −12 fire; 48 × (1 − 0.5·0.5) = 36 → −12 street
    expect(applyRiskPenalties(80, { flood: 0.5, fire: 0.4, street: 0.5 }, { flood: 5, fire: 5, street: 5 }))
      .toEqual({ score: 36, floodPenalty: 20, firePenalty: 12, streetPenalty: 12 })
  })

  it('never goes below 0 or above base', () => {
    const r = applyRiskPenalties(50, { flood: 2, fire: -1, street: 0 }, { flood: 10, fire: 10, street: 10 })
    expect(r.score).toBe(0)
    expect(r.firePenalty).toBe(0)
  })
})

describe('streetFloodRisk (feature 037)', () => {
  const SAT = 0.15

  it('is 0 without data (outside Barcelona / old grid) or when dry', () => {
    expect(streetFloodRisk({}, PENALTIES, SAT)).toBe(0)
    expect(streetFloodRisk(props({ street_t10: null, street_t100: null }), PENALTIES, SAT)).toBe(0)
    expect(streetFloodRisk(props({ street_t10: 0, street_t100: 0 }), PENALTIES, SAT)).toBe(0)
  })

  it('normalises by the saturation share and weights T10 above the extra T100 part', () => {
    // r10 = 0.075/0.15 = 0.5, r100 = 1 → 0.5·1 + 0.5·0.6
    expect(streetFloodRisk(props({ street_t10: 0.075, street_t100: 0.15 }), PENALTIES, SAT)).toBeCloseTo(0.8)
  })

  it('caps at 1 above saturation', () => {
    expect(streetFloodRisk(props({ street_t10: 0.4, street_t100: 0.5 }), PENALTIES, SAT)).toBe(1)
  })

  it('treats T100 as at least as wet as T10', () => {
    expect(streetFloodRisk(props({ street_t10: 0.075, street_t100: 0.01 }), PENALTIES, SAT)).toBeCloseTo(0.5)
  })

  it('uses env defaults (saturation 0.15)', () => {
    expect(streetFloodRisk(props({ street_t10: 0.15, street_t100: 0.15 }))).toBe(1)
  })
})

describe('mostSevereFloodZone', () => {
  it('returns null outside all zones', () => {
    expect(mostSevereFloodZone(props())).toBeNull()
  })

  it('returns the most severe zone touching the cell with its share', () => {
    expect(mostSevereFloodZone(props({ flood_t10: 0, flood_t100: 0.35, flood_t500: 0.8 })))
      .toEqual({ zone: 't100', share: 0.35 })
    expect(mostSevereFloodZone(props({ flood_t10: 0.1, flood_t100: 0.1, flood_t500: 0.1 })))
      .toEqual({ zone: 't10', share: 0.1 })
    expect(mostSevereFloodZone(props({ flood_t500: 0.4 }))).toEqual({ zone: 't500', share: 0.4 })
  })
})

describe('DEFAULT_RISK_STRENGTHS', () => {
  it('defaults to a medium strength', () => {
    expect(DEFAULT_RISK_STRENGTHS).toEqual({ flood: 5, fire: 5, street: 5 })
  })
})
