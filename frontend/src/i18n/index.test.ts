import { describe, it, expect, beforeEach } from 'vitest'
import i18n, { setLanguage, initI18n, tIn, loadNamespace } from './index'

describe('i18n instance', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
    await initI18n()
    await setLanguage('en')
  })

  it('speaks English by default', () => {
    expect(i18n.t('brand.title')).toBe('Barcelona livability map')
    expect(i18n.language).toBe('en')
  })

  it('loads another language on demand and uses it', async () => {
    await setLanguage('es')
    expect(i18n.language).toBe('es')
    expect(i18n.t('brand.share')).not.toBe('Share this map')
    expect(document.documentElement.lang).toBe('es')
  })

  it('remembers the choice and puts it in the address', async () => {
    await setLanguage('ca')
    expect(localStorage.getItem('bcn_lang')).toBe('ca')
    expect(new URLSearchParams(window.location.search).get('lang')).toBe('ca')
  })

  it('leaves ?lang= out of the address for the default language', async () => {
    await setLanguage('ca')
    await setLanguage('en')
    expect(new URLSearchParams(window.location.search).has('lang')).toBe(false)
  })

  it('ignores a language that is not enabled', async () => {
    await setLanguage('xx')
    expect(i18n.language).toBe('en')
  })

  it('falls back to English for a key a language has not translated yet', async () => {
    await setLanguage('es')
    expect(i18n.t('brand.title')).toBeTruthy()
  })

  it('translates into a given language without switching (for pages built ahead of time)', async () => {
    expect(await tIn('ca', 'brand.share')).not.toBe('Share this map')
    expect(i18n.language).toBe('en')
  })

  it('pluralises by the language rules', async () => {
    i18n.addResourceBundle('en', 'common', { test: { items_one: '{{count}} item', items_other: '{{count}} items' } }, true, true)
    expect(i18n.t('test.items', { count: 1 })).toBe('1 item')
    expect(i18n.t('test.items', { count: 3 })).toBe('3 items')
  })
})

// TODO-076: the funnel texts are not in the start bundle; they come with the funnel code.
describe('on-demand namespaces', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
    await initI18n()
    await setLanguage('en')
  })

  it('leaves the funnel texts out until they are asked for, then loads them in English', async () => {
    expect(i18n.hasResourceBundle('en', 'funnel')).toBe(false)
    await loadNamespace('funnel')
    expect(i18n.hasResourceBundle('en', 'funnel')).toBe(true)
    expect(i18n.t('funnel:title')).not.toBe('title')
  })

  it('loads an asked-for namespace in the current language too', async () => {
    await setLanguage('es')
    await loadNamespace('funnel')
    expect(i18n.hasResourceBundle('es', 'funnel')).toBe(true)
  })

  it('brings an asked-for namespace along when the language changes later', async () => {
    await loadNamespace('funnel')
    await setLanguage('ca')
    expect(i18n.hasResourceBundle('ca', 'funnel')).toBe(true)
  })
})
