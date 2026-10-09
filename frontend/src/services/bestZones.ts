import { cellsToMultiPolygon, cellToBoundary, gridDisk } from 'h3-js'
import buffer from '@turf/buffer'
import { simplify } from '@turf/simplify'
import type { Feature, Polygon } from 'geojson'
import { buildIdealistaUrl } from './idealista'

// Feature 038: up to MAX_ZONES compact zones of the best-scoring hexes in the viewport, each simple
// enough for one Idealista `shape=` search (single hole-free ring, short URL).

export type Bounds = [west: number, south: number, east: number, north: number]

export const DEFAULT_TOP_PCT = Number(import.meta.env.VITE_BEST_ZONES_TOP_PCT ?? 15)
const MAX_ZONES = Number(import.meta.env.VITE_BEST_ZONES_MAX ?? 3)
// Near-ties of the last zone are shown too (mass ≥ TIE_RATIO × its mass), up to MAX_WITH_TIES —
// so an equally good area isn't hidden behind an arbitrary cut-off.
const TIE_RATIO = Number(import.meta.env.VITE_BEST_ZONES_TIE_RATIO ?? 0.9)
const MAX_WITH_TIES = Number(import.meta.env.VITE_BEST_ZONES_MAX_WITH_TIES ?? 5)
// Smaller components have too few listings to be worth a search (~0.1 km² per res-9 hex).
const MIN_CELLS = Number(import.meta.env.VITE_BEST_ZONES_MIN_CELLS ?? 5)
// Outward buffer (~55 m) before simplifying, so the simplified ring rides over the hex zig-zag
// instead of cutting into cells.
const BUFFER_DEG = Number(import.meta.env.VITE_BEST_ZONES_BUFFER_DEG ?? 0.0006)
// ~100 m — starting tolerance; removes the hex zig-zag (amplitude ~90 m at res 9).
const SIMPLIFY_TOL = Number(import.meta.env.VITE_BEST_ZONES_SIMPLIFY_TOL ?? 0.001)
// Hard cap on ring vertices — keeps zones visibly simple even when big (tolerance grows until met).
const MAX_VERTICES = Number(import.meta.env.VITE_BEST_ZONES_MAX_VERTICES ?? 20)
// Idealista 400s on over-long shapes (probed: ~600 chars works, ~1800 fails).
const MAX_URL_CHARS = Number(import.meta.env.VITE_IDEALISTA_MAX_URL_CHARS ?? 900)
const MAX_SIMPLIFY_STEPS = 12

/** Mean score over each cell and its 6 neighbours (known cells only) — kills salt-and-pepper. */
export function smoothScores(scores: Map<string, number>): Map<string, number> {
  const smooth = new Map<string, number>()
  for (const h of scores.keys()) {
    let sum = 0
    let n = 0
    for (const nb of gridDisk(h, 1)) {
      const v = scores.get(nb)
      if (v != null) { sum += v; n++ }
    }
    smooth.set(h, sum / n)
  }
  return smooth
}

/** Whole hex inside the viewport — so zones sit inside the view instead of grazing its edge. */
function inBounds(h3: string, [w, s, e, n]: Bounds): boolean {
  return cellToBoundary(h3).every(([lat, lng]) => lng >= w && lng <= e && lat >= s && lat <= n)
}

/** Connected components of a cell set (H3 adjacency). */
function components(cells: Set<string>): string[][] {
  const seen = new Set<string>()
  const result: string[][] = []
  for (const start of cells) {
    if (seen.has(start)) continue
    seen.add(start)
    const stack = [start]
    const comp: string[] = []
    while (stack.length) {
      const c = stack.pop()!
      comp.push(c)
      for (const nb of gridDisk(c, 1)) {
        if (cells.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb) }
      }
    }
    result.push(comp)
  }
  return result
}

const ringPolygon = (ring: number[][]): Polygon => ({ type: 'Polygon', coordinates: [ring] })
const feature = (geometry: Polygon): Feature<Polygon> => ({ type: 'Feature', properties: {}, geometry })

function bbox(ring: number[][]): Polygon {
  const xs = ring.map(([x]) => x)
  const ys = ring.map(([, y]) => y)
  const [w, e, s, n] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return ringPolygon([[w, s], [e, s], [e, n], [w, n], [w, s]])
}

/** Hex outline → smooth, simple, hole-free ring (≤ MAX_VERTICES) whose search URL fits the budget. */
export function zoneOutline(cells: string[], baseUrl?: string | null): Polygon {
  // One connected component → one part; its outer ring only (Idealista ignores holes).
  const outer = ringPolygon(cellsToMultiPolygon(cells, true)[0][0])
  let shape = outer
  try {
    const grown = buffer(feature(outer), BUFFER_DEG, { units: 'degrees' })?.geometry
    if (grown?.type === 'Polygon') shape = ringPolygon(grown.coordinates[0])
  } catch { /* degenerate geometry — simplify the raw outline */ }

  for (let i = 0, tol = SIMPLIFY_TOL; i < MAX_SIMPLIFY_STEPS; i++, tol *= 1.5) {
    const ring = simplify(feature(shape), { tolerance: tol, highQuality: true }).geometry.coordinates[0]
    if (ring.length < 4) break
    const result = ringPolygon(ring)
    // Closed ring repeats its first point, hence +1.
    if (ring.length <= MAX_VERTICES + 1 && buildIdealistaUrl(result, baseUrl).length <= MAX_URL_CHARS) return result
  }
  return bbox(shape.coordinates[0])
}

export interface BestZonesInput {
  /** Final composite score per H3 cell. */
  scores: Map<string, number>
  bounds: Bounds
  /** Only cells inside the Livability score-range filter count (= what the user sees). */
  scoreRange: [number, number]
  /** Strictness: zones spread over the top `topPct`% of visible cells (small ones grow to MIN_CELLS). */
  topPct: number
  /** Saved Idealista filter URL — the URL budget is checked against it. */
  baseUrl?: string | null
  /**
   * Zones (hex sets) shown before a strictness-only change. They keep their place and number,
   * only narrowing/widening inside their own area — so moving the slider doesn't make zones jump.
   */
  sticky?: string[][]
}

/**
 * Grows a zone to MIN_CELLS by adding free neighbouring hexes — a strict core of 2 hexes (or a
 * single seed) becomes a usable zone instead of being dropped. Prefers the neighbour touching the
 * most zone hexes (compact blob, not a strip along a good street), then the better score.
 */
export function growZone(core: string[], free: (h: string) => boolean, score: (h: string) => number): string[] {
  const zone = new Set(core)
  const touching = (h: string) => gridDisk(h, 1).filter((nb) => zone.has(nb)).length
  while (zone.size < MIN_CELLS) {
    let best: string | null = null
    let bestKey = [-1, -Infinity]
    for (const h of zone) {
      for (const nb of gridDisk(h, 1)) {
        if (zone.has(nb) || !free(nb)) continue
        const key = [touching(nb), score(nb)]
        if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) { best = nb; bestKey = key }
      }
    }
    if (best === null) break
    zone.add(best)
  }
  return [...zone]
}

/** Hexes of the best zones in the viewport, best first. Algorithm: docs/features/038-best-zones.md. */
export function findZoneCells({ scores, bounds, scoreRange, topPct, sticky = [] }: BestZonesInput): string[][] {
  const smooth = smoothScores(scores)
  const score = (h: string) => smooth.get(h)!
  const [min, max] = scoreRange
  const candidates = new Set([...scores].filter(([h, s]) => s >= min && s <= max && inBounds(h, bounds)).map(([h]) => h))
  if (candidates.size === 0) return []

  const sorted = [...candidates].map(score).sort((a, b) => a - b)
  const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - topPct / 100)))]
  const mass = (cells: string[]) => cells.reduce((sum, h) => sum + score(h) - threshold, 0)

  // One zone per separate good area at this strictness: connected hexes at/above the threshold,
  // most mass first. Looser → areas merge into fewer, bigger zones; stricter → they split into peaks.
  const cores = components(new Set([...candidates].filter((h) => score(h) >= threshold)))
    .sort((a, b) => mass(b) - mass(a))

  const zones: string[][] = []
  const masses: number[] = []
  const used = new Set<string[]>()
  const taken = new Set<string>() // zone hexes + a one-hex gap around them, so zones never touch
  const free = (h: string) => candidates.has(h) && !taken.has(h)
  const add = (core: string[]) => {
    if (used.has(core) || !core.every(free)) return
    const zone = growZone(core, free, score)
    if (zone.length < MIN_CELLS) return
    used.add(core)
    zones.push(zone)
    masses.push(mass(core))
    for (const h of zone) for (const nb of gridDisk(h, 1)) taken.add(nb)
  }
  // 1. Previously shown zones stay put: each becomes the best core inside it. It disappears when
  //    nothing in it passes the threshold, and merges away when an earlier zone took its core.
  for (const prev of sticky) {
    const inPrev = new Set(prev)
    const core = cores.find((c) => !used.has(c) && c.some((h) => inPrev.has(h)))
    if (core) add(core)
  }
  // 2. Fill up to MAX_ZONES with the best other areas, then near-ties of the last one.
  for (const core of cores) {
    if (zones.length >= MAX_WITH_TIES) break
    if (zones.length >= MAX_ZONES && mass(core) < TIE_RATIO * masses[MAX_ZONES - 1]) break
    add(core)
  }
  // 3. Never leave the user with nothing (e.g. every core boxed in at the view's edge): seed from
  //    the best hexes until one zone fits.
  for (const h of [...candidates].sort((a, b) => score(b) - score(a))) if (zones.length === 0) add([h])
  return zones
}

/** Best zones in the viewport as polygons, best first. */
export function findBestZones(input: BestZonesInput): Polygon[] {
  return findZoneCells(input).map((cells) => zoneOutline(cells, input.baseUrl))
}
