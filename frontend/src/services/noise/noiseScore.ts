const QUIET_DB = 45   // score 100
const LOUD_DB  = 75   // score 0

export function noiseScore(lden: number): number {
  return Math.max(0, Math.min(100, Math.round((LOUD_DB - lden) / (LOUD_DB - QUIET_DB) * 100)))
}
