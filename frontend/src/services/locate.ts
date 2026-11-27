/** "Locate me" and touch taps (TODO-062): which home is where the person is, or where the finger landed. */
export interface Positions { lng: Float32Array; lat: Float32Array }

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG = 111_320

/** Metres between two points close to each other (flat-earth approximation, fine below a few km). */
export function metresBetween(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dx = (lng1 - lng2) * M_PER_DEG_LNG * Math.cos((lat1 * Math.PI) / 180)
  const dy = (lat1 - lat2) * M_PER_DEG_LAT
  return Math.hypot(dx, dy)
}

/** The row of the home nearest to the point, if it is within `maxM` metres; null otherwise. */
export function nearestBuilding(lng: number, lat: number, cols: Positions, maxM: number): number | null {
  const dLat = maxM / M_PER_DEG_LAT
  const dLng = maxM / (M_PER_DEG_LNG * Math.cos((lat * Math.PI) / 180))
  let best: number | null = null
  let bestD = maxM
  for (let i = 0; i < cols.lng.length; i++) {
    const x = cols.lng[i]
    const y = cols.lat[i]
    if (Math.abs(x - lng) > dLng || Math.abs(y - lat) > dLat) continue // also skips NaN
    const d = metresBetween(lng, lat, x, y)
    if (d <= bestD) { best = i; bestD = d }
  }
  return best
}

const boxes = new WeakMap<Float32Array, [number, number, number, number]>()

/** West, south, east, north of all the homes (cached per column). */
export function coverageBox(cols: Positions): [number, number, number, number] {
  const cached = boxes.get(cols.lng)
  if (cached) return cached
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (let i = 0; i < cols.lng.length; i++) {
    const x = cols.lng[i], y = cols.lat[i]
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    if (x < w) w = x
    if (x > e) e = x
    if (y < s) s = y
    if (y > n) n = y
  }
  const box: [number, number, number, number] = [w, s, e, n]
  boxes.set(cols.lng, box)
  return box
}

/** True when the point is inside the area the homes cover (with a small margin). */
export function insideCoverage(lng: number, lat: number, cols: Positions, marginM = 300): boolean {
  const [w, s, e, n] = coverageBox(cols)
  const dLat = marginM / M_PER_DEG_LAT
  const dLng = marginM / (M_PER_DEG_LNG * Math.cos((lat * Math.PI) / 180))
  return lng >= w - dLng && lng <= e + dLng && lat >= s - dLat && lat <= n + dLat
}

export type LocateResult =
  | { kind: 'outside' }
  | { kind: 'building'; row: number }
  | { kind: 'nobuilding' }

export function locateOutcome(lng: number, lat: number, cols: Positions, maxM: number): LocateResult {
  if (!insideCoverage(lng, lat, cols)) return { kind: 'outside' }
  const row = nearestBuilding(lng, lat, cols, maxM)
  return row === null ? { kind: 'nobuilding' } : { kind: 'building', row }
}

/**
 * Of the homes under a finger (ids = rows), the one whose centre is nearest to the tap. Without positions
 * (they load a moment after the colours) the first one, which is the topmost on the map.
 */
export function pickNearest(ids: readonly number[], lng: number, lat: number, cols: Positions | null): number | null {
  if (ids.length === 0) return null
  if (!cols || cols.lng.length === 0) return ids[0]
  let best = ids[0]
  let bestD = Infinity
  for (const id of ids) {
    const x = cols.lng[id], y = cols.lat[id]
    if (x === undefined || y === undefined || Number.isNaN(x)) continue
    const d = metresBetween(lng, lat, x, y)
    if (d < bestD) { best = id; bestD = d }
  }
  return best
}
