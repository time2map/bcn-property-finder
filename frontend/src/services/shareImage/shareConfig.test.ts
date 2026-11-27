import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL, parseSiteUrl, siteLabel } from './shareConfig'

describe('parseSiteUrl', () => {
  it('keeps an http(s) address and drops the trailing slash', () => {
    expect(parseSiteUrl('https://sempo.github.io/bcn-livability/')).toBe('https://sempo.github.io/bcn-livability')
    expect(parseSiteUrl(' http://localhost:5173 ')).toBe('http://localhost:5173')
  })
  it('falls back to the default for nothing or for rubbish', () => {
    expect(parseSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(parseSiteUrl('')).toBe(DEFAULT_SITE_URL)
    expect(parseSiteUrl('livability.example')).toBe(DEFAULT_SITE_URL)
  })
})

describe('siteLabel', () => {
  it('prints the address without the scheme', () => {
    expect(siteLabel('https://livability.time2map.com')).toBe('livability.time2map.com')
    expect(siteLabel('https://sempo.github.io/bcn-livability')).toBe('sempo.github.io/bcn-livability')
  })
})
