import { describe, it, expect } from 'vitest'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { MultiPolygon, Polygon } from 'geojson'
import { decomposeForIdealista, buildIdealistaUrls, decomposeByBarris } from './idealistaAreas'
import type { AreaFeature } from './areas'

// ~0.1° square near Barcelona ≈ 100+ km² — comfortably above the area threshold.
const BIG: Polygon = {
  type: 'Polygon',
  coordinates: [[[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.1], [2.0, 41.0]]],
}

// Tiny sliver ≈ 0.04 km² — below threshold.
const SLIVER_RINGS = [[2.5, 41.5], [2.502, 41.5], [2.502, 41.502], [2.5, 41.502], [2.5, 41.5]]

function ringGroups(url: string): number {
  const shape = decodeURIComponent(url.split('shape=')[1])
  return (shape.match(/\(/g)!.length) - 1
}

describe('decomposeForIdealista', () => {
  it('returns [] for null', () => {
    expect(decomposeForIdealista(null)).toEqual([])
  })

  it('returns a simple polygon unchanged (single piece)', () => {
    const result = decomposeForIdealista(BIG)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('Polygon')
    expect(result[0].coordinates).toHaveLength(1) // hole-free
  })

  it('filters insignificant slivers from a MultiPolygon', () => {
    const mp: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [BIG.coordinates, [SLIVER_RINGS]],
    }
    const result = decomposeForIdealista(mp)
    expect(result).toHaveLength(1) // sliver dropped
  })

  it('keeps a piece that touches the boundary as one simple polygon (no hole)', () => {
    // Outer ring with a concavity (exclusion clipped the edge) — no interior ring.
    const dented: Polygon = {
      type: 'Polygon',
      coordinates: [[
        [2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.05, 41.1],
        [2.05, 41.05], [2.0, 41.05], [2.0, 41.0],
      ]],
    }
    const result = decomposeForIdealista(dented)
    expect(result).toHaveLength(1)
    expect(result[0].coordinates).toHaveLength(1)
  })

  it('cuts an interior hole into hole-free pieces that exclude the hole', () => {
    const holed: Polygon = {
      type: 'Polygon',
      coordinates: [
        [[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.1], [2.0, 41.0]], // outer
        [[2.04, 41.04], [2.06, 41.04], [2.06, 41.06], [2.04, 41.06], [2.04, 41.04]], // hole
      ],
    }
    const pieces = decomposeForIdealista(holed)

    // every piece is hole-free
    for (const p of pieces) expect(p.coordinates).toHaveLength(1)

    // a point inside the hole is covered by NO piece
    const inHole: [number, number] = [2.045, 41.05]
    expect(pieces.some((p) => booleanPointInPolygon(inHole, p))).toBe(false)

    // a point in the kept area IS covered by some piece
    const kept: [number, number] = [2.01, 41.01]
    expect(pieces.some((p) => booleanPointInPolygon(kept, p))).toBe(true)
  })

  it('caps the number of areas', () => {
    // 20 separate big blobs; default cap is 16.
    const coords = Array.from({ length: 20 }, (_, i) => {
      const x = 2.0 + i * 0.5
      return [[[x, 41.0], [x + 0.1, 41.0], [x + 0.1, 41.1], [x, 41.1], [x, 41.0]]]
    })
    const mp: MultiPolygon = { type: 'MultiPolygon', coordinates: coords }
    expect(decomposeForIdealista(mp).length).toBeLessThanOrEqual(16)
  })

  it('keeps small islands alongside a large main area', () => {
    // A big main area + two small (but non-negligible, > 0.05 km²) islands. A *relative* area
    // threshold would wrongly delete the islands; an absolute floor keeps them (the bug where
    // "all separate islands" were dropped).
    const island = (x: number, y: number): number[][][] => [[
      [x, y], [x + 0.004, y], [x + 0.004, y + 0.004], [x, y + 0.004], [x, y],
    ]] // ~0.16 km²
    const mp: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [BIG.coordinates, island(2.5, 41.5), island(2.6, 41.6)],
    }
    const result = decomposeForIdealista(mp)
    expect(result).toHaveLength(3)
    // each island is covered by exactly one piece
    expect(result.some((p) => booleanPointInPolygon([2.502, 41.502], p))).toBe(true)
    expect(result.some((p) => booleanPointInPolygon([2.602, 41.602], p))).toBe(true)
  })

  it('honours a big hole but fills tiny holes (few pieces, full coverage)', () => {
    // One big exclusion-sized hole + a couple of tiny natural pockets in a large outer.
    const holed: Polygon = {
      type: 'Polygon',
      coordinates: [
        [[2.0, 41.0], [2.2, 41.0], [2.2, 41.2], [2.0, 41.2], [2.0, 41.0]], // big outer
        [[2.08, 41.08], [2.12, 41.08], [2.12, 41.12], [2.08, 41.12], [2.08, 41.08]], // big hole (~12 km²)
        [[2.16, 41.16], [2.161, 41.16], [2.161, 41.161], [2.16, 41.161], [2.16, 41.16]], // tiny hole
      ],
    }
    const pieces = decomposeForIdealista(holed)

    for (const p of pieces) expect(p.coordinates).toHaveLength(1) // all hole-free
    // big hole's centre is covered by NO piece (exclusion honoured)
    expect(pieces.some((p) => booleanPointInPolygon([2.1, 41.1], p))).toBe(false)
    // tiny hole is filled — its centre IS covered (harmless, keeps piece count low)
    expect(pieces.some((p) => booleanPointInPolygon([2.1605, 41.1605], p))).toBe(true)
    // kept area is covered, and only a handful of pieces (not one-per-hole explosion)
    expect(pieces.some((p) => booleanPointInPolygon([2.01, 41.01], p))).toBe(true)
    expect(pieces.length).toBeLessThanOrEqual(3)
  })
})

// A large, very crinkly ring (many vertices) — without adaptive simplification its
// encoded shape would blow past Idealista's URL-length limit (the cause of the 400s).
function crinklyBig(): Polygon {
  const ring: number[][] = []
  const cx = 2.05
  const cy = 41.05
  const n = 400
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    const r = 0.05 + 0.012 * Math.sin(t * 23) // high-frequency wobble = many distinct vertices
    ring.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  ring[ring.length - 1] = ring[0] // close
  return { type: 'Polygon', coordinates: [ring] }
}

describe('URL-length budget', () => {
  it('simplifies each piece so its Idealista URL stays within the length budget', () => {
    const urls = buildIdealistaUrls(crinklyBig())
    expect(urls).toHaveLength(1)
    // Default VITE_IDEALISTA_MAX_URL_CHARS is 900 — comfortably under the ~1800 that 400s.
    expect(urls[0].length).toBeLessThanOrEqual(900)
  })
})

// --- helpers for decomposeByBarris tests ---

function makeBarri(
  id: string,
  parentId: string,
  coordinates: number[][][],
): AreaFeature {
  return {
    type: 'Feature',
    properties: { id, name: id, kind: 'barri', parent: parentId },
    geometry: { type: 'Polygon', coordinates },
  }
}

function makeMuni(id: string, coordinates: number[][][]): AreaFeature {
  return {
    type: 'Feature',
    properties: { id, name: id, kind: 'municipality' },
    geometry: { type: 'Polygon', coordinates },
  }
}

// Barri A: left half of BIG
const BARRI_A_RINGS = [[[2.0, 41.0], [2.05, 41.0], [2.05, 41.1], [2.0, 41.1], [2.0, 41.0]]]
// Barri B: right half of BIG (adjacent to A)
const BARRI_B_RINGS = [[[2.05, 41.0], [2.1, 41.0], [2.1, 41.1], [2.05, 41.1], [2.05, 41.0]]]
// Barri C: entirely outside BIG (no intersection)
const BARRI_C_RINGS = [[[3.0, 42.0], [3.1, 42.0], [3.1, 42.1], [3.0, 42.1], [3.0, 42.0]]]
// Tiny barri: barely touches BIG — area ~0.04 km², below MIN_AREA_KM2
const TINY_RINGS = [[[2.0, 41.0], [2.002, 41.0], [2.002, 41.002], [2.0, 41.002], [2.0, 41.0]]]

describe('decomposeByBarris', () => {
  it('returns [] for null geometry', () => {
    expect(decomposeByBarris(null, [makeBarri('a', 'p', BARRI_A_RINGS)])).toEqual([])
  })

  it('falls back to decomposeForIdealista when no areas provided', () => {
    const geo = decomposeByBarris(BIG, [])
    const fallback = decomposeForIdealista(BIG)
    expect(geo).toHaveLength(fallback.length)
  })

  it('falls back to decomposeForIdealista when no barris intersect the geometry', () => {
    const geo = decomposeByBarris(BIG, [makeBarri('c', 'p', BARRI_C_RINGS)])
    const fallback = decomposeForIdealista(BIG)
    expect(geo).toHaveLength(fallback.length)
  })

  it('clips a barri to the effective area (partial intersection)', () => {
    // effective area = left half only; BARRI_B spans the right half + some overlap
    const leftHalf: Polygon = {
      type: 'Polygon',
      coordinates: [[[2.0, 41.0], [2.06, 41.0], [2.06, 41.1], [2.0, 41.1], [2.0, 41.0]]],
    }
    const result = decomposeByBarris(leftHalf, [makeBarri('b', 'p', BARRI_B_RINGS)])
    expect(result).toHaveLength(1)
    // The result should NOT include points to the right of 2.06
    expect(booleanPointInPolygon([2.09, 41.05], result[0])).toBe(false)
  })

  it('merges two adjacent barris into a single zone', () => {
    const result = decomposeByBarris(BIG, [
      makeBarri('a', 'p', BARRI_A_RINGS),
      makeBarri('b', 'p', BARRI_B_RINGS),
    ])
    // The two halves should merge into one combined polygon covering BIG
    expect(result).toHaveLength(1)
    expect(booleanPointInPolygon([2.025, 41.05], result[0])).toBe(true) // left half
    expect(booleanPointInPolygon([2.075, 41.05], result[0])).toBe(true) // right half
  })

  it('drops barri clips below MIN_AREA_KM2', () => {
    const result = decomposeByBarris(BIG, [
      makeBarri('a', 'p', BARRI_A_RINGS),
      makeBarri('tiny', 'p', TINY_RINGS),
    ])
    // tiny barri clip is below threshold → only BARRI_A survives
    expect(result).toHaveLength(1)
    // BARRI_A left-half point is covered
    expect(booleanPointInPolygon([2.025, 41.05], result[0])).toBe(true)
  })

  it('ignores district-kind features (only barri and municipality are used)', () => {
    const district: AreaFeature = {
      type: 'Feature',
      properties: { id: 'd1', name: 'District', kind: 'district' },
      geometry: { type: 'Polygon', coordinates: BARRI_A_RINGS },
    }
    const result = decomposeByBarris(BIG, [district])
    // district ignored → no candidates → fallback
    const fallback = decomposeForIdealista(BIG)
    expect(result).toHaveLength(fallback.length)
  })

  it('municipality kind is treated like a barri and intersected', () => {
    const muni = makeMuni('muni-test', BARRI_A_RINGS)
    const result = decomposeByBarris(BIG, [muni])
    expect(result).toHaveLength(1)
    expect(booleanPointInPolygon([2.025, 41.05], result[0])).toBe(true)
  })

  it('produces hole-free polygons when the merged union has holes', () => {
    // effective area with a big hole (exclusion zone cuts through barri B)
    const holed: Polygon = {
      type: 'Polygon',
      coordinates: [
        [[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.1], [2.0, 41.0]],
        [[2.06, 41.04], [2.09, 41.04], [2.09, 41.06], [2.06, 41.06], [2.06, 41.04]], // hole in barri B
      ],
    }
    const result = decomposeByBarris(holed, [
      makeBarri('a', 'p', BARRI_A_RINGS),
      makeBarri('b', 'p', BARRI_B_RINGS),
    ])
    // all output polygons must be hole-free (outer ring only)
    for (const p of result) expect(p.coordinates).toHaveLength(1)
    // no vertical strips — all pieces are "rectangular" shaped without intra-polygon cuts
    expect(result.length).toBeLessThanOrEqual(3)
    // kept area (left half, not affected by hole) is covered
    expect(result.some((p) => booleanPointInPolygon([2.025, 41.05], p))).toBe(true)
  })
})

describe('buildIdealistaUrls', () => {
  it('returns one single-ring URL per decomposed polygon', () => {
    const mp: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        BIG.coordinates,
        [[[2.5, 41.5], [2.6, 41.5], [2.6, 41.6], [2.5, 41.6], [2.5, 41.5]]],
      ],
    }
    const urls = buildIdealistaUrls(mp)
    expect(urls).toHaveLength(2)
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/www\.idealista\.com\/areas\/venta-viviendas\/mapa-google\?shape=/)
      expect(ringGroups(url)).toBe(1) // each is a single simple polygon
    }
  })

  it('returns [] when there is no geometry', () => {
    expect(buildIdealistaUrls(null)).toEqual([])
  })
})
