import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { MultiPolygon } from 'geojson'
import { useIdealistaAreas, useComputeIdealistaAreas } from './useIdealistaAreas'
import { useStore } from '../store'
import { useExclusionsStore } from '../store/exclusionsStore'
import { resetAreasCache } from '../services/areas'

const TWO_BLOBS: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [[[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.1], [2.0, 41.0]]],
    [[[2.5, 41.5], [2.6, 41.5], [2.6, 41.6], [2.5, 41.6], [2.5, 41.5]]],
  ],
}

describe('useIdealistaAreas', () => {
  beforeEach(() => {
    useStore.setState({ resultPolygon: null, idealistaAreas: [], idealistaUrls: [], hoveredAreaIndex: null, idealistaZonesVisible: true })
    useExclusionsStore.setState({ zones: [] })
    resetAreasCache()
  })

  it('returns empty by default (no compute triggered)', () => {
    const { result } = renderHook(() => useIdealistaAreas())
    expect(result.current).toEqual({ areas: [], urls: [], count: 0 })
  })

  it('returns store values after setIdealistaAreas', () => {
    const fakePolygon = TWO_BLOBS.coordinates[0]
    const poly1 = { type: 'Polygon' as const, coordinates: fakePolygon }
    useStore.getState().setIdealistaAreas([poly1], ['https://idealista.com/test'])
    const { result } = renderHook(() => useIdealistaAreas())
    expect(result.current.count).toBe(1)
    expect(result.current.urls[0]).toBe('https://idealista.com/test')
  })
})

describe('useComputeIdealistaAreas', () => {
  beforeEach(() => {
    useStore.setState({ resultPolygon: null, idealistaAreas: [], idealistaUrls: [], hoveredAreaIndex: null, idealistaZonesVisible: true })
    useExclusionsStore.setState({ zones: [] })
    resetAreasCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('compute() populates idealistaAreas from the effective area (fallback path)', () => {
    useStore.setState({ resultPolygon: TWO_BLOBS })
    const { result } = renderHook(() => useComputeIdealistaAreas())
    act(() => {
      result.current.compute()
      vi.runAllTimers()
    })
    const { idealistaAreas } = useStore.getState()
    expect(idealistaAreas.length).toBe(2)
    idealistaAreas.forEach((a) => expect(a.type).toBe('Polygon'))
  })

  it('clears areas when effective area changes after mount', () => {
    // Start with a non-null isochrone so effectiveArea is non-null
    useStore.setState({ resultPolygon: TWO_BLOBS })
    const { result } = renderHook(() => useComputeIdealistaAreas())

    // Manually set areas (simulating a previous compute)
    act(() => {
      useStore.getState().setIdealistaAreas(
        [{ type: 'Polygon', coordinates: [[[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.0]]] }],
        ['https://test'],
      )
    })
    expect(result.current.hasAreas).toBe(true)

    // Change the effective area (simulate slider move) → areas should be cleared
    act(() => { useStore.setState({ resultPolygon: null }) })
    expect(result.current.hasAreas).toBe(false)
  })
})
