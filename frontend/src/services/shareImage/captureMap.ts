import type * as maplibregl from 'maplibre-gl'
import type { Ctx, MapSlot } from './shareImageDraw'

// The map part of the "Save image" picture (TODO-063): a snapshot of the live map around the place, drawn without
// the clutter that is fine on a screen but noisy in a picture (shop and pharmacy icons, contour lines, labels
// other than street names).

/** Symbol layers that stay: street names. Everything else with text or an icon is hidden for the snapshot. */
const KEEP_SYMBOL = /^transportation_name-/
const HIDE_LINE = /contour/i

/** Layer ids to hide for the snapshot, from the style's layers. Pure, for the test. */
export function layersToHide(layers: readonly { id: string; type: string }[]): string[] {
  return layers
    .filter((l) => (l.type === 'symbol' && !KEEP_SYMBOL.test(l.id)) || (l.type === 'line' && HIDE_LINE.test(l.id)))
    .map((l) => l.id)
}

/** The map is drawn at least this sharp for the picture, whatever the screen: a 4:5 picture magnifies a landscape map. */
const MIN_PIXEL_RATIO = 2

/**
 * The part of the source picture to draw: the output's shape, as large as lets the place land exactly on `focus` of
 * the output (so the view is as wide as the map allows), at most `maxScale` source pixels per output pixel. When the
 * map is too small for that, the view is `minScale` wide and is moved back inside the source, so the place lands
 * as near the focus as it can.
 */
export function sourceRect(
  source: { width: number; height: number },
  out: { width: number; height: number },
  place: { x: number; y: number },
  focus: { x: number; y: number },
  maxScale = 2,
  minScale = 0.5,
): { sx: number; sy: number; sw: number; sh: number } {
  const fx = focus.x / out.width
  const fy = focus.y / out.height
  // How far the view can reach from the place on each side before it leaves the source, per axis.
  const reachX = Math.min(place.x / fx, (source.width - place.x) / (1 - fx)) / out.width
  const reachY = Math.min(place.y / fy, (source.height - place.y) / (1 - fy)) / out.height
  const fits = Math.min(maxScale, source.width / out.width, source.height / out.height)
  const scale = Math.max(minScale, Math.min(fits, reachX, reachY))
  const sw = out.width * scale
  const sh = out.height * scale
  const clamp = (v: number, size: number, limit: number) => Math.max(0, Math.min(v, limit - size))
  return { sx: clamp(place.x - focus.x * scale, sw, source.width), sy: clamp(place.y - focus.y * scale, sh, source.height), sw, sh }
}

/**
 * Draws a snapshot of `map` around `lngLat`, with the place on the focus point of the slot, and returns where the place landed on the picture. Hides the noisy
 * layers while it takes the picture and puts them back. Resolves to null when the map cannot be read.
 */
export function captureMap(map: maplibregl.Map, lngLat: [number, number]) {
  return async (ctx: Ctx, slot: MapSlot): Promise<{ x: number; y: number } | null> => {
    const hidden = layersToHide(map.getStyle().layers).filter((id) => map.getLayoutProperty(id, 'visibility') !== 'none')
    const ratio = map.getPixelRatio()
    try {
      for (const id of hidden) map.setLayoutProperty(id, 'visibility', 'none')
      if (ratio < MIN_PIXEL_RATIO) map.setPixelRatio(MIN_PIXEL_RATIO)
      // Let the map finish drawing the changed style at the new sharpness (idle), but never wait long for it.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1500)
        map.once('idle', () => { clearTimeout(timer); resolve() })
        map.triggerRepaint()
      })
      // The drawing buffer of a WebGL canvas is only readable inside the frame that painted it.
      return await new Promise((resolve) => {
        map.once('render', () => {
          try {
            const canvas = map.getCanvas()
            const dpr = canvas.width / canvas.clientWidth || 1
            const p = map.project(lngLat)
            const place = { x: p.x * dpr, y: p.y * dpr }
            const r = sourceRect(canvas, slot, place, slot.focus)
            ctx.drawImage(canvas, r.sx, r.sy, r.sw, r.sh, 0, 0, slot.width, slot.height)
            resolve({ x: ((place.x - r.sx) / r.sw) * slot.width, y: ((place.y - r.sy) / r.sh) * slot.height })
          } catch (err) {
            console.warn('Share image: the map could not be read', err)
            resolve(null)
          }
        })
        map.triggerRepaint()
      })
    } finally {
      for (const id of hidden) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
      if (map.getPixelRatio() !== ratio) map.setPixelRatio(ratio)
      map.triggerRepaint()
    }
  }
}
