import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ENABLED_LANGUAGES, DEFAULT_LANGUAGE } from './languages'
import { NAMESPACES } from './namespaces'

// Translation quality gate (TODO-065): every enabled language has the same files, keys and {{placeholders}} /
// <tags> as English, and nothing is left over. Run by `npm test`; the report is what a translator needs to see.
const root = join(__dirname, '..', 'locales')

type Tree = { [k: string]: string | Tree }
const read = (lang: string, ns: string): Tree => JSON.parse(readFileSync(join(root, lang, `${ns}.json`), 'utf8'))

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? { ...out, [key]: v } : { ...out, ...flatten(v, key) }
  }, {})
}
/** Words in braces and tags that a translation must keep as they are. */
const tokens = (s: string) => [...(s.match(/\{\{\s*\w+\s*\}\}|<\/?\w+>/g) ?? [])].map((t) => t.replace(/\s/g, '')).sort()
/** `key_one` / `key_other` are the plural forms of `key`; a language may use more or fewer of them. */
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '')

describe('locale files', () => {
  it('every namespace in the list has an English file, and no English file is unlisted', () => {
    const files = readdirSync(join(root, DEFAULT_LANGUAGE)).map((f) => f.replace('.json', '')).filter((f) => f !== 'areas').sort() // areas.json is loaded on demand, see areaDescriptions.test.ts
    expect(files).toEqual([...NAMESPACES].sort())
  })

  for (const lang of ENABLED_LANGUAGES.filter((l) => l !== DEFAULT_LANGUAGE)) {
    describe(lang, () => {
      for (const ns of NAMESPACES) {
        it(`${ns}: same keys and placeholders as English`, () => {
          expect(existsSync(join(root, lang, `${ns}.json`)), `${lang}/${ns}.json is missing`).toBe(true)
          const en = flatten(read(DEFAULT_LANGUAGE, ns))
          const tr = flatten(read(lang, ns))
          const enBases = new Set(Object.keys(en).map(base))
          const missing = [...enBases].filter((b) => !Object.keys(tr).some((k) => base(k) === b))
          const extra = Object.keys(tr).filter((k) => !enBases.has(base(k)))
          expect({ missing, extra }).toEqual({ missing: [], extra: [] })
          for (const [key, text] of Object.entries(tr)) {
            const source = en[key] ?? en[`${base(key)}_other`] ?? en[base(key)]
            expect(tokens(text), `${lang}/${ns}: ${key}`).toEqual(tokens(source))
            expect(text.trim(), `${lang}/${ns}: ${key} is empty`).not.toBe('')
          }
        })
      }
    })
  }
})
