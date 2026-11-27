import { withConfig } from './urlConfig'

// A link to one building (TODO-064): `b=<lng>,<lat>`. The position, not the row of the data: rows change with
// every rebuild of the data, a position does not.

/** Zoom of a shared building: close enough to see the street. */
export const BUILDING_LINK_ZOOM = 17
/** A building is found within this many metres of the position in the link. */
export const MATCH_METRES = 15
const M_PER_DEG = 111_320

export function encodeBuildingParam(lng: number, lat: number): string {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`
}

/** `[lng, lat]` of a `b` value, or null when it is not a position. */
export function parseBuildingParam(value: string | null): [number, number] | null {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 2 || parts.some((p) => p.trim() === '')) return null
  const [lng, lat] = parts.map(Number)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null
  return [lng, lat]
}

/** Row of the building nearest to the position, or null when none is within `maxMetres`. */
export function nearestBuilding(
  lngs: ArrayLike<number>, lats: ArrayLike<number>, lng: number, lat: number, maxMetres = MATCH_METRES,
): number | null {
  const kx = Math.cos((lat * Math.PI) / 180)
  let best: number | null = null
  let bestD = maxMetres
  for (let i = 0; i < lngs.length; i++) {
    const dx = (lngs[i] - lng) * kx * M_PER_DEG
    if (Math.abs(dx) > bestD) continue
    const d = Math.hypot(dx, (lats[i] - lat) * M_PER_DEG)
    if (d <= bestD) { bestD = d; best = i }
  }
  return best
}

/** The address of the map with the settings `c`, the view on the building, and the building in `b`. */
export function buildingLinkUrl(href: string, c: string, lngLat: readonly [number, number]): string {
  const url = new URL(href)
  const rest = url.search.replace(/^\?/, '').split('&')
    .filter((p) => p !== '' && !/^(b|zoom|cx|cy)=/.test(p))
  rest.push(`zoom=${BUILDING_LINK_ZOOM.toFixed(2)}`, `cx=${lngLat[0].toFixed(5)}`, `cy=${lngLat[1].toFixed(5)}`,
    `b=${encodeBuildingParam(lngLat[0], lngLat[1])}`)
  return `${url.origin}${url.pathname}${withConfig(`?${rest.join('&')}`, c || 'default')}${url.hash}`
}
