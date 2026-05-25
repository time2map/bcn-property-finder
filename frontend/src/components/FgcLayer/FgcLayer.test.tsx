import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { FgcLayer } from './FgcLayer'
import type maplibregl from 'maplibre-gl'

const MOCK_LINES: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[2.16, 41.38], [2.17, 41.39]] },
    properties: { routeId: 'L6', name: 'L6', color: '#797FBC' },
  }],
}

const MOCK_STATIONS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [2.168, 41.385] },
    properties: { name: 'Barcelona - Plaça Catalunya', color: '#797FBC', routes: 'L6,S1' },
  }],
}

function makeMockMap(overrides?: Record<string, unknown>) {
  return {
    getSource: vi.fn().mockReturnValue(null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer: vi.fn().mockReturnValue(null),
    ...overrides,
  }
}

function renderWithMap(map: ReturnType<typeof makeMockMap> | null) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <FgcLayer />
    </MapContext.Provider>,
  )
}

describe('FgcLayer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ json: () => Promise.resolve(MOCK_LINES) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve(MOCK_STATIONS) } as Response)
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

  it('fetches lines + stations and adds 2 sources + 3 layers', async () => {
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalledTimes(2))
    expect(mockMap.addSource).toHaveBeenCalledWith('fgc-lines', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addSource).toHaveBeenCalledWith('fgc-stations', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addLayer).toHaveBeenCalledTimes(3)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fgc-line' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fgc-circle' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fgc-label' }))
  })

  it('skips setup if sources already exist', async () => {
    const mockMap = makeMockMap({ getSource: vi.fn().mockReturnValue({}) })
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('cleans up all layers and sources on unmount', async () => {
    const mockMap = makeMockMap({
      getLayer: vi.fn().mockReturnValue({}),
      getSource: vi.fn()
        .mockReturnValueOnce(null)
        .mockReturnValue({}),
    })
    const { unmount } = renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalled())
    unmount()
    expect(mockMap.removeLayer).toHaveBeenCalledWith('fgc-label')
    expect(mockMap.removeLayer).toHaveBeenCalledWith('fgc-circle')
    expect(mockMap.removeLayer).toHaveBeenCalledWith('fgc-line')
    expect(mockMap.removeSource).toHaveBeenCalledWith('fgc-stations')
    expect(mockMap.removeSource).toHaveBeenCalledWith('fgc-lines')
  })

  it('fails silently on fetch error', async () => {
    fetchSpy.mockReset().mockRejectedValue(new Error('network'))
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })
})
