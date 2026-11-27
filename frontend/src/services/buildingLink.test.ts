import { describe, expect, it } from 'vitest'
import { buildingLinkUrl, encodeBuildingParam, nearestBuilding, parseBuildingParam } from './buildingLink'

describe('encodeBuildingParam / parseBuildingParam (TODO-064)', () => {
  it('writes the position with five decimals', () => {
    expect(encodeBuildingParam(2.17401234, 41.4030099)).toBe('2.17401,41.40301')
  })
  it('reads it back', () => {
    expect(parseBuildingParam('2.17401,41.40301')).toEqual([2.17401, 41.40301])
  })
  it.each([null, '', 'abc', '2.1', '2.1,x', '2.1,41.4,5', '200,41', '2,95'])('rejects %j', (v) => {
    expect(parseBuildingParam(v)).toBeNull()
  })
})

describe('nearestBuilding', () => {
  const lng = new Float32Array([2.1, 2.1001, 2.2])
  const lat = new Float32Array([41.4, 41.4, 41.5])
  it('finds the closest building', () => {
    expect(nearestBuilding(lng, lat, 2.10008, 41.4)).toBe(1)
  })
  it('returns null when nothing is within the limit', () => {
    expect(nearestBuilding(lng, lat, 2.15, 41.45)).toBeNull()
  })
  it('returns null for no buildings', () => {
    expect(nearestBuilding(new Float32Array(0), new Float32Array(0), 2.1, 41.4)).toBeNull()
  })
})

describe('buildingLinkUrl', () => {
  it('keeps the settings, centres the view on the building and adds b', () => {
    const url = buildingLinkUrl('https://x.test/app/?minutes=60&zoom=12.00&cx=2.1&cy=41.4&c=preset:family#h', 'preset:family', [2.17401, 41.40301])
    const u = new URL(url)
    expect(u.pathname).toBe('/app/')
    expect(u.searchParams.get('b')).toBe('2.17401,41.40301')
    expect(u.searchParams.get('c')).toBe('preset:family')
    expect(u.searchParams.get('cx')).toBe('2.17401')
    expect(u.searchParams.get('cy')).toBe('41.40301')
    expect(Number(u.searchParams.get('zoom'))).toBeGreaterThanOrEqual(17)
    expect(u.hash).toBe('#h')
  })
  it('writes c=default for default settings', () => {
    expect(buildingLinkUrl('https://x.test/', '', [2.1, 41.4])).toContain('c=default')
  })
})
