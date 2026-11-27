// Link from the app to time2map's own page (TODO-029): where "Want a map like this?" leads. ENV `VITE_CTA_URL`
// (the case-study page once it exists) and `VITE_CTA_UTM_SOURCE`; the medium says which place the visitor clicked,
// so requests can be counted by source in the company site's analytics.

export const DEFAULT_CTA_URL = 'https://time2map.com'

/** The address without a trailing slash; anything that is not an http(s) address gives the default. */
export function parseCtaUrl(raw: string | undefined): string {
  const url = (raw ?? '').trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s/]+/.test(url) ? url : DEFAULT_CTA_URL
}

export const CTA_URL = parseCtaUrl(import.meta.env.VITE_CTA_URL)
export const CTA_UTM_SOURCE = (import.meta.env.VITE_CTA_UTM_SOURCE ?? '').trim()

export function buildCtaUrl(medium: string, base: string = CTA_URL, source: string = CTA_UTM_SOURCE): string {
  const url = new URL(base)
  if (source) url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', medium)
  return url.toString()
}
