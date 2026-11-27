import { gzipSync } from 'node:zlib'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyRawScores, gunzipIfNeeded, hasPositionsFile, lazyColumns, loadBuildings, loadScores, parseColumns, resetBuildingsCache, valueOf, type BuildingsMeta } from './buildingData'

/** Two buildings; the second has no data in any column (sentinels). */
function blob(): { meta: Pick<BuildingsMeta, 'count' | 'columns'>; buf: ArrayBuffer } {
  const buf = new ArrayBuffer(16)
  new Float32Array(buf, 0, 2).set([2.17, NaN])
  new Uint16Array(buf, 8, 2).set([624, 65535])
  new Uint8Array(buf, 12, 2).set([87, 255])
  return {
    meta: {
      count: 2,
      columns: [
        { name: 'lng', type: 'f32', scale: 1, offset: 0, sentinel: null },
        { name: 'lden_avg', type: 'u16', scale: 10, offset: 8, sentinel: 65535 },
        { name: 'walk_park', type: 'u8', scale: 1, offset: 12, sentinel: 255 },
      ],
    },
    buf,
  }
}

describe('parseColumns', () => {
  it('decodes scale and sentinels', () => {
    const { meta, buf } = blob()
    const cols = parseColumns(meta, buf)
    expect(cols.lng[0]).toBeCloseTo(2.17, 5)
    expect(cols.lden_avg[0]).toBeCloseTo(62.4, 5)
    expect(cols.walk_park[0]).toBe(87)
    expect([cols.lng[1], cols.lden_avg[1], cols.walk_park[1]].every(Number.isNaN)).toBe(true)
  })

  it('valueOf turns missing values into null', () => {
    const { meta, buf } = blob()
    const data = { meta: { ...meta, areas: [], price_bounds: { p5: 0, p95: 1 }, categories: [], landmarks: [] }, count: 2, cols: parseColumns(meta, buf) }
    expect(valueOf(data, 'walk_park', 0)).toBe(87)
    expect(valueOf(data, 'walk_park', 1)).toBeNull()
    expect(valueOf(data, 'no_such_column', 0)).toBeNull()
  })
})

describe('lazyColumns', () => {
  it('gives the same columns as parseColumns', () => {
    const { meta, buf } = blob()
    const [lazy, eager] = [lazyColumns(meta, buf), parseColumns(meta, buf)]
    expect(Object.keys(lazy)).toEqual(Object.keys(eager))
    for (const name of Object.keys(eager)) expect([...lazy[name]]).toEqual([...eager[name]])
    expect(lazy.no_such_column).toBeUndefined()
  })

  it('decodes a column once, when it is first read', () => {
    const { meta, buf } = blob()
    const spy = vi.spyOn(globalThis, 'Float32Array')
    const cols = lazyColumns(meta, buf)
    expect(spy).not.toHaveBeenCalled()
    const first = cols.lden_avg
    const calls = spy.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    expect(cols.lden_avg).toBe(first)
    expect(spy.mock.calls.length).toBe(calls)
    spy.mockRestore()
  })
})

/**
 * The same two buildings in format 2 (058): the positions in their own file, multi-byte columns as byte planes.
 * Plane layout of a u16 column [624, 65535]: low bytes [0x70, 0xff], then high bytes [0x02, 0xff].
 */
function blob2() {
  const positions = new ArrayBuffer(16)
  const ll = new Float32Array([2.17, NaN])
  const llBytes = new Uint8Array(ll.buffer)
  const lngPlanes = new Uint8Array(positions, 0, 8)
  for (let b = 0; b < 4; b++) for (let i = 0; i < 2; i++) lngPlanes[b * 2 + i] = llBytes[i * 4 + b]
  const latPlanes = new Uint8Array(positions, 8, 8)
  latPlanes.set(lngPlanes)
  const scores = new ArrayBuffer(8)
  new Uint8Array(scores, 0, 4).set([0x70, 0xff, 0x02, 0xff])
  new Uint8Array(scores, 4, 2).set([87, 255])
  const meta = {
    count: 2,
    columns: [
      { name: 'lng', type: 'f32', scale: 1, offset: 0, sentinel: null, file: 'positions', layout: 'planes' },
      { name: 'lat', type: 'f32', scale: 1, offset: 8, sentinel: null, file: 'positions', layout: 'planes' },
      { name: 'lden_avg', type: 'u16', scale: 10, offset: 0, sentinel: 65535, file: 'scores', layout: 'planes' },
      { name: 'walk_park', type: 'u8', scale: 1, offset: 4, sentinel: 255, file: 'scores', layout: 'plain' },
    ],
  } as Pick<BuildingsMeta, 'count' | 'columns'>
  return { meta, scores, positions }
}

describe('format 2: two files, byte planes (058)', () => {
  it('decodes columns stored as byte planes, from the file each is in', () => {
    const { meta, scores, positions } = blob2()
    const cols = parseColumns(meta, { scores, positions })
    expect(cols.lng[0]).toBeCloseTo(2.17, 5)
    expect(cols.lat[0]).toBeCloseTo(2.17, 5)
    expect(cols.lden_avg[0]).toBeCloseTo(62.4, 5)
    expect(cols.walk_park[0]).toBe(87)
    expect([cols.lng[1], cols.lden_avg[1], cols.walk_park[1]].every(Number.isNaN)).toBe(true)
  })

  it('leaves out the columns of a file that is not given (the worker has only the scores)', () => {
    const { meta, scores } = blob2()
    expect(Object.keys(parseColumns(meta, scores))).toEqual(['lden_avg', 'walk_park'])
    expect(Object.keys(lazyColumns(meta, { scores }))).toEqual(['lden_avg', 'walk_park'])
  })

  it('knows a meta with a positions file from one of format 1', () => {
    expect(hasPositionsFile(blob2().meta)).toBe(true)
    expect(hasPositionsFile(blob().meta)).toBe(false)
  })

  describe('loading', () => {
    afterEach(() => { vi.unstubAllGlobals(); resetBuildingsCache() })

    function stubFiles() {
      const { meta, scores, positions } = blob2()
      const fullMeta = { ...meta, areas: [], price_bounds: { p5: 1, p95: 2 }, categories: [], landmarks: [] }
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        void init
        const body = url.split('?')[0].endsWith('meta.json') ? JSON.stringify(fullMeta)
          : url.split('?')[0].endsWith('scores.bin.gz') ? gzipSync(new Uint8Array(scores))
            : gzipSync(new Uint8Array(positions))
        return Promise.resolve(new Response(body))
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }
    const names = (m: ReturnType<typeof stubFiles>) => m.mock.calls.map((c) => String(c[0]).split('?')[0].split('/').pop())

    it('loadScores brings the meta and the scores only, the scores with high priority', async () => {
      const fetchMock = stubFiles()
      const data = await loadScores()
      expect(names(fetchMock)).toEqual(['buildings-meta.json', 'buildings-scores.bin.gz'])
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ priority: 'high' })
      expect(data.cols.lden_avg[0]).toBeCloseTo(62.4, 5)
      expect(data.cols.lng).toBeUndefined()
    })

    it('loadBuildings adds the positions to the same object, after the scores', async () => {
      const fetchMock = stubFiles()
      const scored = await loadScores()
      const full = await loadBuildings()
      expect(full).toBe(scored)
      expect(names(fetchMock)).toEqual(['buildings-meta.json', 'buildings-scores.bin.gz', 'buildings-positions.bin.gz'])
      expect(full.cols.lng[0]).toBeCloseTo(2.17, 5)
      await loadBuildings()
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('the worker copy holds the scores file only', async () => {
      stubFiles()
      await loadBuildings()
      expect(copyRawScores()!.byteLength).toBe(blob2().scores.byteLength)
    })

    it('tries again after a failure', async () => {
      const fetchMock = stubFiles()
      fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 500 })))
      await expect(loadBuildings()).rejects.toThrow('meta')
      expect((await loadBuildings()).cols.lng[0]).toBeCloseTo(2.17, 5)
    })
  })
})

describe('gunzipIfNeeded', () => {
  it('inflates gzip and passes raw bytes through (server already decoded them)', async () => {
    const raw = new Uint8Array([1, 2, 3, 4])
    const gz = gzipSync(raw)
    const inflated = await gunzipIfNeeded(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength))
    expect([...new Uint8Array(inflated)]).toEqual([1, 2, 3, 4])
    const same = await gunzipIfNeeded(raw.buffer)
    expect(same).toBe(raw.buffer)
  })
})

describe('loadBuildings', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetBuildingsCache() })

  it('fetches meta and gzipped scores once', async () => {
    const { meta, buf } = blob()
    const gz = gzipSync(new Uint8Array(buf))
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.split('?')[0].endsWith('.json')
      ? new Response(JSON.stringify({ ...meta, areas: [], price_bounds: { p5: 1, p95: 2 }, categories: ['park'], landmarks: [] }))
      : new Response(gz)))
    vi.stubGlobal('fetch', fetchMock)
    const data = await loadBuildings()
    await loadBuildings()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(data.count).toBe(2)
    expect(data.cols.walk_park[0]).toBe(87)
  })

  it('keeps the raw blob and hands out copies of it (for the scoring worker)', async () => {
    const { meta, buf } = blob()
    expect(copyRawScores()).toBeNull()
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.split('?')[0].endsWith('.json')
      ? new Response(JSON.stringify({ ...meta, areas: [], price_bounds: { p5: 1, p95: 2 }, categories: [], landmarks: [] }))
      : new Response(buf.slice(0)))))
    const data = await loadBuildings()
    const [a, b] = [copyRawScores()!, copyRawScores()!]
    expect(a).not.toBe(b)
    expect([...new Uint8Array(a)]).toEqual([...new Uint8Array(buf)])
    // A copy that is given away (transferred) leaves the columns of the page readable.
    structuredClone(a, { transfer: [a] })
    expect(data.cols.lden_avg[0]).toBeCloseTo(62.4, 5)
  })
})
