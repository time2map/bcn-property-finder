import { area } from '@turf/area'
import buffer from '@turf/buffer'
import { intersect } from '@turf/intersect'
import { simplify } from '@turf/simplify'
import { union } from '@turf/union'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { buildIdealistaUrl } from './idealista'
import type { AreaFeature } from './areas'

// Idealista's `shape` accepts a single hole-free polygon per search. The effective area
// (isochrone − exclusions) is a MultiPolygon possibly with holes, so we decompose it into a
// small set of simple hole-free polygons — one Idealista link each — covering all of it.

// Cap on the number of links. Sorted by area, so the biggest pieces (main area + the largest
// islands) are always kept; only the tiniest tail is dropped.
const MAX_AREAS = Number(import.meta.env.VITE_IDEALISTA_MAX_AREAS ?? 16)
// After unioning barri clips, expand by this amount (degrees) then shrink back. This fills gaps
// (alleys, precision seams) between adjacent barris and attaches nearby island pieces to the
// main polygon. ~0.0005° ≈ 55 m — covers Barcelona streets; 0 to disable.
const MERGE_GAP_DEG = Number(import.meta.env.VITE_IDEALISTA_MERGE_GAP_DEG ?? 0.0005)
// After the buffer pass, drop any sub-polygon whose bounding box minimum dimension is smaller than
// this (degrees). Thin slivers at the isochrone boundary that weren't absorbed by the buffer
// (because they're isolated) are removed. ~0.0003° ≈ 33 m. 0 to disable.
const MIN_BBOX_DIM_DEG = Number(import.meta.env.VITE_IDEALISTA_MIN_BBOX_DIM_DEG ?? 0.0003)
// Absolute floor: pieces smaller than this are negligible slivers. Deliberately small so that
// real reachable islands (a few hundred metres across) survive — a *relative* threshold would
// wrongly delete every island whenever there is one large main area.
const MIN_AREA_KM2 = Number(import.meta.env.VITE_IDEALISTA_MIN_AREA_KM2 ?? 0.05)
// Optional relative floor (off by default — see above). Kept as a knob, not used for islands.
const AREA_RATIO = Number(import.meta.env.VITE_IDEALISTA_AREA_RATIO ?? 0)
// Only holes at least this big are honoured by cutting the area open around them (exclusion
// zones). Smaller holes are unreachable natural pockets — filling them is harmless and avoids
// exploding one sub-polygon into many strips.
const HOLE_MIN_KM2 = Number(import.meta.env.VITE_IDEALISTA_HOLE_MIN_KM2 ?? 0.1)
const SIMPLIFY_TOL = Number(import.meta.env.VITE_IDEALISTA_SIMPLIFY_TOL ?? 0.0004)
// Idealista 400s on over-long shapes. Probed: ~600 chars works, ~1800 fails. Keep each piece's
// search URL comfortably under the known-good bound; a bbox fallback guarantees a fit.
const MAX_URL_CHARS = Number(import.meta.env.VITE_IDEALISTA_MAX_URL_CHARS ?? 900)
const MAX_SIMPLIFY_STEPS = 12

type Poly = Polygon | MultiPolygon
type Rings = Polygon['coordinates']

function polyFeature(coordinates: Rings): Feature<Polygon> {
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }
}

function collection(features: Feature<Polygon>[]): FeatureCollection<Polygon> {
  return { type: 'FeatureCollection', features }
}

/** Sub-polygons of a geometry as arrays of rings ([outer, ...holes]). */
function subPolygons(geometry: Poly): Rings[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function xExtent(ring: number[][]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const [x] of ring) {
    if (x < min) min = x
    if (x > max) max = x
  }
  return [min, max]
}

function yExtent(ring: number[][]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const [, y] of ring) {
    if (y < min) min = y
    if (y > max) max = y
  }
  return [min, max]
}

function rect(minX: number, minY: number, maxX: number, maxY: number): Polygon {
  return { type: 'Polygon', coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]] }
}

function ringKm2(ring: number[][]): number {
  return area(polyFeature([ring])) / 1e6
}

/**
 * Turns one sub-polygon (outer + holes) into simple hole-free polygons.
 *
 * Only *significant* holes (≥ HOLE_MIN_KM2 — i.e. exclusion zones) are honoured: the polygon is
 * cut into vertical strips split at each such hole's mid-x, so a boolean intersect with each
 * strip opens those holes into the boundary (no enclosed ring). Tiny natural holes are left to be
 * filled — covering an unreachable pocket is harmless and keeps the piece count low.
 *
 * Robustness: if a strip's intersect fails, fall back to clipping the hole-free outer ring so the
 * strip is still covered (never silently drop area).
 */
function cutHoles(rings: Rings): Polygon[] {
  const outer = rings[0]
  const holes = rings.slice(1).filter((h) => ringKm2(h) >= HOLE_MIN_KM2)
  if (holes.length === 0) return [{ type: 'Polygon', coordinates: [outer] }]

  const [minX, maxX] = xExtent(outer)
  const [minY, maxY] = yExtent(outer)

  // Cut lines at each significant hole's mid-x (strictly inside its x-extent → straddles it).
  const cutXs = [...new Set(holes.map((h) => {
    const [hMin, hMax] = xExtent(h)
    return (hMin + hMax) / 2
  }))].filter((x) => x > minX && x < maxX).sort((a, b) => a - b)

  const bounds = [minX, ...cutXs, maxX]
  const source = polyFeature([outer, ...holes])
  const outerOnly = polyFeature([outer])
  const pieces: Polygon[] = []

  for (let i = 0; i < bounds.length - 1; i++) {
    const strip = rect(bounds[i], minY, bounds[i + 1], maxY)
    // Prefer the holed clip (honours exclusions); fall back to the hole-free clip so the strip is
    // never lost to an intersect failure (covers a little extra rather than leaving a gap).
    const clipped =
      intersect(collection([source, polyFeature(strip.coordinates)])) ??
      intersect(collection([outerOnly, polyFeature(strip.coordinates)]))
    if (!clipped) continue
    for (const sub of subPolygons(clipped.geometry)) {
      // Outer ring only — after cutting it carries the hole as a boundary concavity; any small
      // residual hole is filled (documented fallback).
      pieces.push({ type: 'Polygon', coordinates: [sub[0]] })
    }
  }
  // Safety net: if cutting yielded nothing, cover the whole sub-polygon (hole-free).
  return pieces.length > 0 ? pieces : [{ type: 'Polygon', coordinates: [outer] }]
}

function simplifyPolygon(polygon: Polygon, tolerance: number): Polygon {
  const simplified = simplify(polyFeature(polygon.coordinates), {
    tolerance,
    highQuality: false,
  })
  const ring = simplified.geometry.coordinates[0]
  // Keep the original if simplification collapsed the ring.
  return ring && ring.length >= 4 ? (simplified.geometry as Polygon) : polygon
}

/**
 * Simplifies a piece just enough that its Idealista search URL fits the length budget.
 * Doubling the tolerance reduces vertices; if even that can't fit (pathological pieces), fall
 * back to the piece's bounding box — a 4-point shape that always fits and still covers the piece.
 */
// baseUrl is passed so the URL-length check accounts for the user's (potentially longer)
// filter base URL instead of the default template.
function fitToUrlBudget(polygon: Polygon, baseUrl?: string | null): Polygon {
  let tolerance = SIMPLIFY_TOL
  let result = simplifyPolygon(polygon, tolerance)
  for (let i = 0; i < MAX_SIMPLIFY_STEPS && buildIdealistaUrl(result, baseUrl).length > MAX_URL_CHARS; i++) {
    tolerance *= 2
    // Always simplify from the original to avoid compounding distortion.
    result = simplifyPolygon(polygon, tolerance)
  }
  if (buildIdealistaUrl(result, baseUrl).length > MAX_URL_CHARS) {
    const [minX, maxX] = xExtent(polygon.coordinates[0])
    const [minY, maxY] = yExtent(polygon.coordinates[0])
    return rect(minX, minY, maxX, maxY)
  }
  return result
}

function areaKm2(polygon: Polygon): number {
  return area(polygon) / 1e6
}

/**
 * Returns true if the polygon is a thin sliver — its bounding box's smallest dimension is below
 * minDimDeg. Slivers form when the isochrone boundary clips through a barri at a shallow angle;
 * they look like artifacts on the map but are technically valid polygons above the area floor.
 */
function isThinSliver(polygon: Polygon, minDimDeg: number): boolean {
  if (minDimDeg <= 0) return false
  const ring = polygon.coordinates[0]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return Math.min(maxX - minX, maxY - minY) < minDimDeg
}

/**
 * Decomposes the effective area into simple, hole-free polygons suitable for Idealista:
 * cuts significant holes, simplifies to fit the URL budget, drops negligible slivers, sorts by
 * area, caps the count (biggest first, so the main area and the largest islands are always kept).
 */
export function decomposeForIdealista(geometry: Poly | null, baseUrl?: string | null): Polygon[] {
  if (!geometry) return []

  const raw: Polygon[] = []
  for (const rings of subPolygons(geometry)) raw.push(...cutHoles(rings))

  const pieces = raw
    .map((p) => fitToUrlBudget(p, baseUrl))
    .map((p) => ({ polygon: p, km2: areaKm2(p) }))
    .filter((p) => p.km2 > 0)

  if (pieces.length === 0) return []

  const maxKm2 = Math.max(...pieces.map((p) => p.km2))
  const threshold = Math.max(MIN_AREA_KM2, AREA_RATIO * maxKm2)

  let kept = pieces.filter((p) => p.km2 >= threshold)
  if (kept.length === 0) kept = [pieces.reduce((a, b) => (b.km2 > a.km2 ? b : a))]

  return kept
    .sort((a, b) => b.km2 - a.km2)
    .slice(0, MAX_AREAS)
    .map((p) => p.polygon)
}

/**
 * Decomposes the effective area into Idealista-ready polygons using real barri/municipality
 * boundaries from areas.geojson as the basis.
 *
 * Pipeline:
 * 1. Intersect each barri/municipality polygon with the effective area
 *    → clips are land-only (no barri covers open sea, fixing water artefacts)
 * 2. Drop clips below MIN_AREA_KM2 (barris that barely touch the isochrone edge)
 * 3. Union all clips → adjacent barris merge; small simplification gaps fill automatically
 * 4. For each connected component: cutHoles() + fitToUrlBudget() (same as decomposeForIdealista)
 * 5. Filter, sort by area DESC, cap at MAX_AREAS
 *
 * Falls back to decomposeForIdealista() when areas is empty, none match, or geometry is null.
 */
export function decomposeByBarris(geometry: Poly | null, areas: AreaFeature[], baseUrl?: string | null): Polygon[] {
  if (!geometry) return []

  const candidates = areas.filter(
    (a) => a.properties.kind === 'barri' || a.properties.kind === 'municipality',
  )
  if (candidates.length === 0) return decomposeForIdealista(geometry, baseUrl)

  const effectiveFeat: Feature<Poly> = { type: 'Feature', properties: {}, geometry }

  // Step 1+2: intersect each candidate with the effective area; drop tiny slivers
  const clips: Feature<Poly>[] = []
  for (const cand of candidates) {
    const clip = intersect(collection([cand as Feature<Poly>, effectiveFeat]))
    if (!clip) continue
    if (area(clip) / 1e6 < MIN_AREA_KM2) continue
    clips.push(clip as Feature<Poly>)
  }

  if (clips.length === 0) return decomposeForIdealista(geometry, baseUrl)

  // Step 3: union all clips — adjacent barris merge; small gaps fill automatically
  let merged = clips.reduce<Feature<Poly> | null>(
    (acc, clip) => (acc ? (union(collection([acc, clip])) ?? acc) : clip),
    null,
  )
  if (!merged) return decomposeForIdealista(geometry, baseUrl)

  // Step 3b: fill tiny gaps between neighbouring barris and attach nearby islands.
  // Expand by MERGE_GAP_DEG (≈ 20 m) then shrink back — alleys/precision seams close up and
  // island pieces within that distance snap onto the main body.
  if (MERGE_GAP_DEG > 0) {
    try {
      const expanded = buffer(merged, MERGE_GAP_DEG, { units: 'degrees' })
      if (expanded) {
        const shrunk = buffer(expanded, -MERGE_GAP_DEG, { units: 'degrees' })
        if (shrunk) merged = shrunk as Feature<Poly>
      }
    } catch {
      // buffer can fail on degenerate geometries — keep the original merged result
    }
  }

  // Step 4: extract connected components, outer ring only.
  // Clips were already intersected against effectiveArea (exclusions already subtracted), so no
  // significant holes remain. Any tiny fp-artefact holes are discarded by taking outer ring only.
  // This avoids the vertical-strip artefacts that cutHoles() would produce.
  // Thin slivers (bounding box min-dimension < MIN_BBOX_DIM_DEG) are dropped here — they are
  // isochrone-boundary artefacts that weren't absorbed by the buffer pass because they're isolated.
  const raw: Polygon[] = []
  for (const rings of subPolygons(merged.geometry)) {
    const poly: Polygon = { type: 'Polygon', coordinates: [rings[0]] }
    if (!isThinSliver(poly, MIN_BBOX_DIM_DEG)) raw.push(poly)
  }

  const pieces = raw
    .map((p) => fitToUrlBudget(p, baseUrl))
    .map((p) => ({ polygon: p, km2: areaKm2(p) }))
    .filter((p) => p.km2 > 0)

  if (pieces.length === 0) return decomposeForIdealista(geometry, baseUrl)

  const maxKm2 = Math.max(...pieces.map((p) => p.km2))
  const threshold = Math.max(MIN_AREA_KM2, AREA_RATIO * maxKm2)
  let kept = pieces.filter((p) => p.km2 >= threshold)
  if (kept.length === 0) kept = [pieces.reduce((a, b) => (b.km2 > a.km2 ? b : a))]

  return kept
    .sort((a, b) => b.km2 - a.km2)
    .slice(0, MAX_AREAS)
    .map((p) => p.polygon)
}

/** One single-ring Idealista URL per decomposed simple polygon. */
export function buildIdealistaUrls(geometry: Poly | null): string[] {
  return decomposeForIdealista(geometry).map((p) => buildIdealistaUrl(p))
}
