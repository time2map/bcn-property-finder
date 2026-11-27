import { describe, it, expect } from 'vitest'
import { parseEnabledLanguages, resolveLanguage, languageName } from './languages'

describe('parseEnabledLanguages', () => {
  it('splits, trims and lower-cases the list', () => {
    expect(parseEnabledLanguages('en, ES ,ca', 'en')).toEqual(['en', 'es', 'ca'])
  })
  it('always contains the default language, first', () => {
    expect(parseEnabledLanguages('es,ca', 'en')).toEqual(['en', 'es', 'ca'])
  })
  it('falls back to the default alone when the list is empty or missing', () => {
    expect(parseEnabledLanguages('', 'en')).toEqual(['en'])
    expect(parseEnabledLanguages(undefined, 'en')).toEqual(['en'])
  })
  it('drops duplicates and codes that are not language tags', () => {
    expect(parseEnabledLanguages('es,es,??,x', 'en')).toEqual(['en', 'es'])
  })
})

describe('resolveLanguage', () => {
  const base = { enabled: ['en', 'es', 'ca'], fallback: 'en', search: '', stored: null, browser: [] as string[] }
  it('takes ?lang= first', () => {
    expect(resolveLanguage({ ...base, search: '?lang=ca', stored: 'es', browser: ['es'] })).toBe('ca')
  })
  it('ignores an unknown ?lang= and goes on to the stored choice', () => {
    expect(resolveLanguage({ ...base, search: '?lang=xx', stored: 'es' })).toBe('es')
  })
  it('then the stored choice, then the browser languages (region ignored), then the fallback', () => {
    expect(resolveLanguage({ ...base, stored: 'ca', browser: ['es'] })).toBe('ca')
    expect(resolveLanguage({ ...base, browser: ['fr-FR', 'es-ES'] })).toBe('es')
    expect(resolveLanguage({ ...base, browser: ['fr'] })).toBe('en')
  })
  it('ignores a stored language that is no longer enabled', () => {
    expect(resolveLanguage({ ...base, stored: 'de', browser: ['ca'] })).toBe('ca')
  })
})

describe('languageName', () => {
  it('names a language in itself', () => {
    expect(languageName('es')).toBe('Español')
    expect(languageName('ca')).toBe('Català')
    expect(languageName('en')).toBe('English')
  })
  it('names a language we have no entry for through Intl', () => {
    expect(languageName('de').toLowerCase()).toBe('deutsch')
  })
})
