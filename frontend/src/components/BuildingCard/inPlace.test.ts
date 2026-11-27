import { beforeAll, describe, it, expect } from 'vitest'
import { initI18n, tIn } from '../../i18n'
import { inPlace } from './inPlace'

// A translator for one language that does not switch the page.
const fixed: Record<string, (key: string, o: { name: string }) => string> = {}
const keys = ['rank.in', 'rank.inEl', 'rank.inEls']
const translations: Record<string, Record<string, string>> = {}

beforeAll(async () => {
  await initI18n()
  for (const lang of ['en', 'es', 'ca'] as const) {
    translations[lang] = {}
    for (const k of keys) translations[lang][k] = await tIn(lang, `card:${k}`, { name: '{{name}}' })
    fixed[lang] = (key, o) => translations[lang][key].replace('{{name}}', o.name)
  }
})

describe('inPlace (TODO-070)', () => {
  it('Spanish: "en" with every name, articles included', () => {
    expect(inPlace(fixed.es, 'el Raval')).toBe('en el Raval')
    expect(inPlace(fixed.es, "l'Antiga Esquerra de l'Eixample")).toBe("en l'Antiga Esquerra de l'Eixample")
    expect(inPlace(fixed.es, 'Sant Antoni')).toBe('en Sant Antoni')
    expect(inPlace(fixed.es, 'Esplugues de Llobregat')).toBe('en Esplugues de Llobregat')
  })
  it('Catalan: "a" joins el and els, nothing else', () => {
    expect(inPlace(fixed.ca, 'el Raval')).toBe('al Raval')
    expect(inPlace(fixed.ca, 'els Hostafrancs')).toBe('als Hostafrancs')
    expect(inPlace(fixed.ca, 'la Vila de Gràcia')).toBe('a la Vila de Gràcia')
    expect(inPlace(fixed.ca, "l'Hospitalet de Llobregat")).toBe("a l'Hospitalet de Llobregat")
    expect(inPlace(fixed.ca, 'Sant Antoni')).toBe('a Sant Antoni')
    expect(inPlace(fixed.ca, 'Badalona')).toBe('a Badalona')
  })
  it('English: "in" with the name as it is', () => {
    expect(inPlace(fixed.en, 'el Raval')).toBe('in el Raval')
    expect(inPlace(fixed.en, 'Sant Antoni')).toBe('in Sant Antoni')
  })
})
