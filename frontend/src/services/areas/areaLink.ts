import type { Profile } from '../conditionOptions'
import { areaSlug } from '../shareImage/shareImageModel'
import { shareUrl } from '../urlConfig'

// The link of the "Share" button on an area card (TODO-064).

export interface AreaLinkInput {
  name: string
  /** `AreaRank.code`: the map link opens the card of this area. */
  code: string
  kind: 'barri' | 'muni'
  /** False when the area has too few homes: no page is built for it. */
  ranked: boolean
  /** The profile the settings equal, or null. */
  profile: Pick<Profile, 'id'> | null
  /** Public address of the site, no trailing slash. */
  siteUrl: string
  /** The address of the map now, and the settings as `c`. */
  href: string
  config: string
}

/**
 * A barri that is ranked, with the settings of a profile: the static page of that barri and profile, which has the
 * picture of the area as its link preview and sends people on to the map. Anything else: the map's own address
 * (the view is on the area, the settings are in `c`).
 */
export function areaLink(a: AreaLinkInput): string {
  if (a.kind === 'barri' && a.ranked && a.profile) return `${a.siteUrl}/share/${a.profile.id}/${areaSlug(a.name)}/`
  const [path, hash = ''] = shareUrl(a.href, a.config).split(/(?=#)/)
  const [base, query = ''] = path.split('?')
  const rest = query.split('&').filter((p) => p !== '' && !p.startsWith('a='))
  rest.push(`a=${encodeURIComponent(a.code)}`)
  return `${base}?${rest.join('&')}${hash}`
}
