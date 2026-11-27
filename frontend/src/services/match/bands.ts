// The match bands (TODO-050) without any text, so the scoring can use them too (TODO-073: the budget ceiling).

/** Lower edges of the great / good / partial bands; below the last one is poor. */
export type Bands = readonly [number, number, number]

export const DEFAULT_BANDS: Bands = [85, 65, 40]

/** Reads VITE_MATCH_BANDS ("85,65,40"); anything that is not three descending numbers gives the default. */
export function parseBands(raw: string | undefined): Bands {
  const parts = (raw ?? '').split(',').map((p) => Number(p.trim()))
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return DEFAULT_BANDS
  return parts[0] > parts[1] && parts[1] > parts[2] ? [parts[0], parts[1], parts[2]] : DEFAULT_BANDS
}

export const MATCH_BANDS = parseBands(import.meta.env.VITE_MATCH_BANDS)
