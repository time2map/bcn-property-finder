import { writeFileSync, mkdirSync } from 'node:fs'

// `npm run update:basemap`: saves ICGC's base map style into public/basemap/, so the app loads it from its own host
// (TODO-058). ICGC serves the 760 KB style uncompressed; from our host it is gzipped (~55 KB) and can be preloaded.
// Run again when ICGC changes its style or tile schema (the map then looks wrong or loses labels).
const SOURCE = 'https://geoserveis.icgc.cat/contextmaps/icgc_mapa_estandard_general.json'
const TARGET = new URL('../public/basemap/icgc-standard.json', import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`ICGC style: HTTP ${res.status}`)
const style = await res.json()
if (style.version !== 8 || !Array.isArray(style.layers) || !style.layers.length || !style.sources) {
  throw new Error('ICGC style: not a MapLibre style (version 8 with layers and sources expected)')
}
// A local copy cannot resolve relative addresses: everything must point at ICGC (or another host) in full.
const urls = [style.sprite, style.glyphs, ...Object.values(style.sources).flatMap((s) => [s.url, ...(s.tiles ?? [])])]
const relative = urls.filter((u) => typeof u === 'string' && !/^https?:\/\//.test(u))
if (relative.length) throw new Error(`ICGC style has relative addresses: ${relative.join(', ')}`)

mkdirSync(new URL('.', TARGET), { recursive: true })
const json = JSON.stringify(style)
writeFileSync(TARGET, json)
console.log(`${style.layers.length} layers, ${(json.length / 1024).toFixed(0)} KB → public/basemap/icgc-standard.json`)
