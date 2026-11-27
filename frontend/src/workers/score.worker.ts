import { parseColumns, type BuildingData } from '../services/buildings/buildingData'
import { scoreAll } from '../services/buildings/buildingScore'
import type { FromWorker, ToWorker } from '../services/buildings/scoreProtocol'

// Scoring worker (TODO-058). No DOM, no store: only the pure scoring code.
interface WorkerScope {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null
  postMessage(message: FromWorker, transfer: Transferable[]): void
}
const scope = self as unknown as WorkerScope

let data: BuildingData | null = null

scope.onmessage = (e) => {
  const m = e.data
  try {
    if (m.type === 'init') {
      data = { meta: m.meta, count: m.meta.count, cols: parseColumns(m.meta, m.buf) }
      return
    }
    if (!data) throw new Error('The scoring worker has no data yet')
    const r = scoreAll(data, m.settings, m.withComponents)
    const buffers = [r.score.buffer, r.gap.buffer, ...Object.values(r.components ?? {}).map((a) => a.buffer)]
    scope.postMessage({ type: 'result', id: m.id, score: r.score, gap: r.gap, components: r.components }, buffers)
  } catch (err) {
    scope.postMessage({ type: 'error', id: m.type === 'score' ? m.id : 0, message: err instanceof Error ? err.message : String(err) }, [])
  }
}
