// What the UI needs to know about Best zones without loading the zone code (h3-js, turf): kept apart from
// services/bestZones.ts so that the page starts without them (TODO-058).

export type Bounds = [west: number, south: number, east: number, north: number]

export const DEFAULT_TOP_PCT = Number(import.meta.env.VITE_BEST_ZONES_TOP_PCT ?? 15)

// Strictness steps as "top X% of the visible grid cells": first = loose, last = strict. Above ~25% the good
// areas merge into one city-wide blob, so the loose end stops there.
export const TOP_PCT_STEPS = [25, 20, 15, 10, 7, 5]

/** Index of the step at or just below `topPct` (the strictest step when it is below all of them). */
export function stepIndex(topPct: number): number {
  const i = TOP_PCT_STEPS.findIndex((p) => p <= topPct)
  return i === -1 ? TOP_PCT_STEPS.length - 1 : i
}
