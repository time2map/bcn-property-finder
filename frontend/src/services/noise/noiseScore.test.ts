import { describe, it, expect } from 'vitest'
import { noiseScore } from './noiseScore'

describe('noiseScore', () => {
  it('returns 100 at 45 dB (quiet anchor)', () => {
    expect(noiseScore(45)).toBe(100)
  })

  it('returns 0 at 75 dB (loud anchor)', () => {
    expect(noiseScore(75)).toBe(0)
  })

  it('clamps to 100 below quiet anchor', () => {
    expect(noiseScore(30)).toBe(100)
    expect(noiseScore(0)).toBe(100)
  })

  it('clamps to 0 above loud anchor', () => {
    expect(noiseScore(80)).toBe(0)
    expect(noiseScore(100)).toBe(0)
  })

  it('returns ~67 at 55 dB (moderate)', () => {
    expect(noiseScore(55)).toBe(67)
  })

  it('returns 50 at 60 dB (midpoint)', () => {
    expect(noiseScore(60)).toBe(50)
  })

  it('returns 33 at 65 dB (noisy)', () => {
    expect(noiseScore(65)).toBe(33)
  })

  it('uses Lden midpoints correctly', () => {
    // 37.5 dB (< 40 band) → score 100 (clamped)
    expect(noiseScore(37.5)).toBe(100)
    // 62.5 dB → round((75-62.5)/30*100) = round(41.67) = 42
    expect(noiseScore(62.5)).toBe(42)
    // 77.5 dB → 0 (clamped)
    expect(noiseScore(77.5)).toBe(0)
  })
})
