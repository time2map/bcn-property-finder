import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

// The building data files that are read together, by building row or area index (TODO-073, src/services/dataUrl.ts).
// Their addresses carry `?v=<hash of their contents>`, so a deploy with new data never mixes with cached old files.
export const VERSIONED_DATA = [
  'buildings-meta.json', 'buildings-scores.bin.gz', 'buildings-positions.bin.gz', 'buildings.pmtiles',
  'buildings-detail.pmtiles', 'areas.geojson', 'barri-vibe.json',
]

/** First 10 hex digits of the SHA-1 of the files (name and contents; a missing file counts by its name only). */
export function dataVersion(dir = 'public/data', files = VERSIONED_DATA) {
  const hash = createHash('sha1')
  for (const f of files) {
    const path = `${dir}/${f}`
    hash.update(f)
    if (existsSync(path)) hash.update(readFileSync(path))
  }
  return hash.digest('hex').slice(0, 10)
}
