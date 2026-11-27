import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '../../i18n'
import { PRESETS } from '../presets'
import { URL_DEFAULTS } from '../../store'
import { decodeConfig } from '../urlConfig'
import type { MatchSummary } from '../match/matchSummary'
import {
  areaShareModel, buildingShareModel, MAX_ROWS, profileOf, rankTexts, shareFileName, firstAddress, wrapLines,
} from './shareImageModel'
import type { Award, BuildingRanks } from '../buildings/buildingRank'

const rank = (o: Partial<Award>): Award => ({ above: 50, n: 500, tier: 10, ...o })
const RANKS: BuildingRanks = {
  local: { name: 'la Vila de Gràcia', kind: 'barri', rank: rank({ tier: 10 }) },
  wide: { scope: 'barcelona', rank: rank({ tier: 20 }) },
}

describe('rank tiles on the building picture (TODO-070), worded as on the card', () => {
  it('writes the barri and the city lines', () => {
    expect(rankTexts(RANKS)).toEqual([
      { value: 'Top 10%', tier: 10, text: 'of homes in la Vila de Gràcia' },
      { value: 'Top 20%', tier: 20, text: 'of homes in Barcelona' },
    ])
  })
  it('names a municipality and the metro area', () => {
    expect(rankTexts({
      local: { name: 'Badalona', kind: 'muni', rank: rank({ tier: 10 }) },
      wide: { scope: 'metro', rank: rank({ tier: 20 }) },
    })).toEqual([
      { value: 'Top 10%', tier: 10, text: 'of homes in Badalona' },
      { value: 'Top 20%', tier: 20, text: 'of homes in the Barcelona area' },
    ])
  })
  it('writes only the scopes where the building stands out', () => {
    expect(rankTexts({ local: null, wide: { scope: 'barcelona', rank: rank({ tier: 20 }) } })).toEqual([{ value: 'Top 20%', tier: 20, text: 'of homes in Barcelona' }])
    expect(rankTexts({ ...RANKS, wide: null })).toEqual([{ value: 'Top 10%', tier: 10, text: 'of homes in la Vila de Gràcia' }])
  })
  it('skips the barri line when it is not ranked', () => {
    expect(rankTexts({ ...RANKS, local: null })).toEqual([{ value: 'Top 20%', tier: 20, text: 'of homes in Barcelona' }])
  })
  it('carries them on the model, with a heading only when no profile says for whom', () => {
    const base = { address: 'Carrer Perla 20', area: null, score: 80, summary: { met: 0, total: 0, rows: [] }, riskText: null, ranks: RANKS }
    const bare = buildingShareModel({ ...base, profile: null })
    expect(bare.ranks).toHaveLength(2)
    expect(bare.ranksHeading).toBe('For your conditions')
    const family = buildingShareModel({ ...base, profile: FAMILY })
    expect(family.ranks).toHaveLength(2)
    expect(family.ranksHeading).toBeNull()
    expect(family.forWhom).toBe('For a family')
  })
  it('has none without a rank, and none on an area picture', () => {
    const none = buildingShareModel({ address: 'x', area: null, score: 80, summary: { met: 0, total: 0, rows: [] }, riskText: null, profile: null })
    expect(none.ranks).toEqual([])
    expect(none.ranksHeading).toBeNull()
    expect(areaShareModel({ rank: { name: 'x', kind: 'barri', shareGood: 50, mean: 60, strongest: [] }, profile: null }).ranks).toEqual([])
  })
})

const summary = (rows: MatchSummary['rows']): MatchSummary => ({
  met: rows.filter((r) => r.status === 'met').length, total: rows.length, rows,
})

const FAMILY = { id: 'family', name: 'Family' }
const quiet = { id: 'noise', label: 'Quiet', status: 'met', text: '52 dB, under your 58' } as const
const services = { id: 'poiAccess', label: 'Everyday services', status: 'partly', text: '4 of 5 within 10 min' } as const
const budget = { id: 'openPrice', label: 'Budget', status: 'missed', text: '€5,594/m², 57% over your €3,571' } as const

describe('firstAddress', () => {
  it('keeps the house number', () => {
    expect(firstAddress('Carrer Perla 20')).toBe('Carrer Perla 20')
    expect(firstAddress('Passeig de Gràcia 12-14')).toBe('Passeig de Gràcia 12-14')
  })
  it('keeps the first address of a corner building', () => {
    expect(firstAddress('Carrer Tenerife 59 · Carrer Torre Dulac 14')).toBe('Carrer Tenerife 59')
  })
  it('is null for no address', () => {
    expect(firstAddress(null)).toBeNull()
    expect(firstAddress('')).toBeNull()
  })
})

describe('profileOf', () => {
  it('finds the profile of a preset link', () => {
    for (const p of PRESETS) {
      const s = decodeConfig(`preset:${p.id}`, URL_DEFAULTS)!
      expect(profileOf(s, URL_DEFAULTS)?.id).toBe(p.id)
    }
  })
  it('is null once a limit is changed', () => {
    const s = decodeConfig('preset:family;n:50', URL_DEFAULTS)!
    expect(profileOf(s, URL_DEFAULTS)).toBeNull()
  })
  it('is null for the default settings', () => {
    expect(profileOf(URL_DEFAULTS, URL_DEFAULTS)).toBeNull()
  })
})

describe('buildingShareModel', () => {
  const base = {
    address: 'Carrer Tenerife 59 · Carrer Torre Dulac 14',
    area: { name: 'Can Baró', kind: 'barri' as const },
    score: 83, summary: summary([quiet, services, budget]), riskText: null, profile: FAMILY,
  }

  it('puts the street without the number, the barri and the city', () => {
    const m = buildingShareModel(base)
    expect(m.place).toBe('Carrer Tenerife 59')
    expect(m.subtitle).toBe('Can Baró, Barcelona')
  })
  it('names a municipality without the city', () => {
    expect(buildingShareModel({ ...base, area: { name: 'Badalona', kind: 'muni' } }).subtitle).toBe('Badalona')
  })
  it('says the other profiles in words too, and falls back to the name', () => {
    expect(buildingShareModel({ ...base, profile: { id: 'remote', name: 'Remote worker' } }).forWhom).toBe('For a remote worker')
    expect(buildingShareModel({ ...base, profile: { id: 'custom', name: 'Nomad' } }).forWhom).toBe('For Nomad')
  })
  it('has no subtitle without an area, and falls back to the barri name without an address', () => {
    expect(buildingShareModel({ ...base, area: null }).subtitle).toBeNull()
    expect(buildingShareModel({ ...base, address: null }).place).toBe('Can Baró')
    expect(buildingShareModel({ ...base, address: null, area: null }).place).toBe('Barcelona')
  })
  it('takes the band and colour of the score', () => {
    expect(buildingShareModel({ ...base, score: 92 }).band).toBe('great')
    expect(buildingShareModel({ ...base, score: 83 })).toMatchObject({ band: 'good', bandLabel: 'Good match', bandColor: '#91cf60' })
    expect(buildingShareModel({ ...base, score: 59 }).band).toBe('partial')
    expect(buildingShareModel({ ...base, score: 20 }).band).toBe('poor')
  })
  it('shows the score as a number and no "Meets N of M" line', () => {
    const m = buildingShareModel(base)
    expect(m.value).toBe('83')
    expect(JSON.stringify(m)).not.toMatch(/Meets/i)
  })
  it('writes "For a family" only with a profile', () => {
    expect(buildingShareModel(base).forWhom).toBe('For a family')
    expect(buildingShareModel({ ...base, profile: null }).forWhom).toBeNull()
  })
  it('gives every condition a row with its status and words', () => {
    const m = buildingShareModel(base)
    expect(m.rows).toEqual([
      { status: 'met', text: 'Quiet: 52 dB, under your 58' },
      { status: 'partly', text: 'Everyday services: 4 of 5 within 10 min' },
      { status: 'missed', text: 'Budget: €5,594/m², 57% over your €3,571' },
    ])
  })
  it('puts a risk row last, and keeps it when the rows are cut', () => {
    const many = summary([quiet, services, budget, { ...quiet, id: 'cityCore', label: 'Centre' }, { ...quiet, id: 'age', label: 'Age' }])
    const m = buildingShareModel({ ...base, summary: many, riskText: 'Risk: −13 points — street flooding' })
    expect(m.rows).toHaveLength(MAX_ROWS)
    expect(m.rows[MAX_ROWS - 1]).toEqual({ status: 'risk', text: 'Risk: −13 points — street flooding' })
  })
  it('cuts to the maximum without a risk row', () => {
    const many = summary([quiet, services, budget, quiet, quiet, quiet])
    expect(buildingShareModel({ ...base, summary: many }).rows).toHaveLength(MAX_ROWS)
  })
  it('keeps a "no data" row as a dash', () => {
    const nodata = { id: 'noise', label: 'Quiet', status: 'nodata', text: 'no data' } as const
    expect(buildingShareModel({ ...base, summary: summary([nodata]) }).rows).toEqual([{ status: 'nodata', text: 'Quiet: no data' }])
  })
})

describe('areaShareModel', () => {
  const rank = { name: 'Gràcia', kind: 'barri' as const, shareGood: 62.4, mean: 70, strongest: ['noise', 'poiAccess'] as const }

  it('shows the share of good homes as a percent', () => {
    const m = areaShareModel({ rank: { ...rank, strongest: [...rank.strongest] }, profile: FAMILY })
    expect(m).toMatchObject({ kind: 'area', place: 'Gràcia', subtitle: 'Barcelona', value: '62%', forWhom: 'For a family' })
    expect(m.caption).toBe('of homes are a good match')
  })
  it('colours the plaque by the mean score', () => {
    expect(areaShareModel({ rank: { ...rank, strongest: [] }, profile: null }).bandColor).toBe('#91cf60')
    expect(areaShareModel({ rank: { ...rank, mean: 90, strongest: [] }, profile: null }).bandColor).toBe('#1a9850')
  })
  it('lists what the area is best at as met rows', () => {
    const m = areaShareModel({ rank: { ...rank, strongest: [...rank.strongest] }, profile: null })
    expect(m.rows).toEqual([
      { status: 'met', text: 'Strong on: Quiet' },
      { status: 'met', text: 'Strong on: Everyday services' },
    ])
    expect(m.forWhom).toBeNull()
  })
  it('names a municipality as the metro area', () => {
    expect(areaShareModel({ rank: { ...rank, kind: 'muni', strongest: [] }, profile: null }).subtitle).toBe('Metro area')
  })
})

describe('shareFileName', () => {
  it('is a plain lower-case file name', () => {
    expect(shareFileName('Carrer Tenerife', 'png')).toBe('barcelona-livability-carrer-tenerife.png')
    expect(shareFileName('Vila de Gràcia', 'jpg')).toBe('barcelona-livability-vila-de-gracia.jpg')
    expect(shareFileName('', 'png')).toBe('barcelona-livability.png')
  })
})

describe('wrapLines', () => {
  const width = (s: string) => s.length * 10
  it('breaks at spaces to fit the width', () => {
    expect(wrapLines('aaa bbb ccc ddd', 80, width, 5)).toEqual(['aaa bbb', 'ccc ddd'])
  })
  it('cuts the last line with an ellipsis at the maximum number of lines', () => {
    const lines = wrapLines('aaa bbb ccc ddd eee fff', 70, width, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
    expect(width(lines[1])).toBeLessThanOrEqual(70)
  })
  it('keeps one long word on its line', () => {
    expect(wrapLines('abcdefghijkl', 50, width, 3)[0]).toContain('abcde')
  })
  it('returns no lines for an empty text', () => {
    expect(wrapLines('', 100, width, 2)).toEqual([])
  })
})

describe('the picture speaks the page language', () => {
  const FAM = { id: 'family', name: 'Family' }
  afterEach(async () => { await setLanguage('en') })

  it.each([['es', 'Para una familia', 'de las viviendas'], ['ca', 'Per a una família', 'dels habitatges']])(
    'in %s: the rank lines, the heading, the profile and the area texts have no English left', async (lang, family, home) => {
      await setLanguage(lang as 'es' | 'ca')
      const b = buildingShareModel({
        address: 'Carrer Perla 20', area: null, score: 80, summary: { met: 0, total: 0, rows: [] }, riskText: null,
        profile: null, ranks: RANKS,
      })
      expect(b.ranks.every((r) => r.text.startsWith(home))).toBe(true)
      expect(b.ranksHeading).not.toBe('For your conditions')
      expect(b.bandLabel).not.toMatch(/match/)
      const a = areaShareModel({
        rank: { name: 'Gràcia', kind: 'muni', shareGood: 62, mean: 70, strongest: ['noise'] }, profile: FAM,
      })
      expect(a.forWhom).toBe(family)
      expect(a.subtitle).not.toBe('Metro area')
      expect(a.caption).not.toBe('of homes are a good match')
      expect(a.rows[0].text).not.toMatch(/^Strong on/)
    })
})
