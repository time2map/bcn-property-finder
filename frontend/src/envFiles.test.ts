import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// `npm test` runs from the frontend folder, where the .env* files live.
const root = process.cwd()
const envFiles = readdirSync(root).filter((name) => name.startsWith('.env'))

describe('env files', () => {
  it('finds the committed env files', () => {
    expect(envFiles).toContain('.env.production')
    expect(envFiles).toContain('.env.local.example')
  })

  it.each(envFiles)('%s has no merge conflict markers', (name) => {
    const markers = readFileSync(resolve(root, name), 'utf8')
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter(({ text }) => /^(<{7}|={7}|>{7})(\s|$)/.test(text))
    expect(markers).toEqual([])
  })

  it('.env.production keeps the match bands and the search settings', () => {
    const text = readFileSync(resolve(root, '.env.production'), 'utf8')
    expect(text).toMatch(/^VITE_MATCH_BANDS=85,65,40$/m)
    expect(text).toMatch(/^VITE_RANK_TIERS=10,20$/m)
    expect(text).toMatch(/^VITE_SEARCH_MIN_CHARS=\d+$/m)
    expect(text).toMatch(/^VITE_SEARCH_ADDRESS_ZOOM=\d+$/m)
  })
})
