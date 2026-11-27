/**
 * The "find your one building" funnel (TODO-076). The person picks wishes in order of importance; each pick keeps the
 * best share of the buildings still in play, computed so that the last step ends near the target (an adaptive ladder:
 * a fixed share per step ends too early or not at all, see the TODO). The winner is the best of those left on the
 * picked wishes weighted by their order; the others left are "your spot". Mirrors World.funnel() in
 * scripts/simulate_one_building.py, so the app and the simulations agree.
 */
import type { FunnelConfig } from './funnelConfig'
import type { FunnelData, WishId } from './funnelWishes'

export interface FunnelStep {
  wish: WishId
  before: number
  after: number
  /** The worst goodness that was kept (for "the 3,560 quietest: up to 52 dB"). */
  threshold: number
}

/** `FunnelRun.outAt`: not in play from the start (the sea), or still in play after the last step. */
export const NOT_IN_PLAY = 0
export const STILL_IN = 255

export interface FunnelRun {
  /** Indexes into the funnel data (not building rows) of the buildings left, ascending. */
  alive: Int32Array
  steps: FunnelStep[]
  /** Per building of the funnel data: the step (1-based) it dropped out at, NOT_IN_PLAY or STILL_IN. For the map. */
  outAt: Uint8Array
}

export interface FunnelResult {
  winner: number
  /** The other buildings left, best first. */
  spot: number[]
  /** The winner's percentile among the buildings that take part, per wish picked. */
  pct: { wish: WishId; pct: number }[]
}

/** A wish that would keep more than this share of the buildings left is not offered: it cannot narrow anything. */
export const MAX_KEPT_SHARE = 0.9

/** Every building that takes part, or only those within reach of the sea. */
export function startAlive(fd: FunnelData, sea: boolean): Int32Array {
  const out: number[] = []
  for (let k = 0; k < fd.rows.length; k++) if (!sea || fd.seaOk[k]) out.push(k)
  return Int32Array.from(out)
}

/** Share of the `left` buildings that step `step` (0-based) keeps. */
export function stepShare(left: number, step: number, cfg: FunnelConfig): number {
  if (left <= 1) return 1
  const rest = cfg.strictness.slice(step)
  const total = rest.reduce((a, b) => a + b, 0)
  const k = (cfg.target / left) ** ((rest[0] ?? 1) / (total || 1))
  return Math.min(Math.max(k, 1 / left), 1)
}

/** Keeps the buildings at or above the quantile of the step; ties stay together, no data counts as the worst. */
export function cutBy(fd: FunnelData, alive: Int32Array, wish: WishId, step: number, cfg: FunnelConfig): { alive: Int32Array; threshold: number } {
  const col = fd.values[wish]
  if (!col || alive.length === 0) return { alive, threshold: NaN }
  const v = Float64Array.from(alive, (k) => (Number.isNaN(col[k]) ? -Infinity : col[k]))
  const sorted = Float64Array.from(v).sort()
  const k = stepShare(alive.length, step, cfg)
  // numpy.quantile(v, 1 - k, method="higher")
  const threshold = sorted[Math.ceil((1 - k) * (sorted.length - 1))]
  const kept: number[] = []
  for (let j = 0; j < alive.length; j++) if (v[j] >= threshold) kept.push(alive[j])
  return { alive: Int32Array.from(kept), threshold }
}

export function canCut(fd: FunnelData, alive: Int32Array, wish: WishId, step: number, cfg: FunnelConfig): boolean {
  return cutBy(fd, alive, wish, step, cfg).alive.length <= MAX_KEPT_SHARE * alive.length
}

/** Applies the picks in order, at most `cfg.steps` of them; a pick that cannot cut is skipped. */
export function runFunnel(fd: FunnelData, picks: readonly WishId[], sea: boolean, cfg: FunnelConfig): FunnelRun {
  let alive = startAlive(fd, sea)
  const outAt = new Uint8Array(fd.rows.length).fill(NOT_IN_PLAY)
  for (const k of alive) outAt[k] = STILL_IN
  const steps: FunnelStep[] = []
  for (const wish of picks) {
    if (steps.length === cfg.steps || alive.length <= 1) break
    const cut = cutBy(fd, alive, wish, steps.length, cfg)
    if (cut.alive.length > MAX_KEPT_SHARE * alive.length) continue
    steps.push({ wish, before: alive.length, after: cut.alive.length, threshold: cut.threshold })
    for (const k of alive) outAt[k] = steps.length
    for (const k of cut.alive) outAt[k] = STILL_IN
    alive = cut.alive
  }
  return { alive, steps, outAt }
}

/** The best of the buildings left on the picks, the first pick weighing most (steps, steps − 1, …). */
export function finalPick(fd: FunnelData, alive: Int32Array, picks: readonly WishId[], cfg: FunnelConfig): FunnelResult {
  const score = (k: number) => picks.reduce((s, w, j) => s + (cfg.steps - j) * (fd.pct[w]?.[k] ?? 0), 0)
  const ranked = Array.from(alive).map((k, order) => ({ k, s: score(k), order }))
  ranked.sort((a, b) => b.s - a.s || a.order - b.order)
  const winner = ranked[0]?.k ?? -1
  return {
    winner,
    spot: ranked.slice(1).map((r) => r.k),
    pct: picks.map((wish) => ({ wish, pct: fd.pct[wish]?.[winner] ?? 0 })),
  }
}

/** Percentile 0..1 → "top N%" of the city, N at least 1. */
export function topPercent(pct: number): number {
  return Math.max(1, Math.ceil((1 - pct) * 100 - 1e-9))
}
