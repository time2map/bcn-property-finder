import bbox from '@turf/bbox'
import type { AreaFeature, AreaKind } from './areas'
import { AREA_ALIASES } from './areaAliases'
import type { Bounds } from './bestZonesConfig'

const STOP_WORDS = new Set(['el', 'la', 'les', 'els', 'l', 'los', 'las', 'de', 'del', 'dels', 'd', 'i'])

/** Lowercase, no diacritics or punctuation, no articles/prepositions — "l'Hospitalet de Llobregat" → "hospitalet llobregat". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ')
}

export interface AreaMatch {
  label: string
  /** Shown under the label: "Barri", "District", "Municipality", "Several barris". */
  hint: string
  /** One id for a plain area, several for a colloquial name covering more than one barri. */
  areaIds: string[]
}

const KIND_ORDER: Record<AreaKind, number> = { barri: 0, district: 1, municipality: 2 }
const KIND_HINT: Record<AreaKind, string> = { barri: 'Barri', district: 'District', municipality: 'Municipality' }

interface Candidate extends AreaMatch {
  names: string[]
  alias: boolean
  kindOrder: number
}

function buildCandidates(areas: AreaFeature[]): Candidate[] {
  const ids = new Set(areas.map((a) => a.properties.id))
  const official: Candidate[] = areas.map((a) => ({
    label: a.properties.name,
    hint: KIND_HINT[a.properties.kind],
    areaIds: [a.properties.id],
    names: [normalizeName(a.properties.name)],
    alias: false,
    kindOrder: KIND_ORDER[a.properties.kind],
  }))
  const aliases: Candidate[] = AREA_ALIASES.flatMap((al) => {
    const present = al.areaIds.filter((id) => ids.has(id))
    if (present.length === 0) return []
    return [{
      label: al.name,
      hint: present.length > 1 ? 'Several barris' : 'Barri',
      areaIds: present,
      names: [al.name, ...(al.also ?? [])].map(normalizeName),
      alias: true,
      kindOrder: 3,
    }]
  })
  return [...official, ...aliases]
}

/** 0 exact, 1 starts with the query, 2 every query word starts a word of the name, null no match. */
function rank(names: string[], query: string, words: string[]): number | null {
  let best: number | null = null
  for (const name of names) {
    let r: number | null = null
    if (name === query) r = 0
    else if (name.startsWith(query)) r = 1
    else {
      const nameWords = name.split(' ')
      if (words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) r = 2
    }
    if (r !== null && (best === null || r < best)) best = r
  }
  return best
}

export function searchAreas(areas: AreaFeature[], rawQuery: string, limit = 8): AreaMatch[] {
  const query = normalizeName(rawQuery)
  if (!query) return []
  const words = query.split(' ')
  const ranked = buildCandidates(areas)
    .map((c) => ({ c, r: rank(c.names, query, words) }))
    .filter((x): x is { c: Candidate; r: number } => x.r !== null)
    .sort((a, b) =>
      a.r - b.r ||
      Number(a.c.alias) - Number(b.c.alias) ||
      a.c.kindOrder - b.c.kindOrder ||
      a.c.label.localeCompare(b.c.label),
    )
  const seen = new Set<string>()
  const out: AreaMatch[] = []
  for (const { c } of ranked) {
    const key = c.areaIds.join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label: c.label, hint: c.hint, areaIds: c.areaIds })
    if (out.length >= limit) break
  }
  return out
}

/** Merged bounds of the given areas, or null when none of the ids exists. */
export function areaIdsBounds(areas: AreaFeature[], ids: string[]): Bounds | null {
  const found = areas.filter((a) => ids.includes(a.properties.id))
  if (found.length === 0) return null
  const boxes = found.map((a) => bbox(a))
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ]
}
