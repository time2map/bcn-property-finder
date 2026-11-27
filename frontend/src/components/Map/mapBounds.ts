import { LngLat } from 'maplibre-gl'

/** [west, south, east, north] */
export type Bounds = [number, number, number, number]

// The area the data covers (buildings: lng 1.89–2.29, lat 41.26–41.57) with a small margin.
const DEFAULT_BOUNDS: Bounds = [1.88, 41.25, 2.31, 41.59]
const DEFAULT_MIN_ZOOM = 8

export function parseBounds(raw: string | undefined, fallback: Bounds = DEFAULT_BOUNDS): Bounds {
  const v = (raw ?? '').split(',').map((s) => Number(s.trim()))
  const ok = v.length === 4 && v.every(Number.isFinite) && v[0] < v[2] && v[1] < v[3]
  return ok ? (v as Bounds) : fallback
}

export const MAP_BOUNDS: Bounds = parseBounds(import.meta.env.VITE_MAP_BOUNDS)

const minZoom = Number(import.meta.env.VITE_MAP_MIN_ZOOM)
export const MAP_MIN_ZOOM = Number.isFinite(minZoom) && import.meta.env.VITE_MAP_MIN_ZOOM ? minZoom : DEFAULT_MIN_ZOOM

/** Keeps the map CENTRE inside `bounds`: the edge of the data zone can be put in the middle of the screen, but
 *  the map cannot be dragged further away. */
export function clampCenter(lng: number, lat: number, bounds: Bounds = MAP_BOUNDS): [number, number] {
  const [w, s, e, n] = bounds
  return [Math.min(Math.max(lng, w), e), Math.min(Math.max(lat, s), n)]
}

const MAX_ZOOM = 22 // MapLibre's default maxZoom

/** `transformConstrain` for MapLibre. It replaces MapLibre's own constrain, which is what enforced `minZoom`, so the
 *  zoom is limited here as well. */
export function constrainToBounds(lngLat: LngLat, zoom: number): { center: LngLat; zoom: number } {
  const [lng, lat] = clampCenter(lngLat.lng, lngLat.lat)
  const center = new LngLat(lng, lat)
  return { center, zoom: Math.min(Math.max(zoom, MAP_MIN_ZOOM), MAX_ZOOM) }
}
