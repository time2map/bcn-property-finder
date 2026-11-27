import { describe, it, expect } from 'vitest'
import { clampHeight, mapInset, sheetHeights, snapPosition, PEEK_CONTENT_PX, TOP_RESERVE_PX } from './sheetSnap'

const H = sheetHeights(664)

describe('sheetHeights', () => {
  it('gives peek, half and full for an iPhone 14 in Safari', () => {
    expect(H).toEqual({ peek: PEEK_CONTENT_PX, half: 332, full: 592 })
  })
  it('adds the bottom safe area to peek only', () => {
    expect(sheetHeights(844, 34)).toEqual({ peek: PEEK_CONTENT_PX + 34, half: 422, full: 772 })
  })
  it('stops full below the search pill, and lower still under the status bar of a Home Screen app', () => {
    expect(sheetHeights(664).full).toBe(664 - TOP_RESERVE_PX)
    expect(sheetHeights(844, 34, 47).full).toBe(844 - TOP_RESERVE_PX - 47)
  })
  it('keeps the three positions apart on a very short screen', () => {
    const s = sheetHeights(300)
    expect(s.half - s.peek).toBeGreaterThanOrEqual(80)
    expect(s.full - s.half).toBeGreaterThanOrEqual(80)
  })
})

describe('clampHeight', () => {
  it('stays between peek and full', () => {
    expect(clampHeight(10, H)).toBe(H.peek)
    expect(clampHeight(5000, H)).toBe(H.full)
    expect(clampHeight(300, H)).toBe(300)
  })
})

describe('snapPosition', () => {
  it('settles on the nearest position after a slow drag', () => {
    expect(snapPosition(150, 0.1, H)).toBe('peek')
    expect(snapPosition(250, -0.1, H)).toBe('half')
    expect(snapPosition(500, 0.1, H)).toBe('full')
  })
  it('moves one position up on an upward flick', () => {
    expect(snapPosition(130, 1.2, H)).toBe('half')
    expect(snapPosition(340, 1.2, H)).toBe('full')
    expect(snapPosition(H.full, 2, H)).toBe('full')
  })
  it('moves one position down on a downward flick', () => {
    expect(snapPosition(500, -1.2, H)).toBe('half')
    expect(snapPosition(320, -1.2, H)).toBe('peek')
    expect(snapPosition(H.peek, -2, H)).toBe('peek')
  })
})

describe('mapInset', () => {
  it('pushes the map up by the sheet at peek and half, and keeps half at full', () => {
    expect(mapInset('peek', H)).toBe(H.peek)
    expect(mapInset('half', H)).toBe(H.half)
    expect(mapInset('full', H)).toBe(H.half)
  })
})
