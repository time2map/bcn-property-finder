import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { areaLink } from './areaLink'
import { areaSlug } from '../shareImage/shareImageModel'

const base = {
  name: 'la Vila de Gràcia', code: '31', kind: 'barri' as const, ranked: true, profile: { id: 'family' },
  siteUrl: 'https://s.test/app', href: 'https://s.test/app/?zoom=14.00&cx=2.15&cy=41.4', config: 'preset:family',
}

describe('areaLink (TODO-064)', () => {
  it('points a ranked barri with a profile to its static page', () => {
    expect(areaLink(base)).toBe('https://s.test/app/share/family/la-vila-de-gracia/')
  })
  it('gives the map link when the settings are not a profile', () => {
    const url = areaLink({ ...base, profile: null, config: 'w:noise=5' })
    expect(new URL(url).searchParams.get('a')).toBe('31')
    expect(url).toContain('c=w:noise=5')
  })
  it('gives the map link for a municipality and for an unranked barri', () => {
    expect(areaLink({ ...base, kind: 'muni' })).toContain('?zoom=14.00')
    expect(areaLink({ ...base, ranked: false })).toContain('?zoom=14.00')
  })
  it('names every barri differently', () => {
    const areas = JSON.parse(readFileSync('public/data/areas.geojson', 'utf8')) as {
      features: { properties: { kind: string; name: string } }[]
    }
    const slugs = areas.features.filter((f) => f.properties.kind === 'barri').map((f) => areaSlug(f.properties.name))
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
