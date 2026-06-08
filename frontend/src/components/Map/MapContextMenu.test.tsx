import { describe, it, expect } from 'vitest'
import { buildGoogleMapsUrl } from './googleMapsUrl'

describe('buildGoogleMapsUrl', () => {
  it('produces correct Google Maps satellite URL', () => {
    const url = buildGoogleMapsUrl(41.3782312, 2.1509157)
    expect(url).toBe(
      'https://www.google.com/maps/@41.3782312,2.1509157,686a,35y/',
    )
  })

  it('rounds coordinates to 7 decimal places', () => {
    const url = buildGoogleMapsUrl(41.123456789, 2.987654321)
    expect(url).toContain('@41.1234568,2.9876543,')
  })

  it('contains altitude and fov parameters', () => {
    const url = buildGoogleMapsUrl(41.4, 2.2)
    expect(url).toContain('686a')
    expect(url).toContain('35y')
  })

  it('does not contain heading or tilt parameters', () => {
    const url = buildGoogleMapsUrl(41.4, 2.2)
    expect(url).not.toContain('h,')
    expect(url).not.toContain('t/')
  })
})
