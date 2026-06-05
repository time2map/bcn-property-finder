import { describe, it, expect } from 'vitest'
import { landmarkScore, cellCityCoreIndex } from './cityCoreScore'
import type { CityCoreCellProps } from './cityCoreData'

describe('landmarkScore', () => {
  it('returns 100 at exactly 0 minutes', () => {
    expect(landmarkScore(0)).toBe(100)
  })

  it('returns 100 at 15 minutes', () => {
    expect(landmarkScore(15)).toBe(100)
  })

  it('returns 0 for null or undefined', () => {
    expect(landmarkScore(null)).toBe(0)
    expect(landmarkScore(undefined)).toBe(0)
  })

  it('returns 0 for > 90 minutes', () => {
    expect(landmarkScore(91)).toBe(0)
    expect(landmarkScore(120)).toBe(0)
  })

  it('linearly interpolates 15→30 min range (100→75)', () => {
    expect(landmarkScore(22)).toBe(Math.round(100 - (7 * 25) / 15))
    expect(landmarkScore(30)).toBe(75)
  })

  it('linearly interpolates 30→45 min range (75→50)', () => {
    expect(landmarkScore(45)).toBe(50)
    expect(landmarkScore(37)).toBe(Math.round(75 - (7 * 25) / 15))
  })

  it('linearly interpolates 45→90 min range (50→25)', () => {
    expect(landmarkScore(90)).toBe(25)
    expect(landmarkScore(67)).toBe(Math.round(50 - (22 * 25) / 45))
  })
})

describe('cellCityCoreIndex', () => {
  const props: CityCoreCellProps = {
    h3: 'abc',
    sagrada: 10,
    placa_cat: 5,
    barceloneta: 30,
    barri_gotic: 20,
    pg_gracia: 15,
    arc_triomf: 25,
    montjuic: 50,
    placa_espanya: 45,
    glories: 35,
    poblenou: 40,
  }

  it('returns 0 when no landmarks are enabled', () => {
    expect(cellCityCoreIndex(props, [])).toBe(0)
  })

  it('returns score for a single landmark', () => {
    // sagrada = 10 min → 100
    expect(cellCityCoreIndex(props, ['sagrada'])).toBe(100)
    // barceloneta = 30 min → 75
    expect(cellCityCoreIndex(props, ['barceloneta'])).toBe(75)
  })

  it('averages scores across enabled landmarks', () => {
    // sagrada=100, placa_cat=100 → avg=100
    expect(cellCityCoreIndex(props, ['sagrada', 'placa_cat'])).toBe(100)
    // sagrada=100, barceloneta=75 → avg=87.5 → 88
    expect(cellCityCoreIndex(props, ['sagrada', 'barceloneta'])).toBe(88)
  })

  it('treats null minutes as score 0', () => {
    const withNull: CityCoreCellProps = { ...props, sagrada: null }
    // sagrada=0, placa_cat=100 → avg=50
    expect(cellCityCoreIndex(withNull, ['sagrada', 'placa_cat'])).toBe(50)
  })
})
