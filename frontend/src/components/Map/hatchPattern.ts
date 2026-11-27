import type * as maplibregl from 'maplibre-gl'

// Incomplete-data hatch (060): light diagonal stripes drawn over the score colour. Built as raw pixels (no
// canvas), once, and shared by every layer that hatches.

export interface HatchSpec {
  id: string
  /** Tile size in px; the stripes repeat every `period` diagonal pixels. */
  period: number
  /** Stripe width in diagonal pixels. */
  stripe: number
}

/** Buildings: thin, so it still reads on a small footprint. */
export const HATCH_THIN: HatchSpec = { id: 'hatch-thin', period: 6, stripe: 2 }
/** Areas: wide stripes. */
export const HATCH_WIDE: HatchSpec = { id: 'hatch-wide', period: 20, stripe: 8 }

/** Square RGBA tile: white stripes (alpha) on transparent, running from bottom-left to top-right. */
export function hatchImage(period: number, stripe: number, alpha = 0.6) {
  const data = new Uint8ClampedArray(period * period * 4)
  for (let y = 0; y < period; y++) {
    for (let x = 0; x < period; x++) {
      if ((x + y) % period >= stripe) continue
      const o = (y * period + x) * 4
      data[o] = data[o + 1] = data[o + 2] = 255
      data[o + 3] = Math.round(alpha * 255)
    }
  }
  return { width: period, height: period, data }
}

/** Registers the hatch patterns on the map once. */
export function ensureHatchImages(map: maplibregl.Map): void {
  for (const spec of [HATCH_THIN, HATCH_WIDE]) {
    if (!map.hasImage(spec.id)) map.addImage(spec.id, hatchImage(spec.period, spec.stripe))
  }
}
