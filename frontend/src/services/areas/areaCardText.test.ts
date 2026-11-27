import { describe, expect, it } from 'vitest'
import { incompleteNote, matchCaption, matchLine, strongestLine } from './areaCardText'

describe('area card text (TODO-064)', () => {
  it('says how many homes are a good match', () => {
    expect(matchLine({ n: 1240, shareGood: 70.6, ranked: true })).toBe('71% of 1,240 homes are a good match')
  })
  it('captions the big percentage without repeating it', () => {
    expect(matchCaption({ n: 1055 })).toBe('of 1,055 homes are a good match')
  })
  it('counts one home in the singular', () => {
    expect(matchLine({ n: 1, shareGood: 100, ranked: true })).toBe('100% of 1 home are a good match')
  })
  it('does not give a share for an area with too few homes', () => {
    expect(matchLine({ n: 12, shareGood: 50, ranked: false })).toBe('12 homes: too few to rank')
  })
  it('names the strongest conditions, or nothing', () => {
    expect(strongestLine(['noise', 'poiAccess'])).toMatch(/^Strongest on: .+, .+$/)
    expect(strongestLine([])).toBeNull()
  })
  it('notes incomplete data only when it matters', () => {
    expect(incompleteNote(true)).toMatch(/incomplete/)
    expect(incompleteNote(false)).toBeNull()
  })
})
