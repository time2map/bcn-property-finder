// "Find your one building" funnel (TODO-076): how many steps, how many buildings to aim for after the last one, how
// much of the narrowing each step takes (the first is the strictest), and the smallest building that takes part.
// ENV: VITE_FUNNEL_STEPS, VITE_FUNNEL_TARGET, VITE_FUNNEL_STRICTNESS, VITE_FUNNEL_MIN_DWELLINGS. The defaults are the
// values tuned by scripts/explore_one_building.py and scripts/simulate_one_building.py.

export interface FunnelConfig {
  steps: number
  /** Buildings left after the last step, aimed at. */
  target: number
  /** One weight per step: the share of the remaining narrowing that the step takes. */
  strictness: number[]
  minDwellings: number
}

export const DEFAULT_FUNNEL_CONFIG: FunnelConfig = {
  steps: 5,
  target: 2,
  strictness: [3, 2.5, 2, 1.5, 1],
  minDwellings: 4,
}

interface RawFunnelEnv {
  steps?: string
  target?: string
  strictness?: string
  minDwellings?: string
}

function positive(raw: string | undefined, fallback: number, integer = false): number {
  const n = Number((raw ?? '').trim())
  if (!raw || !Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) return fallback
  return n
}

export function parseFunnelConfig(env: RawFunnelEnv): FunnelConfig {
  const d = DEFAULT_FUNNEL_CONFIG
  const steps = positive(env.steps, d.steps, true)
  const list = (env.strictness ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
  let strictness: number[]
  if (list.length > 0) strictness = list
  else if (steps === d.steps) strictness = d.strictness
  else strictness = [1]
  while (strictness.length < steps) strictness = [...strictness, strictness[strictness.length - 1]]
  return {
    steps,
    target: positive(env.target, d.target),
    strictness: strictness.slice(0, steps),
    minDwellings: positive(env.minDwellings, d.minDwellings, true),
  }
}

export const FUNNEL_CONFIG = parseFunnelConfig({
  steps: import.meta.env.VITE_FUNNEL_STEPS,
  target: import.meta.env.VITE_FUNNEL_TARGET,
  strictness: import.meta.env.VITE_FUNNEL_STRICTNESS,
  minDwellings: import.meta.env.VITE_FUNNEL_MIN_DWELLINGS,
})
