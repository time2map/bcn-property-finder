import { describe, it, expect } from 'vitest'
import { computeComposite, type ComponentScores, type CompositeWeights } from '../composite/compositeScore'
import {
  BAND_COLOR, BAND_LABEL, bandShares, conditionStatus, matchBand, matchSummary, matchTooltip, parseBands, riskLine,
} from './matchSummary'
import {
  ageParts, ageText, cityCoreParts, cityCoreText, localsParts, localsText, noiseParts, noiseText, poiParts, poiText, priceParts, priceText,
} from './matchText'

const ALL_ON: CompositeWeights = { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1, localsOpinion: 0, age: 0 }
const comps = (c: Partial<ComponentScores>): ComponentScores => ({
  poiAccess: 100, noise: 100, cityCore: 100, openPrice: 100, localsOpinion: null, age: null, ...c,
})
const result = (c: Partial<ComponentScores>, w = ALL_ON, risks = { flood: 0, fire: 0, street: 0 }, strengths = { flood: 0, fire: 0, street: 0 }) =>
  computeComposite({ components: comps(c), risks }, w, strengths)

describe('parseBands', () => {
  it('reads the thresholds from the ENV string', () => {
    expect(parseBands('90,70,50')).toEqual([90, 70, 50])
  })
  it('falls back to 85,65,40 when missing, malformed or not descending', () => {
    expect(parseBands(undefined)).toEqual([85, 65, 40])
    expect(parseBands('a,b,c')).toEqual([85, 65, 40])
    expect(parseBands('40,65,85')).toEqual([85, 65, 40])
    expect(parseBands('85,65')).toEqual([85, 65, 40])
  })
})

describe('matchBand', () => {
  it('puts the edges in the higher band', () => {
    expect(matchBand(100)).toBe('great')
    expect(matchBand(85)).toBe('great')
    expect(matchBand(84)).toBe('good')
    expect(matchBand(65)).toBe('good')
    expect(matchBand(64)).toBe('partial')
    expect(matchBand(40)).toBe('partial')
    expect(matchBand(39)).toBe('poor')
    expect(matchBand(0)).toBe('poor')
  })
  it('uses custom thresholds', () => {
    expect(matchBand(70, [90, 70, 50])).toBe('good')
    expect(matchBand(69, [90, 70, 50])).toBe('partial')
  })
  it('has a label and the ramp colour for every band', () => {
    expect(BAND_LABEL.great).toBe('Great match')
    expect(BAND_LABEL.poor).toBe('Poor match')
    expect(BAND_COLOR.great).toBe('#1a9850')
  })
})

describe('conditionStatus', () => {
  it('met at 100, partly at 1–99, missed at 0, nodata without data', () => {
    expect(conditionStatus(100)).toBe('met')
    expect(conditionStatus(99)).toBe('partly')
    expect(conditionStatus(1)).toBe('partly')
    expect(conditionStatus(0)).toBe('missed')
    expect(conditionStatus(null)).toBe('nodata')
  })
})

describe('matchSummary', () => {
  it('counts the conditions met among those that are on', () => {
    const s = matchSummary(result({ noise: 40, openPrice: 0 }), ALL_ON)
    expect(s.total).toBe(4)
    expect(s.met).toBe(2)
    expect(s.rows.map((r) => [r.id, r.status])).toEqual([
      ['noise', 'partly'], ['poiAccess', 'met'], ['cityCore', 'met'], ['openPrice', 'missed'],
    ])
  })

  it('ignores conditions that are off, even with a score', () => {
    const s = matchSummary(result({ age: 100 }), ALL_ON)
    expect(s.total).toBe(4)
    expect(s.rows.some((r) => r.id === 'age')).toBe(false)
  })

  it('a condition that is on without data is not met', () => {
    const w = { ...ALL_ON, localsOpinion: 1 }
    const s = matchSummary(result({ localsOpinion: null }, w), w)
    expect(s.total).toBe(5)
    expect(s.met).toBe(4)
    expect(s.rows.find((r) => r.id === 'localsOpinion')).toMatchObject({ status: 'nodata', text: 'no data' })
  })

  it('carries the text given for a row; no data always reads "no data"', () => {
    const s = matchSummary(result({ noise: null }), ALL_ON, { noise: '57 dB', poiAccess: '10 of 10' })
    expect(s.rows.find((r) => r.id === 'poiAccess')).toMatchObject({ label: 'Everyday services', text: '10 of 10' })
    expect(s.rows.find((r) => r.id === 'noise')).toMatchObject({ label: 'Quiet', status: 'nodata', text: 'no data' })
  })

  it('is 0 of 0 when nothing is on', () => {
    const w = { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }
    expect(matchSummary(result({}, w), w)).toEqual({ met: 0, total: 0, rows: [] })
  })
})

describe('matchTooltip', () => {
  it('names the band and the score, without a "meets N of M" count', () => {
    expect(matchTooltip(78)).toBe('Good match · 78')
    expect(matchTooltip(0)).toBe('Poor match · 0')
  })
  it('shows "~" before the score when the data is incomplete (060)', () => {
    expect(matchTooltip(70, undefined, true)).toBe('Good match · ~70')
  })
})

describe('riskLine', () => {
  it('is null without penalties', () => {
    expect(riskLine({ flood: 0, fire: 0, street: 0 })).toBeNull()
  })
  it('sums the points and names the risks that cost them', () => {
    expect(riskLine({ flood: 4, fire: 0, street: 2 }, { flood: '100-year zone' })).toBe(
      'Risk: −6 points — river flooding (100-year zone), street flooding',
    )
  })
})

describe('row texts', () => {
  it('noise', () => {
    expect(noiseText(57, 65)).toBe('57 dB, under your 65')
    expect(noiseText(72, 65)).toBe('72 dB, 7 dB over your 65')
  })
  it('services and places', () => {
    expect(poiText(7, 10, 10)).toBe('7 of 10 within 10 min')
    expect(cityCoreText(12, 13, 30)).toBe('12 of 13 places within 30 min')
    expect(cityCoreText(1, 1, 30)).toBe('1 of 1 place within 30 min')
  })
  it('price', () => {
    expect(priceText(3325, 4000)).toBe('€3,325/m², under your €4,000')
    expect(priceText(4600, 4000)).toBe('€4,600/m², 15% over your €4,000')
    expect(priceText(4010, 4000)).toBe('€4,010/m², under your €4,000') // +0.25% rounds to 0%: it fits
    expect(priceText(4080, 4000)).toBe('€4,080/m², almost fits your €4,000')
  })
  it('locals and age', () => {
    expect(localsText(7.6, 7.5)).toBe('rated 7.6, your minimum 7.5')
    expect(ageText('Historic')).toBe('Historic')
    expect(ageText(null)).toBe('year of construction unknown')
  })
})

describe('bandShares', () => {
  it('counts the share of homes per band, in the order great / good / partial / poor', () => {
    const scores = Uint8Array.from([100, 90, 70, 50, 10, 0, 85, 65])
    // bands 85,65,40: great = 100, 90, 85; good = 70, 65; partial = 50; poor = 10, 0
    expect(bandShares(scores).map((p) => Math.round(p))).toEqual([38, 25, 13, 25])
  })
  it('counts homes when the dwellings are given (TODO-073)', () => {
    // one house that is a great match, one block of 9 flats that is a poor match
    expect(bandShares(Uint8Array.from([95, 10]), [85, 65, 40], Float32Array.from([1, 9]))).toEqual([10, 0, 0, 90])
  })
  it('adds up to 100 and is all zeros without scores', () => {
    const shares = bandShares(Uint8Array.from([100, 50, 0]))
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
    expect(bandShares(new Uint8Array())).toEqual([0, 0, 0, 0])
  })
})

describe('match row parts (072): the value and what it is compared with, for the card rows', () => {
  it('noise: value in dB, the limit after a slash', () => {
    expect(noiseParts(57, 65)).toEqual({ value: '57 dB', limit: ' / 65' })
    expect(noiseParts(72, 65)).toEqual({ value: '72 dB', limit: ' / 65' })
  })
  it('services and places: "5 of 5" in "10 min"', () => {
    expect(poiParts(5, 5, 10)).toEqual({ value: '5 of 5', limit: ' in 10 min' })
    expect(cityCoreParts(12, 13, 30)).toEqual({ value: '12 of 13', limit: ' in 30 min' })
  })
  it('price: the area price, the budget per m², and the gap only when over', () => {
    expect(priceParts(3325, 4000)).toEqual({ value: '€3,325', limit: ' / €4,000 per m²' })
    expect(priceParts(4600, 4000)).toEqual({ value: '€4,600', limit: ' / €4,000 per m² · +15%' })
    expect(priceParts(3585, 3571)).toEqual({ value: '€3,585', limit: ' / €3,571 per m²' }) // +0.4%: no "+0%"
    expect(priceParts(4080, 4000)).toEqual({ value: '€4,080', limit: ' / €4,000 per m² · almost fits' })
  })
  it('locals and age', () => {
    expect(localsParts(7.6, 7.5)).toEqual({ value: '7.6', limit: ' / 7.5' })
    expect(ageParts('Historic')).toEqual({ value: 'Historic' })
    expect(ageParts(null)).toEqual({ value: 'year of construction unknown' })
  })
  it('matchSummary puts the parts on the rows next to the text', () => {
    const r = matchSummary(result({ noise: 100 }), ALL_ON, { noise: 'x' }, { noise: noiseParts(57, 65) })
    const row = r.rows.find((x) => x.id === 'noise')!
    expect(row.text).toBe('x')
    expect(row.value).toBe('57 dB')
    expect(row.limit).toBe(' / 65')
  })
  it('a row without data has no parts', () => {
    const r = matchSummary(result({ noise: null }), ALL_ON, {}, { noise: noiseParts(57, 65) })
    const row = r.rows.find((x) => x.id === 'noise')!
    expect(row.value).toBe('no data')
    expect(row.limit).toBeUndefined()
  })
})
