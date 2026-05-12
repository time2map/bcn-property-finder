import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { IsochroneLayer } from './IsochroneLayer'
import { useStore } from '../../store'
import type maplibregl from 'maplibre-gl'

const POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]],
}

type MockMap = ReturnType<typeof makeMockMap>

function makeMockMap(overrides?: Record<string, unknown>) {
  const base = {
    getSource: vi.fn().mockReturnValue(null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer: vi.fn().mockReturnValue(null),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    once: vi.fn(),
    off: vi.fn(),
  }
  return { ...base, ...overrides }
}

let mockMap: MockMap

function renderWithMap(map = mockMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <IsochroneLayer />
    </MapContext.Provider>,
  )
}

describe('IsochroneLayer', () => {
  beforeEach(() => {
    mockMap = makeMockMap()
    useStore.setState({ resultPolygon: null })
  })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap()
    expect(container.firstChild).toBeNull()
  })

  it('adds source and two layers on mount when style is loaded', () => {
    renderWithMap()
    expect(mockMap.addSource).toHaveBeenCalledWith(
      'isochrone',
      expect.objectContaining({ type: 'geojson' }),
    )
    expect(mockMap.addLayer).toHaveBeenCalledTimes(2)
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isochrone-fill' }),
    )
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isochrone-mask' }),
    )
  })

  it('skips setup if source already exists', () => {
    mockMap.getSource.mockReturnValue({})
    renderWithMap()
    expect(mockMap.addSource).not.toHaveBeenCalled()
    expect(mockMap.addLayer).not.toHaveBeenCalled()
  })

  it('registers load listener when style is not loaded yet', () => {
    mockMap.isStyleLoaded.mockReturnValue(false)
    renderWithMap()
    expect(mockMap.once).toHaveBeenCalledWith('load', expect.any(Function))
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('does nothing when map is null', () => {
    render(
      <MapContext.Provider value={null}>
        <IsochroneLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('calls setData with FeatureCollection when resultPolygon is set', () => {
    const mockSource = { setData: vi.fn() }
    // First call (setup check): null; subsequent calls (data update): the source
    mockMap.getSource
      .mockReturnValueOnce(null)
      .mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: POLYGON })
    renderWithMap()

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FeatureCollection' }),
    )
    const data = mockSource.setData.mock.calls[0][0] as { features: unknown[] }
    expect(data.features).toHaveLength(2)
  })

  it('setData receives empty FeatureCollection when resultPolygon is null', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource
      .mockReturnValueOnce(null)
      .mockReturnValue(mockSource)

    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as { features: unknown[] }
    expect(data.features).toHaveLength(0)
  })

  it('mask feature uses inverted polygon (world bbox + isochrone hole)', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource
      .mockReturnValueOnce(null)
      .mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: POLYGON })
    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as {
      features: Array<{ properties: { layer: string }; geometry: { coordinates: unknown[][] } }>
    }
    const maskFeature = data.features.find((f) => f.properties.layer === 'mask')
    expect(maskFeature).toBeDefined()
    // First ring is the world bbox, second is the isochrone hole
    expect(maskFeature!.geometry.coordinates).toHaveLength(2)
    expect(maskFeature!.geometry.coordinates[1]).toEqual(POLYGON.coordinates[0])
  })
})
