import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { gzipSizes, initialScripts, totalKB } from './bundleSize.mjs'

const HTML = `<!doctype html><html><head>
<link rel="icon" href="/favicon.svg">
<script type="module" crossorigin src="/bcn/assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="/bcn/assets/react-def.js">
<link rel="stylesheet" crossorigin href="/bcn/assets/index-xyz.css">
<link rel="preload" href="/bcn/data/x.json">
<link rel="modulepreload" href="/bcn/assets/react-def.js">
</head><body><script src="https://cdn.example/analytics.js"></script></body></html>`

describe('initialScripts', () => {
  it('lists the scripts and modulepreload links of index.html, once each, and nothing else', () => {
    expect(initialScripts(HTML)).toEqual([
      '/bcn/assets/index-abc.js', '/bcn/assets/react-def.js', 'https://cdn.example/analytics.js',
    ])
  })
  it('is empty without any', () => expect(initialScripts('<html></html>')).toEqual([]))
})

describe('sizes', () => {
  it('gzips each file and adds them up in KB', () => {
    const files = { a: Buffer.from('x'.repeat(5000)), b: Buffer.from('y'.repeat(3000) + 'z'.repeat(2000)) }
    const sizes = gzipSizes(['a', 'b'], (ref) => files[ref])
    expect(sizes[0].bytes).toBe(gzipSync(files.a, { level: 9 }).length)
    expect(sizes[0].bytes).toBeLessThan(100)
    expect(totalKB(sizes)).toBeCloseTo((sizes[0].bytes + sizes[1].bytes) / 1024, 6)
  })
})
