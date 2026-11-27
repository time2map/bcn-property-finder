// The funnel on the shipped data (TODO-076): the app must pick the same buildings as the simulations in
// scripts/simulate_one_building.py, which the tuning and the findings in the TODO rest on. The expected rows come from
//   python3 scripts/simulate_one_building.py --order <wishes> [--sea] --with-locals
// When the data is rebuilt the file hash changes and this test is skipped: rerun the script and update both.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { parseColumns, type BuildingData, type BuildingsMeta } from '../buildings/buildingData'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import { DEFAULT_FUNNEL_CONFIG } from './funnelConfig'
import { buildFunnelData, type WishId } from './funnelWishes'
import { finalPick, runFunnel } from './funnel'

const DATA = join(process.cwd(), 'public', 'data')
const SCORES_SHA = '7b8e61046243d53a'

const scoresFile = readFileSync(join(DATA, 'buildings-scores.bin.gz'))
const sameData = createHash('sha256').update(scoresFile).digest('hex').startsWith(SCORES_SHA)

const CASES: { order: WishId[]; sea: boolean; path: number[]; row: number }[] = [
  { order: ['quiet', 'metro', 'park', 'shops', 'cheap'], sea: false, path: [35604, 1905, 296, 48, 7, 3], row: 127933 },
  { order: ['centre', 'bars', 'metro', 'new', 'quiet'], sea: false, path: [35604, 2157, 494, 73, 9, 2], row: 115971 },
  { order: ['schools', 'park', 'cheap', 'quiet', 'health'], sea: false, path: [35604, 3585, 555, 49, 8, 3], row: 121570 },
  { order: ['quiet', 'centre', 'metro', 'shops', 'bars'], sea: true, path: [2111, 269, 51, 28, 9, 3], row: 131081 },
]

describe.skipIf(!sameData)('funnel on the shipped data matches the simulation', () => {
  const meta = JSON.parse(readFileSync(join(DATA, 'buildings-meta.json'), 'utf8')) as BuildingsMeta
  const buffers = {
    scores: new Uint8Array(gunzipSync(scoresFile)).buffer,
    positions: new Uint8Array(gunzipSync(readFileSync(join(DATA, 'buildings-positions.bin.gz')))).buffer,
  }
  const data: BuildingData = { meta, count: meta.count, cols: parseColumns(meta, buffers) }
  const vibe = JSON.parse(readFileSync(join(DATA, 'barri-vibe.json'), 'utf8')) as BarriVibeData
  const fd = buildFunnelData(data, vibe, DEFAULT_FUNNEL_CONFIG.minDwellings)

  it.each(CASES)('$order (sea: $sea)', ({ order, sea, path, row }) => {
    const run = runFunnel(fd, order, sea, DEFAULT_FUNNEL_CONFIG)
    expect([run.steps[0]?.before, ...run.steps.map((s) => s.after)]).toEqual(path)
    const result = finalPick(fd, run.alive, run.steps.map((s) => s.wish), DEFAULT_FUNNEL_CONFIG)
    expect(fd.rows[result.winner]).toBe(row)
  })
})
