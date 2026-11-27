import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

// The score model audit (TODO-073): runs the app's own scoring over the data files for the first-visit settings and
// every profile, prints what share of Barcelona homes meets each condition, the bands, the best score and how much
// each condition moves the score, and exits with 1 when a default condition can hardly be met (the guard).
//   npm run audit:score            # print; exit 1 when the guard fails
//   npm run audit:score -- --write # also write src/services/audit/influence.json (the info modal reads it)
const root = fileURLToPath(new URL('..', import.meta.url))
const data = (name) => `${root}public/data/${name}`

const { module } = await runnerImport('/src/services/audit/scoreAuditBuild.ts', {
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
const runs = module.runAudit({
  meta,
  columns: { scores: column('scores'), positions: column('positions') },
  vibe: existsSync(vibePath) ? JSON.parse(readFileSync(vibePath, 'utf8')) : null,
})

const r1 = (x) => Math.round(x * 10) / 10
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${r1(v)}`).join(', ')
let ok = true
for (const { name, result: r, guard: g } of runs) {
  const pass = g.someoneMeetsAll && g.rare.length === 0
  ok &&= pass
  console.log(`\n${name}${pass ? '' : '  ✗ GUARD'}  (Barcelona homes)`)
  console.log(`  meets fully:      ${fmt(r.metShare)}`)
  console.log(`  meets 0…${r.active.length}:        ${r.metCount.map(r1).join(' / ')}%  · all: ${r1(r.allMet)}%  · best score ${r.best}`)
  console.log(`  great/good/partial/poor: ${r.bands.map(r1).join(' / ')}%`)
  console.log(`  influence:        ${fmt(r.influence)}`)
  if (!g.someoneMeetsAll) console.log('  ✗ no Barcelona building meets every condition')
  if (g.rare.length) console.log(`  ✗ met by under 5% of homes: ${g.rare.join(', ')}`)
}

if (process.argv.includes('--write')) {
  const first = runs.find((r) => r.name === 'first visit').result
  const out = Object.fromEntries(Object.entries(first.influence).map(([k, v]) => [k, Math.round(v)]))
  writeFileSync(`${root}src/services/audit/influence.json`, `${JSON.stringify(out, null, 2)}\n`)
  console.log('\n→ src/services/audit/influence.json', out)
}
process.exit(ok ? 0 : 1)
