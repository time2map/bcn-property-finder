import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createScoreClient, type WorkerLike } from './scoreClient'
import { scoreAll, type BuildingSettings } from './buildingScore'
import { parseColumns, type BuildingData, type BuildingsMeta } from './buildingData'
import { DEFAULT_CONDITIONS } from './conditions'
import type { FromWorker, ToWorker } from './scoreProtocol'

// Two buildings: a quiet one in a barri and a loud one in a municipality (columns as the blob stores them).
const META = {
  count: 2,
  columns: [
    { name: 'lden_avg', type: 'u8', scale: 1, offset: 0, sentinel: 255 },
    { name: 'area', type: 'u8', scale: 1, offset: 2, sentinel: 255 },
    { name: 'min_supermarket', type: 'u8', scale: 1, offset: 4, sentinel: 255 },
    { name: 'cc_sagrada', type: 'u8', scale: 1, offset: 6, sentinel: 255 },
  ],
  areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 4000 }, { code: '08101', name: 'Hospitalet', kind: 'muni', price: 2500 }],
  price_bounds: { p5: 2000, p95: 6000 }, categories: ['supermarket'], landmarks: ['sagrada'],
} as unknown as BuildingsMeta

const makeBlob = () => Uint8Array.from([50, 72, 0, 1, 3, 12, 10, 70]).buffer
const makeData = (): BuildingData => ({ meta: META, count: 2, cols: parseColumns(META, makeBlob()) })
const SETTINGS: BuildingSettings = {
  weights: { poiAccess: 1, noise: 1, cityCore: 1, openPrice: 1, localsOpinion: 0, age: 0 },
  conditions: DEFAULT_CONDITIONS, enabledLandmarkIds: ['sagrada'], enabledCategories: ['supermarket'],
  riskStrengths: { flood: 5, fire: 5, street: 5 }, ageEras: ['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'], vibe: null,
}

let raw: ArrayBuffer | null = null
vi.mock('./buildingData', async (orig) => ({
  ...(await orig<typeof import('./buildingData')>()),
  copyRawScores: () => (raw ? raw.slice(0) : null),
}))

/** A worker that answers like the real one (same scoreAll), by hand, so the test controls the timing. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  messages: ToWorker[] = []
  transfers: Transferable[][] = []
  terminated = false
  private data: BuildingData | null = null
  postMessage(m: ToWorker, transfer: Transferable[] = []) {
    this.messages.push(m)
    this.transfers.push(transfer)
    if (m.type === 'init') this.data = { meta: m.meta, count: m.meta.count, cols: parseColumns(m.meta, m.buf) }
  }
  /** The next score request the worker has not answered yet. */
  private unanswered = 0
  answerNext(fail?: string) {
    const requests = this.messages.filter((x): x is Extract<ToWorker, { type: 'score' }> => x.type === 'score')
    const m = requests[this.unanswered++]
    if (fail) { this.onmessage?.({ data: { type: 'error', id: m.id, message: fail } } as MessageEvent<FromWorker>); return }
    const r = scoreAll(this.data!, m.settings, m.withComponents)
    this.onmessage?.({ data: { type: 'result', id: m.id, score: r.score, gap: r.gap, components: r.components } } as MessageEvent<FromWorker>)
  }
  terminate() { this.terminated = true }
}

beforeEach(() => { raw = makeBlob() })

describe('scoreClient without a worker', () => {
  it('scores on the main thread, with the same result as scoreAll', async () => {
    const client = createScoreClient(() => null)
    const data = makeData()
    const r = await client.score(data, SETTINGS, false)
    const direct = scoreAll(data, SETTINGS, false)
    expect([...r!.score]).toEqual([...direct.score])
    expect([...r!.gap]).toEqual([...direct.gap])
    expect(r!.components).toBeUndefined()
  })

  it('gives the score of each condition when asked', async () => {
    const r = await createScoreClient(() => null).score(makeData(), SETTINGS, true)
    expect(r!.components!.noise).toHaveLength(2)
    expect(r!.components!.noise[0]).toBeGreaterThan(r!.components!.noise[1])
  })

  it('leaves the raw blob alone (the page decodes its columns from it)', async () => {
    const before = raw
    await createScoreClient(() => null).score(makeData(), SETTINGS, false)
    expect(raw).toBe(before)
  })

  it('also falls back when the worker cannot be made', async () => {
    const client = createScoreClient(() => { throw new Error('no module workers') })
    expect(await client.score(makeData(), SETTINGS, false)).not.toBeNull()
  })
})

describe('scoreClient with a worker', () => {
  it('hands the worker the raw blob once, then asks for scores', async () => {
    const worker = new FakeWorker()
    const client = createScoreClient(() => worker)
    const data = makeData()
    const first = client.score(data, SETTINGS, false)
    worker.answerNext()
    await first
    const second = client.score(data, { ...SETTINGS, conditions: { ...SETTINGS.conditions, noiseMaxDb: 55 } }, false)
    worker.answerNext()
    await second
    expect(worker.messages.map((m) => m.type)).toEqual(['init', 'score', 'score'])
    // The worker gets its own copy (transferred to it); the page keeps the blob for its columns.
    expect(worker.transfers[0]).toHaveLength(1)
    expect(worker.transfers[0][0]).not.toBe(raw)
    expect(raw!.byteLength).toBeGreaterThan(0)
  })

  it('returns what the worker computed, the same as scoreAll', async () => {
    const worker = new FakeWorker()
    const client = createScoreClient(() => worker)
    const data = makeData()
    const p = client.score(data, SETTINGS, true)
    worker.answerNext()
    const r = await p
    const direct = scoreAll(data, SETTINGS, true)
    expect([...r!.score]).toEqual([...direct.score])
    expect([...r!.components!.noise]).toEqual([...direct.components!.noise])
  })

  it('only the newest of several requests is computed; the ones in between are dropped (null)', async () => {
    const worker = new FakeWorker()
    const client = createScoreClient(() => worker)
    const data = makeData()
    const a = client.score(data, SETTINGS, false)
    const b = client.score(data, { ...SETTINGS, conditions: { ...SETTINGS.conditions, noiseMaxDb: 55 } }, false)
    const c = client.score(data, { ...SETTINGS, conditions: { ...SETTINGS.conditions, noiseMaxDb: 50 } }, false)
    expect(await b).toBeNull()
    worker.answerNext() // a is computed
    expect(await a).not.toBeNull()
    worker.answerNext() // then only c; b never reached the worker
    expect(await c).not.toBeNull()
    expect(worker.messages.filter((m) => m.type === 'score')).toHaveLength(2)
  })

  it('a worker error is answered on the main thread, and the worker is not used again', async () => {
    const worker = new FakeWorker()
    const client = createScoreClient(() => worker)
    const data = makeData()
    const p = client.score(data, SETTINGS, false)
    worker.answerNext('boom')
    const r = await p
    expect([...r!.score]).toEqual([...scoreAll(data, SETTINGS, false).score])
    expect(worker.terminated).toBe(true)
    const later = await client.score(data, SETTINGS, false)
    expect(later).not.toBeNull()
    expect(worker.messages.filter((m) => m.type === 'score')).toHaveLength(1)
  })

  it('a crashed worker (onerror) is handled the same way', async () => {
    const worker = new FakeWorker()
    const client = createScoreClient(() => worker)
    const data = makeData()
    const p = client.score(data, SETTINGS, false)
    worker.onerror?.({ message: 'crash' } as ErrorEvent)
    expect(await p).not.toBeNull()
    expect(worker.terminated).toBe(true)
  })

  it('new data starts the worker over', async () => {
    const first = new FakeWorker()
    const second = new FakeWorker()
    const workers = [first, second]
    const client = createScoreClient(() => workers.shift()!)
    const p1 = client.score(makeData(), SETTINGS, false)
    first.answerNext()
    await p1
    raw = makeBlob()
    const p2 = client.score(makeData(), SETTINGS, false)
    expect(first.terminated).toBe(true)
    second.answerNext()
    await p2
    expect(second.messages.map((m) => m.type)).toEqual(['init', 'score'])
  })

  it('with no raw blob (data that was not loaded from the blob) it scores on the main thread', async () => {
    raw = null
    const worker = new FakeWorker()
    const r = await createScoreClient(() => worker).score(makeData(), SETTINGS, false)
    expect(r).not.toBeNull()
    expect(worker.messages).toHaveLength(0)
    expect(worker.terminated).toBe(true)
  })
})
