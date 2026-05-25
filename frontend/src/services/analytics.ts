import type { PinAnalytics } from '../types/pins'

const WEIGHTS = { walk: 4, pt: 3, cycle: 2, car: 1 }
const CAP_MINUTES = 60

export function computeTravelIndex(analytics: PinAnalytics): number | undefined {
  const modes = [
    { minutes: analytics.walkingMinutes, weight: WEIGHTS.walk },
    { minutes: analytics.publicTransportMinutes, weight: WEIGHTS.pt },
    { minutes: analytics.cyclingMinutes, weight: WEIGHTS.cycle },
    { minutes: analytics.drivingMinutes, weight: WEIGHTS.car },
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
