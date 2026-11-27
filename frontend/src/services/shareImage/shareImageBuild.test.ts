import { describe, expect, it } from 'vitest'
import type { AreaRank } from '../areas/areaRank'
import { PRESETS } from '../presets'
import { DEFAULT_COMPOSITE_WEIGHTS } from '../buildings/firstVisit'
import type { AreaFeature } from '../areas'
import type { BuildingsMeta } from '../buildings/buildingData'
import { firstVisitSettings, settingsKey } from '../buildings/firstVisit'
import {
  areaSlug, pageHtml, pageTexts, rankProfiles, scoreSettingsOfProfile, sharePages, type ProfileRanks,
} from './shareImageBuild'

const rank = (over: Partial<AreaRank>): AreaRank => ({
  index: 0, code: '31', name: 'la Vila de Gràcia', kind: 'barri', n: 900, mean: 70, shareGood: 62.4, shareGreat: 20,
  gapShare: 0, incomplete: false, strongest: ['noise'], ranked: true, ...over,
})
const family = PRESETS.find((p) => p.id === 'family')!

describe('scoreSettingsOfProfile', () => {
  it('turns a profile into the settings the buildings are scored with', () => {
    const s = scoreSettingsOfProfile(family)
    expect(s.weights.noise).toBe(1)
    expect(s.weights.cityCore).toBe(0)
    expect(s.conditions.noiseMaxDb).toBe(58)
    expect(s.enabledCategories).toEqual(family.walkCategories)
    expect(s.riskStrengths.flood).toBeGreaterThan(0)
  })
  it('differs from the first-visit weights', () => {
    expect(scoreSettingsOfProfile(family).weights).not.toEqual(DEFAULT_COMPOSITE_WEIGHTS)
  })
})

describe('areaSlug', () => {
  it('has no accents, spaces or apostrophes', () => {
    expect(areaSlug('la Vila de Gràcia')).toBe('la-vila-de-gracia')
    expect(areaSlug("l'Antiga Esquerra de l'Eixample")).toBe('l-antiga-esquerra-de-l-eixample')
  })
  it('is never empty', () => {
    expect(areaSlug('')).toBe('area')
  })
})

describe('sharePages', () => {
  const results: ProfileRanks[] = [
    { profile: null, ranks: [rank({})] },
    { profile: family, ranks: [rank({}), rank({ index: 1, code: '32', name: 'Badalona', kind: 'muni' }), rank({ index: 2, code: '33', name: 'Small', ranked: false })] },
  ]
  it('makes a page for every ranked barri of every profile, and none for the first-visit entry', () => {
    const pages = sharePages(results)
    expect(pages.map((p) => p.path)).toEqual(['family/la-vila-de-gracia'])
  })
  it('adds the code when two barris would share a name', () => {
    const dup = [{ profile: family, ranks: [rank({}), rank({ index: 1, code: '40', name: 'La Vila de Gràcia' })] }]
    expect(sharePages(dup).map((p) => p.path)).toEqual(['family/la-vila-de-gracia', 'family/la-vila-de-gracia-40'])
  })
})

describe('pageTexts / pageHtml', () => {
  const page = { profile: family, rank: rank({}), path: 'family/la-vila-de-gracia' }
  const html = pageHtml(page, 'https://livability.time2map.com', { lng: 2.15812, lat: 41.40312, zoom: 14 })

  it('says the share of good homes for the profile', () => {
    expect(pageTexts(page).title).toBe('la Vila de Gràcia: 62% of homes fit a family · Barcelona livability map')
    expect(pageTexts(page).description).toContain('62% of the homes in la Vila de Gràcia')
  })
  it('carries the link-preview tags with absolute addresses', () => {
    expect(html).toContain('<meta property="og:image" content="https://livability.time2map.com/share/family/la-vila-de-gracia.jpg" />')
    expect(html).toContain('<meta property="og:url" content="https://livability.time2map.com/share/family/la-vila-de-gracia/" />')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('og:image:width" content="1200"')
  })
  it('sends people to the map with the profile and the view', () => {
    const map = 'https://livability.time2map.com/?c=preset:family&amp;zoom=14.00&amp;cx=2.15812&amp;cy=41.40312&amp;a=31'
    expect(html).toContain(`http-equiv="refresh" content="0; url=${map}"`)
    expect(html).toContain('location.replace("https://livability.time2map.com/?c=preset:family&zoom=14.00&cx=2.15812&cy=41.40312&a=31")')
  })
  it('keeps the path of a fork', () => {
    const fork = pageHtml(page, 'https://sempo.github.io/bcn-livability', { lng: 2, lat: 41, zoom: 14 })
    expect(fork).toContain('og:image" content="https://sempo.github.io/bcn-livability/share/family/la-vila-de-gracia.jpg"')
  })
  it('escapes what it prints', () => {
    const odd = { ...page, rank: rank({ name: 'A "B" <C> & D' }) }
    const out = pageHtml(odd, 'https://x.test', { lng: 2, lat: 41, zoom: 14 })
    expect(out).toContain('A &quot;B&quot; &lt;C&gt; &amp; D')
    expect(out).not.toContain('<C>')
  })
})

describe('rankProfiles', () => {
  const square = (id: string, x: number): AreaFeature => ({
    type: 'Feature', properties: { id, name: id, kind: 'barri' },
    geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  })
  // Three buildings in one barri, 60 values per column file: the same layout the build reads.
  const names = ['lng', 'lat', 'area', 'min_supermarket', 'cc_sagrada', 'lden_avg', 'river_zone', 'fire_wui', 'fire_hazard',
    'street_t10_cm', 'street_t100_cm', 'year_built'] as const
  const values: Record<(typeof names)[number], number[]> = {
    lng: [0.2, 0.4, 0.6], lat: [0.5, 0.5, 0.5], area: [0, 0, 0], min_supermarket: [3, 4, 20], cc_sagrada: [10, 12, 60],
    lden_avg: [50, 55, 72], river_zone: [NaN, NaN, NaN], fire_wui: [0, 0, 0], fire_hazard: [0, 0, 0],
    street_t10_cm: [0, 0, 0], street_t100_cm: [0, 0, 0], year_built: [1925, 1950, 1970],
  }
  const meta: BuildingsMeta = {
    generated: '2026-11-04', count: 3, price_bounds: { p5: 2000, p95: 6000 },
    areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 3000 }],
    categories: ['supermarket'], landmarks: ['sagrada'],
    columns: names.map((name, k) => ({ name, type: 'f32' as const, scale: 1, offset: k * 12, sentinel: null, file: 'scores' as const })),
  }
  const buf = new ArrayBuffer(12 * names.length)
  names.forEach((n, k) => new Float32Array(buf, k * 12, 3).set(values[n]))
  const files = { meta, columns: { scores: buf, positions: undefined }, areas: { features: [square('barri-raval', 0)] }, vibe: null }

  it('ranks the areas for the first visit and for every profile, with the app scoring', () => {
    const { results, join } = rankProfiles(files)
    expect(results.map((r) => r.profile?.id ?? null)).toEqual([null, ...PRESETS.map((p) => p.id)])
    expect(join.get(0)?.properties.id).toBe('barri-raval')
    for (const r of results) {
      expect(r.ranks).toHaveLength(1)
      expect(r.ranks[0].n).toBe(3)
    }
  })

  it('scores the first-visit entry with the first-visit settings, and a profile with its own', () => {
    const { results } = rankProfiles(files, [family])
    expect(settingsKey(scoreSettingsOfProfile(family))).not.toBe(settingsKey(firstVisitSettings()))
    expect(results).toHaveLength(2)
    // The family profile does not ask for the centre, so the strongest conditions differ from the first visit's.
    expect(results[1].ranks[0].strongest).not.toContain('cityCore')
  })
})
