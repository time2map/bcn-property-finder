import type { ExpressionSpecification } from 'maplibre-gl'

// RdYlGn sequential ramp: low index = red (worse), high index = green (better).
export const SCORE_RAMP = [
  { stop: 0, color: '#d73027' },
  { stop: 25, color: '#fc8d59' },
  { stop: 50, color: '#fee08b' },
  { stop: 75, color: '#91cf60' },
  { stop: 100, color: '#1a9850' },
] as const

/** MapLibre fill-color expression interpolating the ramp over a numeric property (0–100). */
export function buildScoreFillColor(property: string): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', property],
    ...SCORE_RAMP.flatMap((s) => [s.stop, s.color]),
  ] as ExpressionSpecification
}
