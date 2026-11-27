import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Size of the JavaScript a visitor downloads before the page can start (TODO-058): the scripts and the modulepreload
// links of dist/index.html, gzipped. Chunks that are loaded later (lazy layers, workers) do not count.

/** The .js files index.html loads at start, as given in it ("/bcn/assets/index-x.js"). */
export function initialScripts(html) {
  const found = new Set()
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const isScript = /^<script/i.test(tag)
    const isPreload = /rel=["']modulepreload["']/i.test(tag)
    if (!isScript && !isPreload) continue
    const ref = tag.match(/\b(?:src|href)=["']([^"']+\.js)["']/i)
    if (ref) found.add(ref[1])
  }
  return [...found]
}

/** Gzip size in bytes of each file. `read(ref)` returns its content. */
export function gzipSizes(refs, read) {
  return refs.map((ref) => ({ ref, bytes: gzipSync(read(ref), { level: 9 }).length }))
}

export function totalKB(sizes) {
  return sizes.reduce((sum, s) => sum + s.bytes, 0) / 1024
}

/** Reads dist/ and checks it against the budget; returns { sizes, totalKB, ok }. */
export function checkBundle(distDir, budgetKB) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  const sizes = gzipSizes(initialScripts(html), (ref) => readFileSync(join(distDir, ref.slice(ref.indexOf('/assets/') + 1))))
  const total = totalKB(sizes)
  return { sizes, totalKB: total, ok: total <= budgetKB }
}

export { dirname }
