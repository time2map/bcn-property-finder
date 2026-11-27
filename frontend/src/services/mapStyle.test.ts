import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_STYLE, loadMapStyle, resetMapStyleCache } from './mapStyle'

const STYLE = { version: 8, sources: { a: { type: 'vector', attribution: 'ICGC' } }, layers: [] }

function mockFetch(local: () => Promise<Response>, probe: () => Promise<Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => (init?.method === 'HEAD' ? probe() : local()))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const ok = (body: unknown = null) => Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status: 200 }))

describe('loadMapStyle', () => {
  beforeEach(() => resetMapStyleCache())
  afterEach(() => vi.unstubAllGlobals())

  it('gives our copy of the ICGC style when ICGC answers', async () => {
    const fetchMock = mockFetch(() => ok(STYLE), () => ok())
    await expect(loadMapStyle()).resolves.toEqual({ style: STYLE, trusted: true })
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining('basemap/icgc-standard.json'),
      expect.stringContaining('geoserveis.icgc.cat'),
    ])
  })

  it('asks ICGC without downloading the style again (HEAD)', async () => {
    const fetchMock = mockFetch(() => ok(STYLE), () => ok())
    await loadMapStyle()
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'HEAD' })
  })

  it('falls back to OpenFreeMap when ICGC does not answer', async () => {
    mockFetch(() => ok(STYLE), () => Promise.reject(new Error('down')))
    await expect(loadMapStyle()).resolves.toEqual({ style: FALLBACK_STYLE, trusted: false })
  })

  it('falls back when ICGC answers with an error', async () => {
    mockFetch(() => ok(STYLE), () => Promise.resolve(new Response(null, { status: 503 })))
    await expect(loadMapStyle()).resolves.toEqual({ style: FALLBACK_STYLE, trusted: false })
  })

  it('falls back when our copy is missing or broken', async () => {
    mockFetch(() => Promise.resolve(new Response('nope', { status: 404 })), () => ok())
    await expect(loadMapStyle()).resolves.toEqual({ style: FALLBACK_STYLE, trusted: false })
    resetMapStyleCache()
    mockFetch(() => Promise.resolve(new Response('<html>', { status: 200 })), () => ok())
    await expect(loadMapStyle()).resolves.toEqual({ style: FALLBACK_STYLE, trusted: false })
    resetMapStyleCache()
    mockFetch(() => Promise.reject(new Error('offline')), () => ok())
    await expect(loadMapStyle()).resolves.toEqual({ style: FALLBACK_STYLE, trusted: false })
  })

  it('loads once', async () => {
    const fetchMock = mockFetch(() => ok(STYLE), () => ok())
    await Promise.all([loadMapStyle(), loadMapStyle()])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
