import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { AreaFeature } from '../areas'
import type { BuildingArea } from '../buildings/buildingData'

// The areas of buildings-meta.json (barri code, INE code) and the polygons of areas.geojson (ids built from
// district + barri, or a slug) share no key. Instead of matching names, each area takes the polygon its own
// buildings stand in: a sample of its building centroids votes. Barris join barri polygons, municipalities join
// municipality polygons.

const KIND_OF: Record<BuildingArea['kind'], AreaFeature['properties']['kind']> = { barri: 'barri', muni: 'municipality' }

export function pointInFeature(lng: number, lat: number, f: AreaFeature): boolean {
  return booleanPointInPolygon([lng, lat], f)
}

/** Area index → the polygon its buildings stand in (areas with no match, or that lose a shared polygon, are left out). */
export function joinAreas(
  areas: readonly BuildingArea[],
  areaCol: Float32Array,
  lng: Float32Array,
  lat: Float32Array,
  features: readonly AreaFeature[],
  samplePerArea = 15,
): Map<number, AreaFeature> {
  const result = new Map<number, AreaFeature>()
  if (features.length === 0) return result

  const counts = new Uint32Array(areas.length)
  for (let i = 0; i < areaCol.length; i++) {
    const a = areaCol[i]
    if (a === a && a >= 0 && a < areas.length) counts[a]++
  }
  // Every `stride`-th building of an area is a voter: spread over the whole area, not just its first rows.
  const seen = new Uint32Array(areas.length)
  const voters: number[][] = areas.map(() => [])
  for (let i = 0; i < areaCol.length; i++) {
    const a = areaCol[i]
    if (!(a === a && a >= 0 && a < areas.length)) continue
    const stride = Math.max(1, Math.floor(counts[a] / samplePerArea))
    if (seen[a]++ % stride === 0 && voters[a].length < samplePerArea) voters[a].push(i)
  }

  const boxes = new Map(features.map((f) => [f, bbox(f)] as const))
  for (let a = 0; a < areas.length; a++) {
    const candidates = features.filter((f) => f.properties.kind === KIND_OF[areas[a].kind])
    const votes = new Map<AreaFeature, number>()
    for (const i of voters[a]) {
      for (const f of candidates) {
        const [w, s, e, n] = boxes.get(f)!
        if (lng[i] < w || lng[i] > e || lat[i] < s || lat[i] > n) continue
        if (pointInFeature(lng[i], lat[i], f)) votes.set(f, (votes.get(f) ?? 0) + 1)
      }
    }
    let best: AreaFeature | null = null
    let bestVotes = 0
    for (const [f, v] of votes) if (v > bestVotes) { best = f; bestVotes = v }
    if (best) result.set(a, best)
  }
  // A polygon belongs to one area. Stray buildings of another area (e.g. a handful assigned to Barcelona that stand
  // in l'Hospitalet) would otherwise draw a second, overlapping copy of it; the area with more buildings keeps it.
  const owner = new Map<AreaFeature, number>()
  for (const [a, f] of result) {
    const current = owner.get(f)
    if (current === undefined || counts[a] > counts[current]) owner.set(f, a)
  }
  for (const [a, f] of [...result]) if (owner.get(f) !== a) result.delete(a)
  return result
}
