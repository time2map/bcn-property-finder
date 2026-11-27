/**
 * The short credit line on the map (TODO-066). Kept apart from the full registry (`dataSources.ts`), which is only
 * needed when the dialog opens, so the first download stays small. `source` is the registry id the part stands for
 * (checked by `dataSources.test.ts`).
 */
export const MAP_CREDIT: readonly { source: string; text: string; url: string }[] = [
  { source: 'icgc', text: '© ICGC', url: 'https://www.icgc.cat/en/Tools-and-viewers/Viewers/ContextMaps' },
  { source: 'osm', text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  { source: 'catastro', text: '© Dirección General del Catastro', url: 'https://www.catastro.hacienda.gob.es/webinspire/index.html' },
]
