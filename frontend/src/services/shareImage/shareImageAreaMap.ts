import type { Ctx, MapSlot } from './shareImageDraw'

// The map of a share image made at build time (TODO-063): the areas as flat polygons coloured by how well they
// match, no tiles. The same colours the area view of the app uses, so the picture is recognisable.

type Ring = number[][]
export interface AreaShape {
  id: string
  /** Rings of the outer boundaries only; holes are ignored (barris have none that matter at this size). */
  polygons: Ring[]
}

export interface Bounds { west: number; south: number; east: number; north: number }

/** The outer rings of a Polygon / MultiPolygon geometry. */
export function outerRings(geometry: { type: string; coordinates: unknown }): Ring[] {
  if (geometry.type === 'Polygon') return [(geometry.coordinates as Ring[])[0]]
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Ring[][]).map((p) => p[0])
  return []
}

export function boundsOf(rings: readonly Ring[]): Bounds {
  const b = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < b.west) b.west = x
      if (x > b.east) b.east = x
      if (y < b.south) b.south = y
      if (y > b.north) b.north = y
    }
  }
  return b
}

/** Equirectangular, scaled by cos(latitude): right to within a fraction of a percent at the size of a city. */
export function projector(view: Bounds, box: { x: number; y: number; w: number; h: number }) {
  const lat0 = ((view.south + view.north) / 2) * (Math.PI / 180)
  const kx = Math.cos(lat0)
  const spanX = (view.east - view.west) * kx
  const spanY = view.north - view.south
  const scale = Math.min(box.w / spanX, box.h / spanY)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const mx = (view.west + view.east) / 2
  const my = (view.north + view.south) / 2
  return {
    scale,
    point: (lng: number, lat: number): [number, number] => [cx + (lng - mx) * kx * scale, cy - (lat - my) * scale],
  }
}

/**
 * Paints `areas` coloured by `fill`. The view is `view`, fitted into the free part of the picture around the slot's
 * focus point (`share` of it). The area `focusId` gets a dark outline and its centre is returned, for the pin.
 */
export function drawAreaMap(
  ctx: Ctx,
  slot: MapSlot,
  areas: readonly AreaShape[],
  fill: (id: string) => string,
  view: Bounds,
  options: { focusId?: string; share?: number; freeWidth: number; freeHeight: number },
): { x: number; y: number } | null {
  const share = options.share ?? 0.8
  const box = {
    x: slot.focus.x - (options.freeWidth * share) / 2,
    y: slot.focus.y - (options.freeHeight * share) / 2,
    w: options.freeWidth * share,
    h: options.freeHeight * share,
  }
  const { point } = projector(view, box)

  // Sea / land under the areas.
  ctx.fillStyle = '#e6fbfd'
  ctx.fillRect(0, 0, slot.width, slot.height)

  const trace = (ring: Ring) => {
    ring.forEach(([lng, lat], i) => {
      const [x, y] = point(lng, lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
  }

  ctx.lineJoin = 'round'
  for (const a of areas) {
    ctx.beginPath()
    a.polygons.forEach(trace)
    ctx.fillStyle = fill(a.id)
    ctx.fill('evenodd')
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  const focus = areas.find((a) => a.id === options.focusId)
  if (!focus) return null
  ctx.beginPath()
  focus.polygons.forEach(trace)
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 4
  ctx.stroke()
  const b = boundsOf(focus.polygons)
  const [x, y] = point((b.west + b.east) / 2, (b.south + b.north) / 2)
  return { x, y }
}
