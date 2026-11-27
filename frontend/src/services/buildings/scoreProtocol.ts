import type { BuildingsMeta } from './buildingData'
import type { BuildingSettings } from './buildingScore'

// Messages between the main thread and the scoring worker (TODO-058). Scoring all buildings takes 0.2–2 s,
// so it runs off the main thread: the worker decodes its own copy of the score columns once and answers each
// settings change with the score of every building as transferable Uint8Arrays.

export type ConditionArrays = Record<'poiAccess' | 'noise' | 'cityCore' | 'openPrice' | 'localsOpinion' | 'age', Uint8Array>

export type ToWorker =
  | { type: 'init'; meta: BuildingsMeta; buf: ArrayBuffer }
  | { type: 'score'; id: number; settings: BuildingSettings; withComponents: boolean }

export type FromWorker =
  | { type: 'result'; id: number; score: Uint8Array; gap: Uint8Array; components?: ConditionArrays }
  | { type: 'error'; id: number; message: string }

export interface ScoreResult {
  score: Uint8Array
  gap: Uint8Array
  /** The score of each condition (255 = no data); only when asked for (the area ranking, 051). */
  components?: ConditionArrays
}
