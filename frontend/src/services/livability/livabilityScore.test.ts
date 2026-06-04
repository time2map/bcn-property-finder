import { describe, it, expect } from 'vitest'
import { cellNoiseScore, livabilityIndex } from './livabilityScore'
import { noiseScore } from '../noise/noiseScore'

describe('cellNoiseScore', () => {
  it('returns undefined when lden is null or undefined', () => {
    expect(cellNoiseScore(null)).toBeUndefined()
    expect(cellNoiseScore(undefined)).toBeUndefined()
  })

  it('delegates to noiseScore for a numeric lden', () => {
    expect(cellNoiseScore(45)).toBe(noiseScore(45))
    expect(cellNoiseScore(65)).toBe(noiseScore(65))
  })
})

describe('livabilityIndex', () => {
  it('returns walkability only when considerNoise is off', () => {
    expect(livabilityIndex(80, 45, false)).toBe(80)
    expect(livabilityIndex(30, 70, false)).toBe(30)
  })

  it('falls back to walkability when noise data is missing, even with considerNoise on', () => {
    expect(livabilityIndex(80, null, true)).toBe(80)
    expect(livabilityIndex(80, undefined, true)).toBe(80)
  })

  it('blends walkability and noise with composite weights when considerNoise is on', () => {
    // defaults: W_walk = 3, W_noise = 2; noiseScore(45) = 100
    // (80*3 + 100*2) / 5 = 88
    expect(livabilityIndex(80, 45, true)).toBe(88)
  })

  it('lowers the index for a loud (high-lden) cell', () => {
    // noiseScore(75) = 0 → (80*3 + 0*2)/5 = 48
    expect(livabilityIndex(80, 75, true)).toBe(48)
  })
})
