import { copyRawScores, type BuildingData } from './buildingData'
import { scoreAll, type BuildingSettings } from './buildingScore'
import type { FromWorker, ScoreResult, ToWorker } from './scoreProtocol'

// Scores every building off the main thread (TODO-058). The first call hands the worker a copy of the raw score
// blob (8 MB; the page keeps its own and decodes from it only the columns it reads) and later calls send only the
// settings. Where there is no worker (tests,
// old browsers, a worker that fails) the same scoreAll runs on the main thread, so the result is the same.

/** The part of a Worker the client uses (a fake in tests). */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  terminate(): void
}

interface Request {
  id: number
  data: BuildingData
  settings: BuildingSettings
  withComponents: boolean
  resolve: (result: ScoreResult | null) => void
}

export interface ScoreClient {
  /**
   * The score of every building for `settings`. Resolves with null when a newer request made this one pointless
   * (several settings changes while one scoring is running: only the newest is computed).
   */
  score(data: BuildingData, settings: BuildingSettings, withComponents: boolean): Promise<ScoreResult | null>
}

export function createScoreClient(makeWorker: () => WorkerLike | null): ScoreClient {
  let worker: WorkerLike | null = null
  let workerData: BuildingData | null = null
  /** The worker failed once: everything runs on the main thread from then on. */
  let disabled = false
  let nextId = 1
  let inFlight: Request | null = null
  let queued: Request | null = null

  const onMainThread = (r: Request): ScoreResult => scoreAll(r.data, r.settings, r.withComponents)

  function stopWorker() {
    worker?.terminate()
    worker = null
    workerData = null
  }

  /** After an error: the newest pending request is answered here, an older one is dropped. */
  function failWorker() {
    disabled = true
    stopWorker()
    const [old, newest] = queued ? [inFlight, queued] : [null, inFlight]
    inFlight = queued = null
    old?.resolve(null)
    if (newest) newest.resolve(onMainThread(newest))
  }

  function ensureWorker(data: BuildingData): boolean {
    if (disabled) return false
    if (worker && workerData === data) return true
    stopWorker()
    let w: WorkerLike | null
    try { w = makeWorker() } catch { w = null }
    if (!w) { disabled = true; return false }
    const raw = copyRawScores()
    if (!raw) { w.terminate(); return false }
    w.onmessage = (e) => receive(e.data)
    w.onerror = () => failWorker()
    w.postMessage({ type: 'init', meta: data.meta, buf: raw }, [raw])
    worker = w
    workerData = data
    return true
  }

  function send(r: Request) {
    inFlight = r
    worker!.postMessage({ type: 'score', id: r.id, settings: r.settings, withComponents: r.withComponents })
  }

  function receive(m: FromWorker) {
    if (m.type === 'error') {
      failWorker()
      return
    }
    const r = inFlight
    if (!r || r.id !== m.id) return
    inFlight = null
    r.resolve({ score: m.score, gap: m.gap, components: m.components })
    if (queued) {
      const next = queued
      queued = null
      send(next)
    }
  }

  return {
    score(data, settings, withComponents) {
      return new Promise((resolve) => {
        const r: Request = { id: nextId++, data, settings, withComponents, resolve }
        if (!ensureWorker(data)) {
          queueMicrotask(() => resolve(onMainThread(r)))
          return
        }
        if (inFlight) {
          queued?.resolve(null)
          queued = r
        } else {
          send(r)
        }
      })
    },
  }
}

/** The worker of the app; null where workers are not available (jsdom, very old browsers). */
function appWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null
  return new Worker(new URL('../../workers/score.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike
}

export const scoreClient = createScoreClient(appWorker)
