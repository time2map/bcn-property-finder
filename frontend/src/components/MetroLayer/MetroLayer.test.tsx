import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { MetroLayer } from './MetroLayer'
import type maplibregl from 'maplibre-gl'

const MOCK_GEOJSON = {
  type: 'FeatureCollection',
  elements: [
    { type: 'node', id: 1, lat: 41.38, lon: 2.17, tags: { name: 'Universitat' } },
  ],
}

function makeMockMap(overrides?: Record<string, unknown>) {
  return {
    getSource: vi.fn().mockReturnValue(null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer: vi.fn().mockReturnValue(null),
    getCanvas: vi.fn().mockReturnValue(document.createElement('canvas')),
    ...overrides,
  }
}

function renderWithMap(map: ReturnType<typeof makeMockMap> | null) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <MetroLayer />
    </MapContext.Provider>,
  )
}

describe('MetroLayer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ elements: MOCK_GEOJSON.elements }),
    } as Response)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap(makeMockMap())
    expect(container.firstChild).toBeNull()
  })

  it('does nothing when map is null', () => {
    renderWithMap(null)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches stations and adds source + 2 layers', async () => {
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalled())
    expect(mockMap.addSource).toHaveBeenCalledWith('bcn-metro', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addLayer).toHaveBeenCalledTimes(2)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'metro-circles' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'metro-labels' }))
  })

  it('skips setup if source already exists', async () => {
    const mockMap = makeMockMap({ getSource: vi.fn().mockReturnValue({}) })
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('cleans up layers on unmount', async () => {
    const mockMap = makeMockMap({
      getLayer: vi.fn().mockReturnValue({}),
      // First call (inside .then guard): null so setup proceeds; after that: source exists
      getSource: vi.fn().mockReturnValueOnce(null).mockReturnValue({}),
    })
    const { unmount } = renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalled())
    unmount()
    expect(mockMap.removeLayer).toHaveBeenCalledWith('metro-labels')
    expect(mockMap.removeLayer).toHaveBeenCalledWith('metro-circles')
    expect(mockMap.removeSource).toHaveBeenCalledWith('bcn-metro')
  })

  it('fails silently on fetch error', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })
})
