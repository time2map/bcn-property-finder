import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { cellsToMultiPolygon, gridDisk, latLngToCell } from 'h3-js'
import { useBestZones } from './useBestZones'
import { useStore } from '../store'
import { useIdealistaBaseUrlStore } from '../store/idealistaBaseUrlStore'
import { useExclusionsStore } from '../store/exclusionsStore'
import { findZoneCells, type Bounds } from '../services/bestZones'

// One 7-cell hot spot (score 90) on a zero-score grid. computeComposite is mocked to return
// `walk` as the score, so the hook's wiring is tested, not the scoring maths.
const HOT = new Set(gridDisk(latLngToCell(41.39, 2.17, 9), 1))
const BUNDLES = gridDisk(latLngToCell(41.39, 2.17, 9), 10).map((h3) => ({ h3, walk: HOT.has(h3) ? 90 : 0 }))

vi.mock('../services/composite/compositeData', () => ({
  loadBundles: vi.fn(() => Promise.resolve(BUNDLES)),
  loadOpenPriceMeta: vi.fn().mockResolvedValue({ p5: 2000, p95: 6000 }),
}))
vi.mock('../services/composite/compositeScore', () => ({
  computeComposite: (b: { walk: number }) => ({ score: b.walk }),
}))

// Spy on the zone search to see which previous zones (sticky) the hook hands over.
vi.mock('../services/bestZones', async (importActual) => {
  const actual = await importActual<typeof import('../services/bestZones')>()
  return { ...actual, findZoneCells: vi.fn(actual.findZoneCells) }
})

const BCN: Bounds = [2.0, 41.2, 2.4, 41.6]
const lastSticky = () => vi.mocked(findZoneCells).mock.calls.at(-1)![0].sticky
const lastAllowed = () => vi.mocked(findZoneCells).mock.calls.at(-1)![0].allowed

describe('useBestZones', () => {
  beforeEach(() => {
    useStore.setState({ bestZonesBounds: null, bestZonesTopPct: 3, compositeScoreRange: [0, 100], bestZonesRestrict: true, resultPolygon: null })
    useIdealistaBaseUrlStore.setState({ baseUrl: null })
    useExclusionsStore.setState({ zones: [] })
  })

  it('returns no zones until a viewport is captured', () => {
    const { result } = renderHook(() => useBestZones())
    expect(result.current).toEqual({ zones: [], urls: [], labels: [], ready: false })
  })

  it('computes zones for the captured viewport, with Idealista URLs using the saved filters', async () => {
    useIdealistaBaseUrlStore.setState({ baseUrl: 'https://www.idealista.com/areas/alquiler-viviendas/' })
    const { result } = renderHook(() => useBestZones())
    act(() => useStore.getState().setBestZonesBounds(BCN))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.zones.length).toBeGreaterThan(0)
    expect(result.current.urls[0]).toMatch(/^https:\/\/www\.idealista\.com\/areas\/alquiler-viviendas\/\?shape=%28%28/)
  })

  it('clears zones when the viewport is reset', async () => {
    const { result } = renderHook(() => useBestZones())
    act(() => useStore.getState().setBestZonesBounds(BCN))
    await waitFor(() => expect(result.current.zones.length).toBeGreaterThan(0))
    act(() => useStore.getState().setBestZonesBounds(null))
    expect(result.current.zones).toEqual([])
  })

  it('strictness-only changes stick to the zones of the last fresh draw; a new view starts fresh', async () => {
    const { result } = renderHook(() => useBestZones())
    act(() => useStore.getState().setBestZonesBounds(BCN))
    await waitFor(() => expect(result.current.zones.length).toBeGreaterThan(0))
    expect(lastSticky()).toBeUndefined()
    const anchor = vi.mocked(findZoneCells).mock.results.at(-1)!.value

    act(() => useStore.getState().setBestZonesTopPct(10))
    expect(lastSticky()).toEqual(anchor)
    act(() => useStore.getState().setBestZonesTopPct(5))
    expect(lastSticky()).toEqual(anchor) // not the 10% result — no drift along the slider path

    act(() => useStore.getState().setBestZonesBounds([2.0, 41.2, 2.3, 41.5]))
    expect(lastSticky()).toBeUndefined()
  })

  it('zone numbers stay put: a vanished zone leaves a gap, newcomers get the next numbers', async () => {
    const ring = (lat: number, lng: number) => gridDisk(latLngToCell(lat, lng, 9), 1)
    const [a, b, c, d] = [ring(41.39, 2.17), ring(41.40, 2.19), ring(41.38, 2.15), ring(41.37, 2.19)]
    vi.mocked(findZoneCells).mockReturnValueOnce([a, b, c])
    const { result } = renderHook(() => useBestZones())
    act(() => useStore.getState().setBestZonesBounds(BCN))
    await waitFor(() => expect(result.current.labels).toEqual([1, 2, 3]))

    vi.mocked(findZoneCells).mockReturnValueOnce([a, c, d]) // b vanished, d is new
    act(() => useStore.getState().setBestZonesTopPct(10))
    expect(result.current.labels).toEqual([1, 3, 4])

    // Stricter: zone a splits in two — only the first piece keeps number 1.
    vi.mocked(findZoneCells).mockReturnValueOnce([a.slice(0, 3), c, a.slice(3)])
    act(() => useStore.getState().setBestZonesTopPct(5))
    expect(result.current.labels).toEqual([1, 3, 4])
  })

  it('restricts zones to the isochrone minus exclusion zones while the checkbox is on', async () => {
    const hot = latLngToCell(41.39, 2.17, 9)
    const { result } = renderHook(() => useBestZones())
    act(() => useStore.getState().setBestZonesBounds(BCN))
    await waitFor(() => expect(result.current.zones.length).toBeGreaterThan(0))
    expect(lastAllowed()).toBeUndefined() // nothing to restrict to yet

    act(() => useExclusionsStore.setState({ zones: [{
      id: 'x', name: 'No-go', source: 'drawn',
      geometry: { type: 'MultiPolygon', coordinates: cellsToMultiPolygon([...HOT], true) },
    }] }))
    expect(lastAllowed()!(hot)).toBe(false)
    expect(lastSticky()).toBeUndefined() // a new restriction is a fresh computation
    expect(vi.mocked(findZoneCells).mock.results.at(-1)!.value.flat()).not.toContain(hot)

    act(() => useStore.getState().setBestZonesRestrict(false))
    expect(lastAllowed()).toBeUndefined()
  })
})
