import { describe, it, expect } from 'vitest'
import { buildCtaUrl, parseCtaUrl, DEFAULT_CTA_URL } from './ctaLink'

describe('parseCtaUrl', () => {
  it('keeps an http(s) address and drops a trailing slash', () => {
    expect(parseCtaUrl('https://time2map.com/cases/livability/')).toBe('https://time2map.com/cases/livability')
  })
  it('falls back to the default for empty or invalid values', () => {
    expect(parseCtaUrl(undefined)).toBe(DEFAULT_CTA_URL)
    expect(parseCtaUrl('  ')).toBe(DEFAULT_CTA_URL)
    expect(parseCtaUrl('javascript:alert(1)')).toBe(DEFAULT_CTA_URL)
  })
})

describe('buildCtaUrl', () => {
  it('adds the source and the medium', () => {
    const url = new URL(buildCtaUrl('about', 'https://time2map.com/case', 'livability'))
    expect(url.origin + url.pathname).toBe('https://time2map.com/case')
    expect(url.searchParams.get('utm_source')).toBe('livability')
    expect(url.searchParams.get('utm_medium')).toBe('about')
  })
  it('keeps a query that is already there', () => {
    const url = new URL(buildCtaUrl('about', 'https://time2map.com/case?lang=en', 'livability'))
    expect(url.searchParams.get('lang')).toBe('en')
    expect(url.searchParams.get('utm_medium')).toBe('about')
  })
  it('leaves the source out when it is empty', () => {
    const url = new URL(buildCtaUrl('about', 'https://time2map.com', ''))
    expect(url.searchParams.has('utm_source')).toBe(false)
    expect(url.searchParams.get('utm_medium')).toBe('about')
  })
})
