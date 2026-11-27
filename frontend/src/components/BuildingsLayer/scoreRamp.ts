import type { ExpressionSpecification } from 'maplibre-gl'

// RdYlGn sequential ramp: low index = red (worse), high index = green (better).
export const SCORE_RAMP = [
  { stop: 0, color: '#d73027' },
  { stop: 25, color: '#fc8d59' },
  { stop: 50, color: '#fee08b' },
  { stop: 75, color: '#91cf60' },
  { stop: 100, color: '#1a9850' },
] as const

// TODO-032: the ramp is fitted to the buildings in view. The extreme TRIM_PCT% on each side don't stretch
// it (one outlier would take a whole end), and it never spans less than MIN_SPAN points (a 2-point
// difference in a zoomed-in area must not read as "bad" vs "great").
const TRIM_PCT = Number(import.meta.env.VITE_SCORE_SCALE_TRIM_PCT ?? 2)
const MIN_SPAN = Number(import.meta.env.VITE_SCORE_SCALE_MIN_SPAN ?? 20)

/** Whole-number colour range for the given scores (the visible buildings); null when there are none. */
export function fitScoreRange(scores: number[], trimPct = TRIM_PCT, minSpan = MIN_SPAN): [number, number] | null {
  if (scores.length === 0) return null
  const sorted = [...scores].sort((a, b) => a - b)
  const cut = Math.floor((sorted.length * trimPct) / 100)
  const min = Math.floor(sorted[cut])
  const max = Math.ceil(sorted[sorted.length - 1 - cut])
  if (max - min >= minSpan) return [min, max]
  const lo = Math.max(0, Math.min(100 - minSpan, Math.round((min + max - minSpan) / 2)))
  return [lo, lo + minSpan]
}

/** The absolute scale (TODO-050): 100 is the same green anywhere on the map. */
export const FIXED_RANGE: [number, number] = [0, 100]

/** Colour range of the map: fixed 0–100, or fitted to the visible buildings with "Boost contrast" on (null = none in view). */
export function colorRange(boost: boolean, inView: number[]): [number, number] | null {
  return boost ? fitScoreRange(inView) : FIXED_RANGE
}

/** Ramp stops spread over [min, max]. */
function rangeStops(min: number, max: number): (number | string)[] {
  const span = max - min
  return SCORE_RAMP.flatMap((s, i) => [min + span * (i / (SCORE_RAMP.length - 1)), s.color])
}

/**
 * The ramp on the feature-state `score` (TODO-046): scores are computed in JS and set as feature state, so
 * refitting the range only swaps the stops. Transparent until a score is set.
 */
export function buildStateColorForRange(min: number, max: number): ExpressionSpecification {
  const stops = min < max ? rangeStops(min, max) : SCORE_RAMP.flatMap((s) => [s.stop, s.color])
  return [
    'case',
    ['==', ['typeof', ['feature-state', 'score']], 'number'],
    ['interpolate', ['linear'], ['feature-state', 'score'], ...stops],
    'rgba(0,0,0,0)',
  ] as ExpressionSpecification
}
