/**
 * Building-level Livability Index data (TODO-046, stage 4): score inputs of every residential building,
 * baked by scripts/build_building_tiles.py into public/data/buildings-scores.bin.gz, buildings-positions.bin.gz
 * and buildings-meta.json (format: scripts/building_blob.py). Row i is the feature id of building i in
 * buildings.pmtiles.
 *
 * Two loads (TODO-058): loadScores() brings what the scoring reads (1 MB), loadBuildings() then adds the positions
 * (0.5 MB), which only the card, Boost contrast and best zones need. Both give the same object.
 */

import { afterFirstPaint } from '../firstPaint'
import { dataUrl } from '../dataUrl'

export interface BuildingArea {
  /** Barri code ('01'…'73', Barcelona) or INE municipality code. */
  code: string
  name: string
  kind: 'barri' | 'muni'
  /** INCASOL sale price, €/m²; null = no data. */
  price: number | null
}

/** The binary files of the columns; format 1 had only `scores`. */
export type ColumnFile = 'scores' | 'positions'

export const COLUMN_FILES: Record<ColumnFile, string> = {
  scores: 'buildings-scores.bin.gz',
  positions: 'buildings-positions.bin.gz',
}

interface Column {
  name: string
  type: 'u8' | 'u16' | 'f32'
  scale: number
  /** Byte offset in its file. */
  offset: number
  /** Raw value meaning "no data"; null for f32 (NaN). */
  sentinel: number | null
  /** The file the column is in; absent (format 1) = scores. */
  file?: ColumnFile
  /** 'planes': the bytes of the values are stored by position (all bytes 0, then all bytes 1, …). Absent = plain. */
  layout?: 'plain' | 'planes'
}

/** Decompressed column files; a column whose file is not given is left out. A bare buffer = the scores file. */
export type ColumnBuffers = Partial<Record<ColumnFile, ArrayBuffer>> | ArrayBuffer

export interface BuildingsMeta {
  /** Date the data was built (YYYY-MM-DD). */
  generated?: string
  /** Date each source was fetched, by registry id (TODO-066); written by the fetch scripts. */
  sources?: Record<string, string>
  count: number
  columns: Column[]
  areas: BuildingArea[]
  price_bounds: { p5: number; p95: number }
  /** Walkability category ids (walk_<id> columns). */
  categories: string[]
  /** City Core landmark ids (cc_<id> columns). */
  landmarks: string[]
  /**
   * How far the minutes columns reach (TODO-073): beyond it the data has no value. `walk` for `min_<category>`,
   * `cityCore` for `cc_<landmark>`. Absent in files built before 073: see `DEFAULT_MINUTES_CAP`.
   */
  minutes_cap?: MinutesCap
}

export interface MinutesCap {
  walk: number
  cityCore: number
}

/** Reach of the files built before TODO-073: services to 1.5 km at 80 m/min, City Core places to 90 min. */
export const DEFAULT_MINUTES_CAP: MinutesCap = { walk: 1500 / 80, cityCore: 90 }

export function minutesCapOf(meta: Pick<BuildingsMeta, 'minutes_cap'>): MinutesCap {
  return meta.minutes_cap ?? DEFAULT_MINUTES_CAP
}

export interface BuildingData {
  meta: BuildingsMeta
  count: number
  /** Decoded columns: value / scale, NaN = no data. */
  cols: Record<string, Float32Array>
}

const ARRAYS = { u8: Uint8Array, u16: Uint16Array, f32: Float32Array } as const

const fileOf = (c: Column): ColumnFile => c.file ?? 'scores'
const buffersOf = (b: ColumnBuffers): Partial<Record<ColumnFile, ArrayBuffer>> => (b instanceof ArrayBuffer ? { scores: b } : b)

/** The typed array of a column as stored: plain, or put back together from its byte planes. */
function rawColumn(c: Column, count: number, buf: ArrayBuffer): Uint8Array | Uint16Array | Float32Array {
  const T = ARRAYS[c.type]
  if (c.layout !== 'planes' || T.BYTES_PER_ELEMENT === 1) return new T(buf, c.offset, count)
  const k = T.BYTES_PER_ELEMENT
  const planes = new Uint8Array(buf, c.offset, count * k)
  const bytes = new Uint8Array(count * k)
  for (let b = 0; b < k; b++) {
    const from = b * count
    for (let i = 0; i < count; i++) bytes[i * k + b] = planes[from + i]
  }
  return new T(bytes.buffer)
}

function decodeColumn(c: Column, count: number, buf: ArrayBuffer): Float32Array {
  const raw = rawColumn(c, count, buf)
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const v = raw[i]
    out[i] = c.sentinel !== null && v === c.sentinel ? NaN : v / c.scale
  }
  return out
}

/** Typed-array columns of the given files → decoded Float32 columns (NaN for the sentinel). */
export function parseColumns(meta: Pick<BuildingsMeta, 'count' | 'columns'>, buffers: ColumnBuffers): Record<string, Float32Array> {
  const files = buffersOf(buffers)
  const cols: Record<string, Float32Array> = {}
  for (const c of meta.columns) {
    const buf = files[fileOf(c)]
    if (buf) cols[c.name] = decodeColumn(c, meta.count, buf)
  }
  return cols
}

/**
 * Adds the columns of the given files to `cols`, each decoded when it is first read (TODO-058). The page itself
 * reads a few of the 33 (position, area, the values of one building for its card); all of them are decoded only
 * in the scoring worker, or here when there is no worker.
 */
export function addLazyColumns(
  cols: Record<string, Float32Array>,
  meta: Pick<BuildingsMeta, 'count' | 'columns'>,
  buffers: ColumnBuffers,
): Record<string, Float32Array> {
  const files = buffersOf(buffers)
  for (const c of meta.columns) {
    const buf = files[fileOf(c)]
    if (!buf) continue
    Object.defineProperty(cols, c.name, {
      enumerable: true,
      configurable: true,
      get() {
        const value = decodeColumn(c, meta.count, buf)
        Object.defineProperty(cols, c.name, { value, enumerable: true })
        return value
      },
    })
  }
  return cols
}

/** The same columns as parseColumns, each decoded when it is first read. */
export function lazyColumns(meta: Pick<BuildingsMeta, 'count' | 'columns'>, buffers: ColumnBuffers): Record<string, Float32Array> {
  return addLazyColumns({}, meta, buffers)
}

/** True when the meta has columns in the positions file (format 2). */
export function hasPositionsFile(meta: Pick<BuildingsMeta, 'columns'>): boolean {
  return meta.columns.some((c) => fileOf(c) === 'positions')
}

/** The blob is gzipped; a server that already decoded it (Content-Encoding) hands over raw bytes. */
export async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf
  return new Response(new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

/** Value of a decoded column, null when missing. */
export function valueOf(data: BuildingData, name: string, i: number): number | null {
  const v = data.cols[name]?.[i]
  return v === undefined || Number.isNaN(v) ? null : v
}

/** Populated after loadBuildings() resolves (scores and positions) — for synchronous card lookups. */
export let buildingData: BuildingData | null = null

/** The decompressed scores file: the columns above are decoded from it when they are first read. */
let rawScores: ArrayBuffer | null = null

/** A copy of the scores file of the loaded data, for the scoring worker (TODO-058); null when nothing is loaded. */
export function copyRawScores(): ArrayBuffer | null {
  return rawScores ? rawScores.slice(0) : null
}


async function fetchColumnFile(file: ColumnFile, init?: RequestInit): Promise<ArrayBuffer> {
  const r = await fetch(dataUrl(COLUMN_FILES[file]), init)
  if (!r.ok) throw new Error(`Failed to load building ${file}: ${r.status}`)
  return gunzipIfNeeded(await r.arrayBuffer())
}

let metaCache: Promise<BuildingsMeta> | null = null

/** buildings-meta.json (12 KB, preloaded by index.html): columns, areas, price bounds. */
export function loadBuildingsMeta(): Promise<BuildingsMeta> {
  metaCache ??= fetch(dataUrl('buildings-meta.json'))
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load buildings meta: ${r.status}`)
      return r.json() as Promise<BuildingsMeta>
    })
    .catch((err) => {
      metaCache = null
      throw err
    })
  return metaCache
}

let scoresCache: Promise<BuildingData> | null = null

/** Meta and the score columns: everything the scoring needs. No positions (`lng`, `lat`) yet. */
export function loadScores(): Promise<BuildingData> {
  // After the first paint (TODO-058): downloading and unpacking the scores and what follows (scoring, shares)
  // would otherwise compete with it. Ahead of the other data files of the page: nothing is coloured without it.
  scoresCache ??= afterFirstPaint()
    .then(() => Promise.all([loadBuildingsMeta(), fetchColumnFile('scores', { priority: 'high' })]))
    .then(([meta, buf]) => {
      rawScores = buf
      return { meta, count: meta.count, cols: lazyColumns(meta, { scores: buf }) }
    })
    .catch((err) => {
      scoresCache = null
      throw err
    })
  return scoresCache
}

let cache: Promise<BuildingData> | null = null

/** All the columns: loadScores(), then the positions file (asked for once the scores are in, not to slow them). */
export function loadBuildings(): Promise<BuildingData> {
  cache ??= loadScores()
    .then(async (data) => {
      if (hasPositionsFile(data.meta) && data.cols.lng === undefined) {
        addLazyColumns(data.cols, data.meta, { positions: await fetchColumnFile('positions') })
      }
      buildingData = data
      return data
    })
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}

export function resetBuildingsCache(): void {
  metaCache = null
  scoresCache = null
  cache = null
  buildingData = null
  rawScores = null
}
