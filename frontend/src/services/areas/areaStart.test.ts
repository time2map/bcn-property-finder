import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaFeature } from '../areas'
import type { BuildingData } from '../buildings/buildingData'
import { scoreAll } from '../buildings/buildingScore'
import { firstVisitSettings, settingsKey } from '../buildings/firstVisit'
import { joinAreas } from './areaJoin'
import { rankAreas } from './areaRank'
import { computeAreaStart, joinFromStart, loadAreaStart, matchesData, resetAreaStartCache, type AreaStart } from './areaStart'
import { buildAreaStart } from './areaStartBuild'
import { resetBuildingsCache } from '../buildings/buildingData'

const square = (id: string, x: number, kind: 'barri' | 'municipality' = 'barri'): AreaFeature => ({
  type: 'Feature', properties: { id, name: id, kind },
  geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
})
const FEATURES = [square('barri-raval', 0), square('muni-hospitalet', 1, 'municipality')]

/** Three buildings: two in el Raval (x 0–1), one in l'Hospitalet (x 1–2). */
const DATA: BuildingData = {
  meta: {
    generated: '2026-11-04', count: 3, columns: [], price_bounds: { p5: 2000, p95: 6000 },
    areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 3000 }, { code: '08101', name: 'Hospitalet', kind: 'muni', price: 2500 }],
    categories: ['supermarket'], landmarks: ['sagrada'],
  },
  count: 3,
  cols: {
    lng: Float32Array.from([0.2, 0.6, 1.5]), lat: Float32Array.from([0.5, 0.5, 0.5]),
    area: Float32Array.from([0, 0, 1]), min_supermarket: Float32Array.from([3, 4, 20]),
    cc_sagrada: Float32Array.from([10, 12, 60]), lden_avg: Float32Array.from([50, 55, 72]),
    river_zone: Float32Array.from([NaN, NaN, NaN]), fire_wui: Float32Array.from([0, 0, 0]),
    fire_hazard: Float32Array.from([0, 0, 0]), street_t10_cm: Float32Array.from([0, 0, 0]),
    street_t100_cm: Float32Array.from([0, 0, 0]), year_built: Float32Array.from([1925, 1950, 1970]),
  },
}

describe('computeAreaStart (058)', () => {
  it('holds the join and the ranks the app computes for the settings of a first visit', () => {
    const start = computeAreaStart(DATA, FEATURES, null)
    expect(start).toMatchObject({ version: 1, generated: '2026-11-04', count: 3, key: settingsKey(firstVisitSettings()) })
    expect(start.join).toEqual({ 0: 'barri-raval', 1: 'muni-hospitalet' })
    const { score, gap, components } = scoreAll(DATA, { ...firstVisitSettings(), vibe: null }, true)
    const on = (['poiAccess', 'noise', 'cityCore', 'openPrice'] as const)
    expect(start.ranks).toEqual(rankAreas(score, DATA.cols.area, DATA.meta.areas, components!, [...on], undefined, undefined, gap))
    // the same join as the app makes itself
    const own = joinAreas(DATA.meta.areas, DATA.cols.area, DATA.cols.lng, DATA.cols.lat, FEATURES)
    expect(joinFromStart(start, FEATURES)).toEqual(own)
  })

  it('is built from the files (column buffers) the same way', () => {
    const meta = {
      ...DATA.meta,
      columns: Object.keys(DATA.cols).map((name, k) => ({
        name, type: 'f32' as const, scale: 1, offset: k * 12, sentinel: null, file: 'scores' as const,
      })),
    }
    const buf = new ArrayBuffer(12 * meta.columns.length)
    Object.values(DATA.cols).forEach((col, k) => new Float32Array(buf, k * 12, 3).set(col))
    const fromFiles = buildAreaStart({ meta, columns: { scores: buf, positions: undefined }, areas: { features: FEATURES }, vibe: null })
    expect(fromFiles).toEqual(computeAreaStart({ ...DATA, meta }, FEATURES, null))
  })
})

describe('matchesData / joinFromStart', () => {
  const start = { version: 1, generated: '2026-11-04', count: 3, join: { 0: 'barri-raval' } } as unknown as AreaStart

  it('accepts the file only for the building data it was computed from', () => {
    expect(matchesData(start, { generated: '2026-11-04', count: 3 })).toBe(true)
    expect(matchesData(start, { generated: '2026-12-01', count: 3 })).toBe(false)
    expect(matchesData(start, { generated: '2026-11-04', count: 4 })).toBe(false)
    expect(matchesData({ ...start, version: 2 } as unknown as AreaStart, { generated: '2026-11-04', count: 3 })).toBe(false)
  })

  it('gives null when a polygon is gone or nothing is joined', () => {
    expect(joinFromStart(start, FEATURES)?.get(0)?.properties.id).toBe('barri-raval')
    expect(joinFromStart(start, [FEATURES[1]])).toBeNull()
    expect(joinFromStart({ ...start, join: {} }, FEATURES)).toBeNull()
  })
})

describe('loadAreaStart', () => {
  const file = { version: 1, generated: '2026-11-04', count: 3, key: 'k', join: {}, ranks: [] }
  const meta = { generated: '2026-11-04', count: 3, columns: [] }
  beforeEach(() => { resetAreaStartCache(); resetBuildingsCache() })
  afterEach(() => vi.unstubAllGlobals())

  const stub = (start: Response) => vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve(url.split('?')[0].endsWith('area-start.json') ? start : new Response(JSON.stringify(meta)))))

  it('gives the file when it fits the building data, once', async () => {
    stub(new Response(JSON.stringify(file)))
    await expect(loadAreaStart()).resolves.toEqual(file)
    await loadAreaStart()
    expect(vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).split('?')[0].endsWith('area-start.json'))).toHaveLength(1)
  })

  it('gives null without a file (dev server), with a stale one, or when offline', async () => {
    stub(new Response('', { status: 404 }))
    await expect(loadAreaStart()).resolves.toBeNull()
    resetAreaStartCache()
    stub(new Response(JSON.stringify({ ...file, count: 9 })))
    await expect(loadAreaStart()).resolves.toBeNull()
    resetAreaStartCache()
    resetBuildingsCache()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    await expect(loadAreaStart()).resolves.toBeNull()
  })
})
