// Where the product lives publicly (TODO-063): printed on every share image and used in link previews.
// ENV `VITE_SITE_URL`; the default is the final domain.

export const DEFAULT_SITE_URL = 'https://livability.time2map.com'

/** The address without a trailing slash; anything that is not an http(s) address gives the default. */
export function parseSiteUrl(raw: string | undefined): string {
  const url = (raw ?? '').trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s/]+/.test(url) ? url : DEFAULT_SITE_URL
}

export const SITE_URL = parseSiteUrl(import.meta.env.VITE_SITE_URL)

/** "livability.time2map.com", or "sempo.github.io/bcn-livability" for a fork: what the image prints. */
export function siteLabel(url: string = SITE_URL): string {
  return url.replace(/^https?:\/\//, '')
}

export const AREA_ATTRIBUTION = 'Boundaries: Barcelona City Council, CC BY 4.0'
