/**
 * Residents' view of each barri (042), from the Barcelona municipal services survey (ESM).
 * Baked by scripts/build_neighbourhood_vibe.py into public/data/barri-vibe.json.
 */
import { lazyLabels } from '../../i18n/format'
import { dataUrl } from '../dataUrl'

export const PROBLEM_IDS = [
  'insecurity', 'cleanliness', 'noise', 'housing', 'tourism', 'incivility', 'drugs_squats', 'maintenance', 'parking', 'traffic',
] as const
export type ProblemId = (typeof PROBLEM_IDS)[number]
/** Names of the problems in the page language (read on each use). */
export const PROBLEM_LABELS: Record<ProblemId, string> = lazyLabels('card:locals.p', PROBLEM_IDS)

export interface BarriVibe {
  name: string
  /** Interviews in the pooled survey years. */
  n: number
  /** n below VIBE_ESM_MIN_N: small sample, marked like missing data on the map. */
  lowN: boolean
  /** Satisfaction with living in the barri, 0–10 (raw barri mean, shown in the card). */
  satisf: number
  /** Satisfaction pulled towards the gran barri mean for small samples (used in the score). */
  satisfAdj: number
  /** "If I moved, I'd stay in this barri", %. */
  stay: number | null
  /** Satisfaction change vs 2015–19. */
  delta: number | null
  /** Share of residents naming each problem as the most serious one, %. */
  problems: Record<ProblemId, number | null>
}

export interface BarriVibeData {
  years: string
  /** Medians over the 73 barris. */
  city: { satisf: number; stay: number; problems: Record<ProblemId, number> }
  barris: Record<string, BarriVibe>
}

/** The `count` most-named problems of a barri, largest share first. */
export function topProblems(barri: BarriVibe, count = 3): { id: ProblemId; pct: number }[] {
  return [...PROBLEM_IDS]
    .map((id) => ({ id, pct: barri.problems[id] }))
    .filter((p): p is { id: ProblemId; pct: number } => p.pct !== null)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, count)
}

/** Populated after loadBarriVibe() resolves — for synchronous card lookups. */
export let barriVibeData: BarriVibeData | null = null

let cache: Promise<BarriVibeData> | null = null

export function loadBarriVibe(): Promise<BarriVibeData> {
  if (cache) return cache
  cache = fetch(dataUrl('barri-vibe.json'))
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load barri vibe: ${r.status}`)
      return r.json() as Promise<BarriVibeData>
    })
    .then((d) => {
      barriVibeData = d
      return d
    })
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}

export function resetBarriVibeCache(): void {
  cache = null
  barriVibeData = null
}
