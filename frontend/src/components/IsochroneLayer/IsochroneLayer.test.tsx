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

const MULTIPOLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [
    [[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]],
    [[[2.3, 41.5], [2.4, 41.5], [2.4, 41.6], [2.3, 41.5]]],
  ],
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
    useStore.setState({ resultPolygon: null, minutes: 30 })
  })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap()
    expect(container.firstChild).toBeNull()
  })

  it('adds source and three layers on mount', () => {
    renderWithMap()
    expect(mockMap.addSource).toHaveBeenCalledWith(
      'isochrone',
      expect.objectContaining({ type: 'geojson' }),
    )
    expect(mockMap.addLayer).toHaveBeenCalledTimes(3)
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isochrone-mask' }),
    )
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isochrone-line' }),
    )
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isochrone-label' }),
    )
  })

  it('skips setup if source already exists', () => {
    mockMap.getSource.mockReturnValue({})
    renderWithMap()
    expect(mockMap.addSource).not.toHaveBeenCalled()
    expect(mockMap.addLayer).not.toHaveBeenCalled()
  })

  it('calls setup directly regardless of isStyleLoaded', () => {
    mockMap.isStyleLoaded.mockReturnValue(false)
    renderWithMap()
    expect(mockMap.addSource).toHaveBeenCalledWith('isochrone', expect.any(Object))
  })

  it('does nothing when map is null', () => {
    render(
      <MapContext.Provider value={null}>
        <IsochroneLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('calls setData with two features when resultPolygon is set', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: POLYGON, minutes: 20 })
    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as { features: unknown[] }
    expect(data.features).toHaveLength(2)
  })

  it('setData receives empty FeatureCollection when resultPolygon is null', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)

    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as { features: unknown[] }
    expect(data.features).toHaveLength(0)
  })

  it('mask feature uses inverted polygon (world bbox + isochrone hole)', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: POLYGON, minutes: 20 })
    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as {
      features: Array<{ properties: { layer: string }; geometry: { coordinates: unknown[][] } }>
    }
    const maskFeature = data.features.find((f) => f.properties.layer === 'mask')
    expect(maskFeature).toBeDefined()
    expect(maskFeature!.geometry.coordinates).toHaveLength(2)
    expect(maskFeature!.geometry.coordinates[1]).toEqual(POLYGON.coordinates[0])
  })

  it('mask uses all outer rings as holes for MultiPolygon', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: MULTIPOLYGON, minutes: 45 })
    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as {
      features: Array<{ properties: { layer: string }; geometry: { coordinates: unknown[][] } }>
    }
    const maskFeature = data.features.find((f) => f.properties.layer === 'mask')
    expect(maskFeature!.geometry.coordinates).toHaveLength(3)
  })

  it('outline feature carries label text with minutes', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)

    useStore.setState({ resultPolygon: POLYGON, minutes: 30 })
    renderWithMap()

    const data = mockSource.setData.mock.calls[0][0] as {
      features: Array<{ properties: { layer: string; text: string } }>
    }
    const outlineFeature = data.features.find((f) => f.properties.layer === 'outline')
    expect(outlineFeature).toBeDefined()
    expect(outlineFeature!.properties.text).toContain('30')
  })
})
