import type { ExpressionSpecification } from 'maplibre-gl'

// RdYlGn sequential ramp: low index = red (worse), high index = green (better).
export const SCORE_RAMP = [
  { stop: 0, color: '#d73027' },
  { stop: 25, color: '#fc8d59' },
  { stop: 50, color: '#fee08b' },
  { stop: 75, color: '#91cf60' },
  { stop: 100, color: '#1a9850' },
] as const

/** Full 0–100 fill-color expression for a numeric property. */
export function buildScoreFillColor(property: string): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', property],
    ...SCORE_RAMP.flatMap((s) => [s.stop, s.color]),
  ] as ExpressionSpecification
}

/**
 * Fill-color expression remapped so that score=min → red and score=max → green.
 * Ramp stops are distributed proportionally within [min, max].
 */
export function buildScoreFillColorForRange(
  min: number,
  max: number,
  property: string,
): ExpressionSpecification {
  if (min >= max) return buildScoreFillColor(property)
  const span = max - min
  return [
    'interpolate',
    ['linear'],
    ['get', property],
    ...SCORE_RAMP.flatMap((s, i) => [
      min + span * (i / (SCORE_RAMP.length - 1)),
      s.color,
    ]),
  ] as ExpressionSpecification
}
