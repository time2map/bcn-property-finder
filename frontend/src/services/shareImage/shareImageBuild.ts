import type { AreaFeature } from '../areas'
import { joinAreas } from '../areas/areaJoin'
import { rankAreas, type AreaRank } from '../areas/areaRank'
import { scoreAll } from '../buildings/buildingScore'
import { addLazyColumns, type BuildingsMeta, type BuildingData, type ColumnFile } from '../buildings/buildingData'
import type { ScoreSettings } from '../buildings/firstVisit'
import { firstVisitSettings } from '../buildings/firstVisit'
import { profileToPatch, type Profile } from '../conditionOptions'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import type { ConditionId } from '../match/matchSummary'
import { PRESETS, profileName } from '../presets'
import { areaSlug } from './shareImageModel'

export { areaSlug }

// The share pages and images made at build time (TODO-063): for every barri and every profile, a small static
// page with its own link-preview tags (Open Graph needs them in the HTML; a script cannot set them for a crawler)
// and a picture. The page sends people on to the map with the profile's conditions.

/** What the profile asks for, as the building score takes it. */
export function scoreSettingsOfProfile(p: Profile): ScoreSettings {
  const patch = profileToPatch(p)
  const base = firstVisitSettings()
  return {
    weights: patch.weights ?? base.weights,
    conditions: patch.conditions ?? base.conditions,
    enabledLandmarkIds: patch.landmarkIds ?? base.enabledLandmarkIds,
    enabledCategories: patch.walkCategories ?? base.enabledCategories,
    riskStrengths: patch.riskStrengths ?? base.riskStrengths,
    ageEras: patch.eras ?? base.ageEras,
  }
}

export interface ProfileRanks {
  /** null = the settings of a first visit (the site image). */
  profile: Profile | null
  ranks: AreaRank[]
}

export interface ShareFiles {
  meta: BuildingsMeta
  columns: Record<ColumnFile, ArrayBuffer | undefined>
  areas: { features: AreaFeature[] }
  vibe: BarriVibeData | null
}

/** Area ranks for the first-visit settings and for every profile, from the same scoring the map uses. */
export function rankProfiles(files: ShareFiles, profiles: readonly Profile[] = PRESETS): {
  results: ProfileRanks[]
  join: Map<number, AreaFeature>
} {
  const { meta } = files
  const data: BuildingData = { meta, count: meta.count, cols: addLazyColumns({}, meta, files.columns) }
  const { cols } = data
  const join = joinAreas(meta.areas, cols.area, cols.lng, cols.lat, files.areas.features)
  const run = (profile: Profile | null): ProfileRanks => {
    const settings = profile ? scoreSettingsOfProfile(profile) : firstVisitSettings()
    const { score, gap, components } = scoreAll(data, { ...settings, vibe: files.vibe }, true)
    const on = (Object.keys(components!) as ConditionId[]).filter((k) => (settings.weights[k] ?? 0) > 0)
    return { profile, ranks: rankAreas(score, cols.area, meta.areas, components!, on, undefined, undefined, gap, undefined, cols.dwellings) }
  }
  return { results: [null, ...profiles].map(run), join }
}

/** One page: where it is, what it says. */
export interface SharePage {
  profile: Profile
  rank: AreaRank
  /** "family/gracia": the folder of the page; the picture is `<path>.jpg` next to it. */
  path: string
}

/** The pages of the barris of every profile (municipalities of the metro area stay out of the launch set). */
export function sharePages(results: readonly ProfileRanks[]): SharePage[] {
  const pages: SharePage[] = []
  for (const { profile, ranks } of results) {
    if (!profile) continue
    const seen = new Set<string>()
    for (const rank of ranks) {
      if (rank.kind !== 'barri' || !rank.ranked) continue
      let slug = areaSlug(rank.name)
      if (seen.has(slug)) slug = `${slug}-${rank.code}`
      seen.add(slug)
      pages.push({ profile, rank, path: `${profile.id}/${slug}` })
    }
  }
  return pages
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The profile in words for a sentence: "a family", "a remote worker". */
const AS_WORDS: Record<string, string> = {
  family: 'a family', remote: 'a remote worker', city: 'city life', retiree: 'a retiree',
}

/** Title and description of a barri page. */
export function pageTexts(page: SharePage): { title: string; description: string } {
  const pct = Math.round(page.rank.shareGood)
  const who = AS_WORDS[page.profile.id] ?? profileName(page.profile)
  return {
    title: `${page.rank.name}: ${pct}% of homes fit ${who} · Barcelona livability map`,
    description:
      `${pct}% of the homes in ${page.rank.name}, Barcelona are a good match for ${who}. ` +
      'Noise, daily services, prices and risks for every building, scored against your own conditions.',
  }
}

/**
 * The static page of a barri: the link-preview tags, and a redirect to the map with the profile's conditions and
 * the view on the barri. `siteUrl` has no trailing slash (and may have a path, on a fork).
 */
export function pageHtml(page: SharePage, siteUrl: string, view: { lng: number; lat: number; zoom: number }): string {
  const { title, description } = pageTexts(page)
  const url = `${siteUrl}/share/${page.path}/`
  const image = `${siteUrl}/share/${page.path}.jpg`
  const map = `${siteUrl}/?c=preset:${page.profile.id}&zoom=${view.zoom.toFixed(2)}&cx=${view.lng.toFixed(5)}&cy=${view.lat.toFixed(5)}&a=${encodeURIComponent(page.rank.code)}`
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="time2map livability" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(map)}" />
</head>
<body>
<p><a href="${escapeHtml(map)}">Open ${escapeHtml(page.rank.name)} on the Barcelona livability map</a></p>
<script>location.replace(${JSON.stringify(map)})</script>
</body>
</html>
`
}
