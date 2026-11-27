import { describe, it, expect } from 'vitest'
import { parseIdList } from './firstVisit'

describe('parseIdList (TODO-073)', () => {
  const all = ['a', 'b', 'c']
  it('keeps the known ids in the order of all', () => {
    expect(parseIdList('c, a, x', all, ['b'])).toEqual(['a', 'c'])
  })
  it('falls back when empty or unknown', () => {
    expect(parseIdList(undefined, all, ['b'])).toEqual(['b'])
    expect(parseIdList('', all, ['b'])).toEqual(['b'])
    expect(parseIdList('x,y', all, ['b'])).toEqual(['b'])
  })
})
