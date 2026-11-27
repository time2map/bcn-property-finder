import type { Profile } from '../conditionOptions'
import {
  BAND_COLOR, BAND_LABEL, CONDITION_LABEL, matchBand, type ConditionId, type ConditionStatus, type MatchBandId,
  type MatchSummary,
} from '../match/matchSummary'
import type { Award, BuildingRanks } from '../buildings/buildingRank'
import { PRESETS, profileName } from '../presets'
import i18n from '../../i18n'
import { inPlace } from '../../components/BuildingCard/inPlace'
import { decodeConfig, encodeConfig, type UrlSettings } from '../urlConfig'

// What a share image says (TODO-063). Pure: the building card and the build script both turn their data into this
// model, and the drawing (shareImageDraw.ts) only paints it. The building picture names the first address with its
// house number (decided 2026-11-16: a bare street name does not say which home it is) and has no "Meets N of M" line; the rows carry the detail.

/** Rows on an image, the risk row included. */
export const MAX_ROWS = 4

export type RowStatus = ConditionStatus | 'risk'

export interface ShareRow {
  status: RowStatus
  text: string
}

export interface ShareRank {
  /** "Top 10%" */
  value: string
  /** 10 for "Top 10%": the picture colours the badge by it (gold for the narrowest tier). */
  tier: number
  /** "of homes in la Vila de Gràcia" */
  text: string
}

export interface ShareModel {
  kind: 'building' | 'area'
  /** Street without a number, or the name of the area. */
  place: string
  /** "Can Baró, Barcelona"; null when the area is not known. */
  subtitle: string | null
  /** "For a family"; null when the settings are not a profile. */
  forWhom: string | null
  /** The big number: the score, or "62%" for an area. */
  value: string
  /** The band name, for a building ("Good match"). */
  bandLabel: string
  band: MatchBandId
  /** Colour of the plaque behind the number. */
  bandColor: string
  /** Under the number, for an area ("of homes are a good match"). */
  caption: string | null
  /**
   * Rank tiles (TODO-070), as on the card: "Top 10%" over "of homes in la Vila de Gràcia" Empty for
   * an area or without a rank.
   */
  ranks: ShareRank[]
  /** "For your conditions" over the rank lines when no profile says for whom; null otherwise. */
  ranksHeading: string | null
  rows: ShareRow[]
}

/** "For a family": the profile in words, in the page language. Profiles from an override or a new one fall back to the name. */
const FOR_PHRASE = new Set(['family', 'remote', 'city', 'retiree'])
const forWhom = (profile: Pick<Profile, 'id' | 'name'> | null) =>
  !profile ? null
    : FOR_PHRASE.has(profile.id) ? i18n.t(`card:share.for.${profile.id as 'family'}`)
    : i18n.t('card:share.forName', { name: profileName(profile) })

/** "Carrer Tenerife 59 · Carrer Torre Dulac 14" → "Carrer Tenerife 59": the first address, with its number. */
export function firstAddress(address: string | null | undefined): string | null {
  return address?.split(' · ')[0]?.trim() || null
}

/** The profile whose settings these are exactly, or null (a changed limit, a hand-made set, the defaults). */
export function profileOf(settings: UrlSettings, defaults: UrlSettings, presets: readonly Profile[] = PRESETS): Profile | null {
  const mine = encodeConfig(settings, defaults)
  if (mine === '') return null
  return presets.find((p) => {
    const s = decodeConfig(`preset:${p.id}`, defaults)
    return s !== null && encodeConfig(s, defaults) === mine
  }) ?? null
}

// The card's tile wording (RankLines), not a sentence of its own: "Top 10%" over "of homes in el Raval". The earlier
// "This home is better than 87% of homes in …" repeated itself, wrapped in es and ca, and read as a verdict on the home
// to whoever got the picture (decided 2026-11-16).
const rankTile = (r: Award, place: string): ShareRank => ({
  value: i18n.t('card:rank.top', { tier: r.tier }), tier: r.tier, text: i18n.t('card:rank.tileOf', { place }),
})

/** The rank tiles of a building picture: only the scopes where the building stands out, in the page language. */
export function rankTexts(r: BuildingRanks): ShareRank[] {
  const tt = (key: string, o: { name: string }) => String(i18n.t(`card:${key}` as never, o as never))
  const wide = r.wide?.scope === 'barcelona' ? inPlace(tt, 'Barcelona') : i18n.t('card:rank.inMetro')
  return [...(r.local ? [rankTile(r.local.rank, inPlace(tt, r.local.name))] : []), ...(r.wide ? [rankTile(r.wide.rank, wide)] : [])]
}

interface AreaRef { name: string; kind: 'barri' | 'muni' }

const subtitleOf = (area: AreaRef | null) =>
  area ? (area.kind === 'barri' ? `${area.name}, Barcelona` : area.name) : null

export function buildingShareModel(input: {
  address: string | null
  area: AreaRef | null
  /** The score as the map colours it: the best case when the data is incomplete (060). */
  score: number
  summary: MatchSummary
  riskText: string | null
  profile: Pick<Profile, 'id' | 'name'> | null
  /** Where the building stands in its barri and the city (TODO-070). */
  ranks?: BuildingRanks | null
}): ShareModel {
  const band = matchBand(input.score)
  const ranks = input.ranks ? rankTexts(input.ranks) : []
  const rows: ShareRow[] = input.summary.rows.map((r) => ({ status: r.status, text: `${r.label}: ${r.text}` }))
  const risk: ShareRow[] = input.riskText ? [{ status: 'risk', text: input.riskText }] : []
  return {
    kind: 'building',
    place: firstAddress(input.address) ?? input.area?.name ?? 'Barcelona',
    subtitle: subtitleOf(input.area),
    forWhom: forWhom(input.profile),
    value: String(input.score),
    bandLabel: BAND_LABEL[band],
    band,
    bandColor: BAND_COLOR[band],
    caption: null,
    ranks,
    ranksHeading: ranks.length > 0 && !input.profile ? i18n.t('card:rank.heading') : null,
    rows: [...rows.slice(0, MAX_ROWS - risk.length), ...risk],
  }
}

export function areaShareModel(input: {
  rank: { name: string; kind: 'barri' | 'muni'; shareGood: number; mean: number; strongest: readonly ConditionId[] }
  profile: Pick<Profile, 'id' | 'name'> | null
}): ShareModel {
  const { rank } = input
  const band = matchBand(rank.mean)
  return {
    kind: 'area',
    place: rank.name,
    subtitle: rank.kind === 'barri' ? 'Barcelona' : i18n.t('card:share.metro'),
    forWhom: forWhom(input.profile),
    value: `${Math.round(rank.shareGood)}%`,
    bandLabel: BAND_LABEL[band],
    band,
    bandColor: BAND_COLOR[band],
    caption: i18n.t('card:share.areaCaption'),
    ranks: [],
    ranksHeading: null,
    rows: rank.strongest.slice(0, MAX_ROWS).map((id) => ({ status: 'met' as const, text: i18n.t('card:share.strongOn', { label: CONDITION_LABEL[id] }) })),
  }
}

/** "barcelona-livability-vila-de-gracia.png" */
export function shareFileName(place: string, ext: 'png' | 'jpg'): string {
  const slug = place.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `barcelona-livability${slug ? `-${slug}` : ''}.${ext}`
}

/** URL-safe name of an area: lower case, no accents; the code is added when two areas would share a name. */
export function areaSlug(name: string): string {
  return shareFileName(name, 'jpg').replace(/^barcelona-livability-?/, '').replace(/\.jpg$/, '') || 'area'
}

/**
 * Breaks `text` at spaces into lines no wider than `maxWidth` (`measure` gives the width of a string). A word wider
 * than the line stays on its own line. Past `maxLines` the last line is cut with an ellipsis.
 */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}
