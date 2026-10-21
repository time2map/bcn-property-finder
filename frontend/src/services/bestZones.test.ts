import { describe, it, expect } from 'vitest'
import { cellsToMultiPolygon, cellToLatLng, gridDisk, gridDistance, gridPathCells, latLngToCell } from 'h3-js'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { MultiPolygon, Polygon } from 'geojson'
import { allowedCells, findBestZones, findZoneCells, growZone, smoothScores, type Bounds } from './bestZones'
import { buildIdealistaUrl } from './idealista'

const RES = 9
const CENTER = latLngToCell(41.39, 2.17, RES)
const WHOLE: Bounds = [2.0, 41.2, 2.4, 41.6]
// Synthetic grids are mostly zero-score cells, so topPct must stay below the share of elevated
// cells — otherwise the threshold lands on the zero tie and the whole grid becomes one zone.

/** Base grid (score 0) with clusters painted on top: [lat, lng, radius, score]. */
function grid(clusters: [number, number, number, number][]): Map<string, number> {
  const scores = new Map(gridDisk(CENTER, 20).map((h) => [h, 0]))
  for (const [lat, lng, k, score] of clusters) {
    for (const h of gridDisk(latLngToCell(lat, lng, RES), k)) scores.set(h, score)
  }
  return scores
}

function contains(zone: Polygon, lat: number, lng: number): boolean {
  const [cLat, cLng] = cellToLatLng(latLngToCell(lat, lng, RES))
  return booleanPointInPolygon([cLng, cLat], zone)
}

const A: [number, number] = [41.40, 2.155] // big, good cluster
const B: [number, number] = [41.375, 2.185] // small, slightly worse cluster
const SPIKE: [number, number] = [41.395, 2.195] // one outstanding hex

describe('smoothScores', () => {
  it('averages a cell with its known neighbours', () => {
    const spikeCell = latLngToCell(SPIKE[0], SPIKE[1], RES)
    const smooth = smoothScores(grid([[SPIKE[0], SPIKE[1], 0, 70]]))
    expect(smooth.get(spikeCell)).toBeCloseTo(10) // (70 + 6 × 0) / 7
  })
})

describe('growZone', () => {
  it('grows a compact blob, not a strip along a line of good hexes', () => {
    // A straight line of hexes with the best scores — greedy-by-score growth would follow it.
    const line = gridPathCells(CENTER, gridDisk(CENTER, 6).find((h) => gridDistance(CENTER, h) === 6)!)
    const score = (h: string) => { const i = line.indexOf(h); return i >= 0 ? 100 - i : 50 }
    const zone = growZone([CENTER], () => true, score)
    expect(zone).toHaveLength(5)
    const span = Math.max(...zone.flatMap((a) => zone.map((b) => gridDistance(a, b))))
    expect(span).toBeLessThanOrEqual(2) // a 5-hex strip would span 4
  })
})

/** Outline of the hexes within `k` of a point, as GeoJSON. */
const area = ([lat, lng]: [number, number], k: number): MultiPolygon =>
  ({ type: 'MultiPolygon', coordinates: cellsToMultiPolygon(gridDisk(latLngToCell(lat, lng, RES), k), true) })

describe('allowedCells', () => {
  const cell = ([lat, lng]: [number, number]) => latLngToCell(lat, lng, RES)

  it('no isochrone and no exclusions = no restriction', () => {
    expect(allowedCells(null, [])).toBeUndefined()
  })

  it('allows hexes inside the isochrone that do not touch an exclusion zone', () => {
    const allowed = allowedCells(area(A, 8), [area(A, 1)])!
    expect(allowed(cell(A))).toBe(false) // inside the exclusion
    expect(allowed(gridDisk(cell(A), 4).find((h) => gridDistance(cell(A), h) === 4)!)).toBe(true)
    expect(allowed(cell(B))).toBe(false) // outside the isochrone
  })

  it('without an isochrone, only exclusions apply', () => {
    const allowed = allowedCells(null, [area(A, 1)])!
    expect(allowed(cell(A))).toBe(false)
    expect(allowed(cell(B))).toBe(true)
  })
})

describe('findBestZones', () => {
  const base = { bounds: WHOLE, scoreRange: [0, 100] as [number, number], topPct: 3 }

  it('returns [] for empty input or an empty viewport', () => {
    expect(findBestZones({ ...base, scores: new Map() })).toEqual([])
    expect(findBestZones({ ...base, scores: grid([[...A, 2, 90]]), bounds: [0, 0, 1, 1] })).toEqual([])
  })

  it('finds both clusters, the one with more mass first, and ignores a lone spike', () => {
    const zones = findBestZones({ ...base, scores: grid([[...A, 2, 90], [...B, 1, 80], [...SPIKE, 0, 100]]) })
    expect(zones).toHaveLength(2)
    expect(contains(zones[0], ...A)).toBe(true)
    expect(contains(zones[1], ...B)).toBe(true)
    expect(zones.some((z) => contains(z, ...SPIKE))).toBe(false)
  })

  describe('number of zones = separate good areas at this strictness (1–3, never 0)', () => {
    const [lat0, lng0] = cellToLatLng(CENTER)
    const view: Bounds = [lng0 - 0.016, lat0 - 0.012, lng0 + 0.016, lat0 + 0.012] // ~60 hexes
    const surface = (f: (lat: number, lng: number) => number) =>
      new Map(gridDisk(CENTER, 20).map((h) => [h, f(...cellToLatLng(h))]))

    it('a tiny strict core (top 5% = ~3 hexes) is grown into a zone instead of giving 0', () => {
      const hill = surface((lat, lng) => 90 - 1000 * Math.hypot(lat - lat0, lng - lng0))
      const zones = findBestZones({ ...base, topPct: 5, bounds: view, scores: hill })
      expect(zones).toHaveLength(1)
      const xs = zones[0].coordinates[0].map(([x]) => x)
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.006) // compact, ≥ ~2 hexes wide
    })

    it('falls back to the best area that fits when the strict core is boxed in', () => {
      // Best 2 hexes, but their neighbours are outside the score range → the core can't grow to 5.
      const scores = grid([[...SPIKE, 1, 50], [...SPIKE, 0, 95], [...A, 3, 61]])
      const [nb] = gridDisk(latLngToCell(SPIKE[0], SPIKE[1], RES), 1).filter((h) => h !== latLngToCell(SPIKE[0], SPIKE[1], RES))
      scores.set(nb, 95)
      const zones = findBestZones({ ...base, topPct: 2, scoreRange: [60, 100], scores }) // only the boxed hex passes
      expect(zones).toHaveLength(1)
      // Grown from one of A's (equally good) hexes — so it lies within A, away from the boxed spike.
      for (const [lng, lat] of zones[0].coordinates[0]) expect(Math.hypot(lng - A[1], lat - A[0])).toBeLessThan(0.015)
    })

    it('one uniformly good area stays one zone — not split to fill a quota', () => {
      const plateau = surface(() => 85)
      expect(findBestZones({ ...base, topPct: 5, bounds: view, scores: plateau })).toHaveLength(1)
    })

    it('separate good areas give separate zones that never touch', () => {
      const rolling = surface((lat, lng) => 60 + 25 * Math.sin(lat * 300) * Math.cos(lng * 250))
      const zones = findBestZones({ ...base, topPct: 5, bounds: view, scores: rolling })
      expect(zones.length).toBeGreaterThanOrEqual(2)
      for (const a of zones) for (const b of zones) {
        if (a !== b) expect(a.coordinates[0].some((p) => booleanPointInPolygon(p, b))).toBe(false)
      }
    })
  })

  it('ranks by mass, not by mean score', () => {
    // B is better per cell but much smaller than A.
    const zones = findBestZones({ ...base, topPct: 4, scores: grid([[...A, 3, 70], [...B, 1, 95]]) })
    expect(contains(zones[0], ...A)).toBe(true)
    expect(contains(zones[1], ...B)).toBe(true)
  })

  describe('sticky zones while only strictness changes', () => {
    // A, B strong; C broad and mediocre (slightly better centre); D small but strong.
    const C: [number, number] = [41.37, 2.145]
    const scores = grid([[...A, 3, 95], [...B, 3, 90], [...C, 4, 66], [...C, 1, 70], [...SPIKE, 1, 85]])
    const label = (zones: string[][]) => zones.map((z) =>
      ([['A', A], ['B', B], ['C', C], ['D', SPIKE]] as const)
        .filter(([, [lat, lng]]) => z.includes(latLngToCell(lat, lng, RES))).map(([k]) => k).join('')).join(' ')
    const at = (topPct: number, sticky?: string[][]) => findZoneCells({ ...base, scores, topPct, sticky })

    it('recomputed from scratch, the contested 3rd slot jumps from C to D', () => {
      expect(label(at(6))).toBe('A B C')
      expect(label(at(4))).toBe('A B D')
    })

    it('with the previous zones, C keeps its place and number; D is added as a near-tie instead', () => {
      expect(label(at(4, at(6)))).toBe('A B C D')
    })

    it('a sticky zone disappears once nothing in it passes the threshold', () => {
      expect(label(at(3, at(6)))).toBe('A B')
    })
  })

  it('shows near-ties of the 3rd zone too, up to 5', () => {
    const cluster = (i: number, score: number): [number, number, number, number] =>
      [41.37 + (i % 3) * 0.02, 2.15 + Math.floor(i / 3) * 0.035, 1, score]
    // Six equally good areas → 3 + 2 ties (cap 5).
    expect(findBestZones({ ...base, scores: grid([0, 1, 2, 3, 4, 5].map((i) => cluster(i, 80))) })).toHaveLength(5)
    // A clearly weaker 4th area stays hidden.
    expect(findBestZones({ ...base, scores: grid([cluster(0, 80), cluster(1, 80), cluster(2, 80), cluster(3, 50)]) })).toHaveLength(3)
  })

  it('only looks at cells inside the viewport', () => {
    const aroundB: Bounds = [B[1] - 0.01, B[0] - 0.01, B[1] + 0.01, B[0] + 0.01]
    const zones = findBestZones({ ...base, topPct: 20, bounds: aroundB, scores: grid([[...A, 2, 90], [...B, 1, 80]]) })
    expect(contains(zones[0], ...B)).toBe(true)
    expect(zones.some((z) => contains(z, ...A))).toBe(false)
  })

  it('only uses hexes fully inside the viewport, so a zone never just grazes its edge', () => {
    // Viewport edge cuts straight through cluster A's centre.
    const halfA: Bounds = [A[1], 41.2, 2.4, 41.6]
    const zones = findBestZones({ ...base, topPct: 20, bounds: halfA, scores: grid([[...A, 3, 90]]) })
    expect(zones.length).toBeGreaterThan(0)
    const BUFFER_SLACK = 0.001 // outward buffer: 0.0006° of arc ≈ 0.0008° of longitude at 41°N
    for (const [lng] of zones[0].coordinates[0]) expect(lng).toBeGreaterThanOrEqual(halfA[0] - BUFFER_SLACK)
  })

  it('only looks at cells inside the score range', () => {
    const zones = findBestZones({
      ...base, topPct: 50, scoreRange: [85, 100], scores: grid([[...A, 2, 90], [...B, 1, 80]]),
    })
    expect(contains(zones[0], ...A)).toBe(true)
    expect(zones.some((z) => contains(z, ...B))).toBe(false)
  })

  it('never puts a zone on a disallowed hex', () => {
    const scores = grid([[...A, 3, 90], [...B, 2, 80]])
    const allowed = allowedCells(null, [area(A, 3)])
    const cells = findZoneCells({ ...base, scores, allowed }).flat()
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.every(allowed!)).toBe(true)
    expect(cells).toContain(latLngToCell(B[0], B[1], RES)) // the next best area instead
  })

  it('stricter = smaller zone', () => {
    const scores = grid([[...A, 4, 60], [...A, 2, 90], [...A, 1, 95]])
    const loose = findBestZones({ ...base, topPct: 6, scores })[0]
    const strict = findBestZones({ ...base, topPct: 2, scores })[0]
    const span = (z: Polygon) => Math.max(...z.coordinates[0].map(([x]) => x)) - Math.min(...z.coordinates[0].map(([x]) => x))
    expect(span(strict)).toBeLessThan(span(loose))
  })

  it('returns simple closed hole-free rings that fit the Idealista URL budget', () => {
    const longBase = 'https://www.idealista.com/areas/venta-viviendas/' + 'x'.repeat(700)
    const zones = findBestZones({ ...base, baseUrl: longBase, scores: grid([[...A, 6, 90], [...B, 2, 80]]) })
    expect(zones.length).toBeGreaterThan(0)
    for (const z of zones) {
      expect(z.coordinates).toHaveLength(1)
      const ring = z.coordinates[0]
      expect(ring.length).toBeGreaterThanOrEqual(4)
      expect(ring[0]).toEqual(ring[ring.length - 1])
      expect(ring.length).toBeLessThanOrEqual(21) // MAX_VERTICES + closing point
      expect(buildIdealistaUrl(z, longBase).length).toBeLessThanOrEqual(900)
    }
  })
})
