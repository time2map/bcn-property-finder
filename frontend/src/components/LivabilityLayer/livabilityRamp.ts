import type { ExpressionSpecification } from 'maplibre-gl'

// RdYlGn sequential ramp: low index = red (worse), high index = green (better).
export const LIVABILITY_RAMP = [
  { stop: 0, color: '#d73027' },
  { stop: 25, color: '#fc8d59' },
  { stop: 50, color: '#fee08b' },
  { stop: 75, color: '#91cf60' },
  { stop: 100, color: '#1a9850' },
] as const

/** MapLibre fill-color expression interpolating the ramp over the cell `index` (0–100). */
export const LIVABILITY_FILL_COLOR: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'index'],
  ...LIVABILITY_RAMP.flatMap((s) => [s.stop, s.color]),
] as ExpressionSpecification
