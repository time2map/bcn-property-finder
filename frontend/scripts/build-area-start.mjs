import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

// After `vite build` (part of `npm run build`): writes dist/data/area-start.json, the area view of a first visit
// (TODO-058, src/services/areas/areaStart.ts). Computed with the app's own scoring code, from the data files of
// this build, so it cannot go stale. An optional argument names another output folder.
const root = fileURLToPath(new URL('..', import.meta.url))
const data = (name) => `${root}public/data/${name}`
const outDir = process.argv[2] ?? `${root}dist/data`

const { module } = await runnerImport('/src/services/areas/areaStartBuild.ts', {
  root, configFile: false, mode: 'production', logLevel: 'error',
})
const meta = JSON.parse(readFileSync(data('buildings-meta.json'), 'utf8'))
const column = (file) => {
  const path = data(module.COLUMN_FILES[file])
  if (!existsSync(path)) return undefined
  const buf = gunzipSync(readFileSync(path))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}
const vibePath = data('barri-vibe.json')

const t0 = performance.now()
const start = module.buildAreaStart({
  meta,
  columns: { scores: column('scores'), positions: column('positions') },
  areas: JSON.parse(readFileSync(data('areas.geojson'), 'utf8')),
  vibe: existsSync(vibePath) ? JSON.parse(readFileSync(vibePath, 'utf8')) : null,
})
const joined = Object.keys(start.join).length
if (joined === 0 || start.ranks.length === 0) throw new Error('area-start: no area joined or ranked')
mkdirSync(outDir, { recursive: true })
const json = JSON.stringify(start)
writeFileSync(`${outDir}/area-start.json`, json)
console.log(`area-start.json: ${joined} of ${meta.areas.length} areas, ${(json.length / 1024).toFixed(0)} KB, ${Math.round(performance.now() - t0)} ms`)
