// Versioned addresses of the building data (TODO-073). The files keep fixed names, and a browser may hold an old
// copy of one of them for a few minutes after a deploy (GitHub Pages caches for 10 min). The building files are read
// by row (`buildings.pmtiles` feature id, the score columns, the card tiles), so an old file next to a new one gives
// wrong colours and wrong cards. Each address carries `?v=<hash of the data files>` (vite.config.ts), so a new data
// build is a new address and is never mixed with a cached old one.

/** Short hash of the building data files of this build; empty when unknown (then no `?v`). */
export const DATA_VERSION: string = import.meta.env.VITE_DATA_VERSION ?? ''

/** `<base>data/<name>?v=<version>`. */
export function dataUrl(name: string, version = DATA_VERSION, base: string = import.meta.env.BASE_URL): string {
  return `${base}data/${name}${version ? `?v=${version}` : ''}`
}
