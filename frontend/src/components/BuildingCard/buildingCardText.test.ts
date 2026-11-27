import { describe, it, expect } from 'vitest'
import {
  countWithin, depthMeaning, depthText, doorWaterText, groundFloorWarning, noiseVsLimit, priceVsBudget, ratingVsMin, riverText,
  quietSide, sideText,
} from './buildingCardText'
import { fireText } from './cardText'

describe('building card texts (TODO-046)', () => {
  it('river zone in plain words', () => {
    expect(riverText(10)).toMatch(/10-year.*high probability/)
    expect(riverText(100)).toMatch(/100-year.*medium/)
    expect(riverText(500)).toMatch(/500-year.*low/)
    expect(riverText(undefined)).toBe('Outside mapped river flood zones')
  })

  it('depth caps at ≥ 50 cm and says what it means', () => {
    expect(depthText(12.4)).toBe('12 cm')
    expect(depthText(73)).toBe('≥ 50 cm')
    expect(depthMeaning(5)).toBe('stays in the gutter')
    expect(depthMeaning(20)).toMatch(/doorsteps/)
    expect(depthMeaning(40)).toMatch(/ground floors/)
    expect(depthMeaning(80)).toMatch(/cars can float/)
  })

  it('water at the door', () => {
    expect(doorWaterText(undefined, undefined)).toMatch(/outside Barcelona/)
    expect(doorWaterText(0, 0.4)).toBe('No water at the door modelled in heavy rain')
    expect(doorWaterText(12, 60)).toBe('Water at the door: 12 cm in a 10-year rain, ≥ 50 cm in a 100-year rain — serious damage, cars can float')
  })

  it('ground-floor warning only with ≥ 10 cm of water or a river zone', () => {
    expect(groundFloorWarning(5, 9, undefined, 2)).toBeNull()
    expect(groundFloorWarning(0, 10, undefined, undefined)).toBe('Careful if you are looking at a ground-floor flat, basement or garage.')
    expect(groundFloorWarning(undefined, undefined, 500, 2)).toMatch(/This building has 2 floors below ground\.$/)
    expect(groundFloorWarning(undefined, undefined, 100, 1)).toMatch(/1 floor below ground\.$/)
  })

  it('facade side', () => {
    expect(sideText('street', 71.6, 63.2)).toBe('Street side: 72 dB · night 63')
    expect(sideText('inner', 50, undefined)).toBe('Courtyard side: 50 dB')
    expect(sideText('inner', undefined, 40)).toBeNull()
  })
})

describe('fireText (036)', () => {
  it('the WUI gates the risk; the nearest rated forest explains it', () => {
    expect(fireText({ fire_wui: 0, fire_class: 9, fire_dist_m: 80 })).toBe('Not in the wildland–urban interface')
    expect(fireText({ fire_wui: 1, fire_class: null, fire_dist_m: null })).toBe('Wildland–urban interface · no rated forest nearby')
    expect(fireText({ fire_wui: 1, fire_class: 9, fire_dist_m: 80 }))
      .toBe('Wildland–urban interface · hazard class 9 forest at ~80 m')
  })
})

describe('the building against your conditions (049)', () => {
  it('noise', () => {
    expect(noiseVsLimit(62.4, 65)).toBe('62 dB — within your 65 dB')
    expect(noiseVsLimit(71.6, 65)).toBe('72 dB — 7 dB over your 65 dB')
  })

  it('price', () => {
    expect(priceVsBudget(3900, 4000)).toMatch(/^€3[.,]?900\/m² — within your €4[.,]?000\/m²$/)
    expect(priceVsBudget(4700, 4000)).toMatch(/^€4[.,]?700\/m² — 18% over your €4[.,]?000\/m²$/)
  })

  it('places and services within reach', () => {
    expect(countWithin([3, 12, null], 10, 'services')).toBe('1 of 3 services within 10 min')
    expect(countWithin([45], 30, 'places')).toBe('0 of 1 place within 30 min')
  })

  it("residents' rating", () => {
    expect(ratingVsMin(7.62, 7.5)).toBe('Residents rate 7.6 — meets your 7.5')
    expect(ratingVsMin(7.2, 7.5)).toBe('Residents rate 7.2 — below your 7.5')
  })
})

describe('quietSide (TODO-073)', () => {
  it('is the courtyard level when the street side is over the limit and the courtyard within it', () => {
    expect(quietSide({ lden_street: 70, lden_inner: 47 }, 65)).toBe(47)
  })
  it('is null when the street side is within the limit, the courtyard too loud, or a side is missing', () => {
    expect(quietSide({ lden_street: 60, lden_inner: 47 }, 65)).toBeNull()
    expect(quietSide({ lden_street: 70, lden_inner: 66 }, 65)).toBeNull()
    expect(quietSide({ lden_street: 70 }, 65)).toBeNull()
    expect(quietSide({ lden_inner: 40 }, 65)).toBeNull()
  })
})
