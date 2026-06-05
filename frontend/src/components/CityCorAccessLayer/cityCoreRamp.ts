import type { ExpressionSpecification } from 'maplibre-gl'

// Same RdYlGn ramp as livability so both layers read identically.
export const CITY_CORE_RAMP = [
  { stop: 0,   color: '#d73027' },
  { stop: 25,  color: '#fc8d59' },
  { stop: 50,  color: '#fee08b' },
  { stop: 75,  color: '#91cf60' },
  { stop: 100, color: '#1a9850' },
] as const

export const CITY_CORE_FILL_COLOR: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'index'],
  ...CITY_CORE_RAMP.flatMap((s) => [s.stop, s.color]),
] as ExpressionSpecification
