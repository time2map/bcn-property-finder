import type { StyleSpecification } from 'maplibre-gl'
import { afterFirstPaint } from './firstPaint'

// Base map style (TODO-058). ICGC's style is 760 KB and ICGC serves it uncompressed, so the app loads its own copy
// (public/basemap/, written by `npm run update:basemap`, gzipped by the host and preloaded by index.html). The
// tiles, fonts and icons still come from ICGC: a small request checks that ICGC answers, and when it does not the
// map uses OpenFreeMap instead, as before.

export const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
/** Asked with HEAD (no body) to see that ICGC is up. Same host as the tiles of the local style. */
const ICGC_PROBE = 'https://geoserveis.icgc.cat/contextmaps/icgc_mapa_estandard_general.json'
const PROBE_TIMEOUT_MS = 3000

export interface MapStyle {
  /** The style itself (our copy of ICGC's) or the address of the fallback style. */
  style: StyleSpecification | string
  /** True for our own copy: it is checked when it is saved, so MapLibre need not validate its 900 layers again. */
  trusted: boolean
}

async function icgcIsUp(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    return (await fetch(ICGC_PROBE, { method: 'HEAD', signal: controller.signal })).ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function localStyle(): Promise<StyleSpecification | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}basemap/icgc-standard.json`)
    if (!res.ok) return null
    // 740 KB of JSON: parsed after the first paint, not before it.
    await afterFirstPaint()
    return (await res.json()) as StyleSpecification
  } catch {
    return null
  }
}

async function resolve(): Promise<MapStyle> {
  const [style, up] = await Promise.all([localStyle(), icgcIsUp()])
  return style && up ? { style, trusted: true } : { style: FALLBACK_STYLE, trusted: false }
}

let cache: Promise<MapStyle> | null = null

/** The style of the base map; both requests start at the first call (main.tsx calls it before React renders). */
export function loadMapStyle(): Promise<MapStyle> {
  cache ??= resolve()
  return cache
}

export function resetMapStyleCache(): void {
  cache = null
}
