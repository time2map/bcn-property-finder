/**
 * Percentile of each value among the others, 0..1, higher value = higher percentile (TODO-076). Tied values share
 * their mean rank; a missing value (NaN) gets 0 and is not counted. The same as `percentile()` in
 * scripts/explore_one_building.py, so the funnel in the app and the simulations agree.
 */
export function percentiles(values: ArrayLike<number>): Float64Array {
  const n = values.length
  const out = new Float64Array(n)
  const idx: number[] = []
  for (let i = 0; i < n; i++) if (!Number.isNaN(values[i])) idx.push(i)
  const m = idx.length
  if (m <= 1) return out
  idx.sort((a, b) => values[a] - values[b])
  let start = 0
  while (start < m) {
    let end = start
    while (end + 1 < m && values[idx[end + 1]] === values[idx[start]]) end++
    const rank = (start + end) / 2 / (m - 1)
    for (let k = start; k <= end; k++) out[idx[k]] = rank
    start = end + 1
  }
  return out
}
