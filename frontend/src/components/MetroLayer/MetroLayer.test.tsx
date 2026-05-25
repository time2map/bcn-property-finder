import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { MetroLayer } from './MetroLayer'
import type maplibregl from 'maplibre-gl'

const MOCK_LINES = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'MultiLineString', coordinates: [[[2.17, 41.38], [2.18, 41.39]]] },
    properties: { NOM_LINIA: 'L1', COLOR_LINIA: 'CE1126' },
  }],
}

const MOCK_STATIONS = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [2.17, 41.38] },
    properties: { NOM_ESTACIO: 'Universitat', PICTO: 'L1' },
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
    // Mock env vars
    vi.stubEnv('VITE_TMB_APP_ID', 'test_id')
    vi.stubEnv('VITE_TMB_APP_KEY', 'test_key')

    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ json: () => Promise.resolve(MOCK_LINES) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve(MOCK_STATIONS) } as Response)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    vi.unstubAllEnvs()
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
    expect(mockMap.addSource).toHaveBeenCalledWith('tmb-metro-lines', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addSource).toHaveBeenCalledWith('tmb-metro-stations', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addLayer).toHaveBeenCalledTimes(3)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'metro-lines' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'metro-circles' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'metro-labels' }))
  })

  it('derives station color from PICTO via line color map', async () => {
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalledTimes(2))
    const stationsCall = mockMap.addSource.mock.calls.find((c) => c[0] === 'tmb-metro-stations')
    const feature = (stationsCall?.[1] as { data: GeoJSON.FeatureCollection }).data.features[0]
    expect(feature.properties?.color).toBe('#CE1126')
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
        .mockReturnValueOnce(null)   // guard check in .then
        .mockReturnValue({}),        // cleanup checks
    })
    const { unmount } = renderWithMap(mockMap)
    await vi.waitFor(() => expect(mockMap.addSource).toHaveBeenCalled())
    unmount()
    expect(mockMap.removeLayer).toHaveBeenCalledWith('metro-labels')
    expect(mockMap.removeLayer).toHaveBeenCalledWith('metro-circles')
    expect(mockMap.removeLayer).toHaveBeenCalledWith('metro-lines')
    expect(mockMap.removeSource).toHaveBeenCalledWith('tmb-metro-stations')
    expect(mockMap.removeSource).toHaveBeenCalledWith('tmb-metro-lines')
  })

  it('fails silently on fetch error', async () => {
    fetchSpy.mockReset().mockRejectedValue(new Error('network'))
    const mockMap = makeMockMap()
    renderWithMap(mockMap)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })
})
