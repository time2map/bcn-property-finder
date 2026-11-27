import { describe, it, expect } from 'vitest'
import { DATA_VERSION, dataUrl } from './dataUrl'

describe('versioned data addresses (TODO-073)', () => {
  it('adds the version of the data files', () => {
    expect(dataUrl('buildings-meta.json', 'abc123', '/')).toBe('/data/buildings-meta.json?v=abc123')
    expect(dataUrl('buildings.pmtiles', 'abc123', '/repo/')).toBe('/repo/data/buildings.pmtiles?v=abc123')
  })
  it('leaves the address plain without a version', () => {
    expect(dataUrl('areas.geojson', '', '/')).toBe('/data/areas.geojson')
  })
  it('the build sets a version from the data files', () => {
    expect(DATA_VERSION).toMatch(/^[0-9a-f]{10}$/)
  })
})
