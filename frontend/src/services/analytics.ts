import type { PinAnalytics } from '../types/pins'

const WEIGHTS = {
  walk:  Number(import.meta.env.VITE_WEIGHT_WALK  ?? 4),
  pt:    Number(import.meta.env.VITE_WEIGHT_PT    ?? 3),
  cycle: Number(import.meta.env.VITE_WEIGHT_CYCLE ?? 2),
  car:   Number(import.meta.env.VITE_WEIGHT_CAR   ?? 1),
}
const CAP_MINUTES = Number(import.meta.env.VITE_TRAVEL_CAP_MINUTES ?? 60)

const COMPOSITE_WEIGHT_TRAVEL = Number(import.meta.env.VITE_COMPOSITE_WEIGHT_TRAVEL ?? 5)
const COMPOSITE_WEIGHT_NOISE  = Number(import.meta.env.VITE_COMPOSITE_WEIGHT_NOISE  ?? 2)

export function computeTravelIndex(analytics: PinAnalytics): number | undefined {
  const modes = [
    { minutes: analytics.walkingMinutes,         weight: WEIGHTS.walk },
    { minutes: analytics.publicTransportMinutes, weight: WEIGHTS.pt },
    { minutes: analytics.cyclingMinutes,         weight: WEIGHTS.cycle },
    { minutes: analytics.drivingMinutes,         weight: WEIGHTS.car },
  ]

  const available = modes.filter((m) => m.minutes !== undefined)
  if (available.length === 0) return undefined

  const totalWeight = available.reduce((acc, m) => acc + m.weight, 0)
  const weightedSum = available.reduce((acc, m) => {
    const norm = Math.max(0, 1 - m.minutes! / CAP_MINUTES) ** 0.7
    return acc + norm * m.weight
  }, 0)

  return Math.round((weightedSum / totalWeight) * 100)
}

export function computeCompositeScore(analytics: PinAnalytics): number | undefined {
  const travel = analytics.travelIndex
  const noise  = analytics.noiseScore

  if (travel === undefined && noise === undefined) return undefined
  if (travel === undefined) return noise
  if (noise  === undefined) return travel

  return Math.round(
    (travel * COMPOSITE_WEIGHT_TRAVEL + noise * COMPOSITE_WEIGHT_NOISE) /
    (COMPOSITE_WEIGHT_TRAVEL + COMPOSITE_WEIGHT_NOISE),
  )
}
