// Green → Purple: cheap = green (good), expensive = dark purple (bad)
export const PRICE_RAMP = [
  '#1b7837',
  '#4dac26',
  '#a6dba0',
  '#c2a5cf',
  '#9970ab',
  '#762a83',
  '#40004b',
] as const

export type PriceRampColor = (typeof PRICE_RAMP)[number]

export function buildPriceColorExpression(
  minPrice: number,
  maxPrice: number,
): unknown[] {
  if (minPrice >= maxPrice) return [PRICE_RAMP[0]]

  const step = (maxPrice - minPrice) / PRICE_RAMP.length
  const expr: unknown[] = ['step', ['get', 'price'], PRICE_RAMP[0]]

  for (let i = 1; i < PRICE_RAMP.length; i++) {
    expr.push(Math.round(minPrice + i * step), PRICE_RAMP[i])
  }
  return expr
}

export function buildIconImageExpression(
  iconNames: readonly string[],
  minPrice: number,
  maxPrice: number,
): unknown[] {
  if (minPrice >= maxPrice) return [iconNames[0]]
  const step = (maxPrice - minPrice) / iconNames.length
  const expr: unknown[] = ['step', ['get', 'price'], iconNames[0]]
  for (let i = 1; i < iconNames.length; i++) {
    expr.push(Math.round(minPrice + i * step), iconNames[i])
  }
  return expr
}

export function priceToColor(price: number, minPrice: number, maxPrice: number): PriceRampColor {
  if (minPrice >= maxPrice) return PRICE_RAMP[0]
  const ratio = Math.max(0, Math.min(1, (price - minPrice) / (maxPrice - minPrice)))
  const idx = Math.min(PRICE_RAMP.length - 1, Math.floor(ratio * PRICE_RAMP.length))
  return PRICE_RAMP[idx]
}
