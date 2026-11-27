import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { areaDescription, loadAreaTexts } from './areaDescriptions'
import { ENABLED_LANGUAGES } from '../../i18n/languages'

describe('area descriptions (TODO-064, 065)', () => {
  const areas = JSON.parse(readFileSync('public/data/areas.geojson', 'utf8')) as {
    features: { properties: { id: string; kind: string } }[]
  }
  const barriCodes = areas.features.filter((f) => f.properties.kind === 'barri').map((f) => f.properties.id.slice(-2))

  it.each([...ENABLED_LANGUAGES])('%s has a text for every barri and none for a code that is not one', async (lang) => {
    const texts = await loadAreaTexts(lang)
    expect(barriCodes).toHaveLength(73)
    for (const code of barriCodes) expect(texts[code], `${lang} ${code}`).toBeTruthy()
    for (const code of Object.keys(texts)) expect(barriCodes.includes(code), `${lang} ${code}`).toBe(true)
  })
  it('keeps every English text to one or two sentences', async () => {
    for (const [code, t] of Object.entries(await loadAreaTexts('en'))) {
      expect(t.length, code).toBeLessThan(260)
      expect((t.match(/\. [A-Z]/g) ?? []).length, code).toBeLessThanOrEqual(2)
    }
  })
  it('gives the text in the language asked for, English for a language without a file, null for a municipality', async () => {
    const [en, es] = await Promise.all([areaDescription('31', 'en'), areaDescription('31', 'es')])
    expect(es).not.toBe(en)
    expect(await areaDescription('31', 'xx')).toBe(en)
    expect(await areaDescription('08001')).toBeNull()
  })
})
