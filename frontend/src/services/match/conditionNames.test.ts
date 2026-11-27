import { describe, it, expect } from 'vitest'
import { conditionNames } from './conditionNames'

const NO_RISK = { flood: 0, fire: 0, street: 0 }

describe('conditionNames', () => {
  it('lists the conditions that are on, in the order of the editor', () => {
    expect(conditionNames({ poiAccess: 1, noise: 1, cityCore: 0, openPrice: 1 }, NO_RISK))
      .toEqual(['Quiet', 'On foot', 'Budget'])
  })
  it('adds the optional conditions', () => {
    expect(conditionNames({ poiAccess: 0, noise: 0, cityCore: 1, openPrice: 0, localsOpinion: 1, age: 1 }, NO_RISK))
      .toEqual(['Centre', 'Locals', 'Buildings'])
  })
  it('adds "Risks" when any risk is on', () => {
    expect(conditionNames({ poiAccess: 0, noise: 1, cityCore: 0, openPrice: 0 }, { flood: 0, fire: 5, street: 0 }))
      .toEqual(['Quiet', 'Risks'])
  })
  it('is empty when nothing is on', () => {
    expect(conditionNames({ poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }, NO_RISK)).toEqual([])
  })
})
