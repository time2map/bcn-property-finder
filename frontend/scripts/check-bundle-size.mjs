import { readFileSync } from 'node:fs'
import { checkBundle } from './bundleSize.mjs'

// `npm run check:bundle` after `npm run build`: fails when the JavaScript loaded at start exceeds the budget in
// package.json ("bundleBudget.initialJsGzipKB").
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const budget = pkg.bundleBudget?.initialJsGzipKB
if (!Number.isFinite(budget)) {
  console.error('package.json has no bundleBudget.initialJsGzipKB')
  process.exit(2)
}
const result = checkBundle(new URL('../dist', import.meta.url).pathname, budget)
for (const s of result.sizes) console.log(`${(s.bytes / 1024).toFixed(1).padStart(7)} KB  ${s.ref}`)
console.log(`${result.totalKB.toFixed(1).padStart(7)} KB  initial JS (gzip), budget ${budget} KB`)
if (!result.ok) {
  console.error(`Over budget by ${(result.totalKB - budget).toFixed(1)} KB. Lazy-load something or raise the budget on purpose.`)
  process.exit(1)
}
