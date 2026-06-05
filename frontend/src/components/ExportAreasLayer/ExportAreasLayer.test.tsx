import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { MultiPolygon } from 'geojson'
import { MapContext } from '../Map/MapContext'
import { ExportAreasLayer } from './ExportAreasLayer'
import { useStore } from '../../store'
import { useExclusionsStore } from '../../store/exclusionsStore'

const TWO_BLOBS: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [[[2.0, 41.0], [2.1, 41.0], [2.1, 41.1], [2.0, 41.1], [2.0, 41.0]]],
    [[[2.5, 41.5], [2.6, 41.5], [2.6, 41.6], [2.5, 41.6], [2.5, 41.5]]],
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
    setFeatureState: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getCanvas: vi.fn().mockReturnValue({ style: {} }),
    ...overrides,
  }
}

let mockMap: ReturnType<typeof makeMockMap>

function renderWithMap(map = mockMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <ExportAreasLayer />
    </MapContext.Provider>,
  )
}

function makeArea(x: number, y: number) {
  return {
    type: 'Polygon' as const,
    coordinates: [[[x, y], [x + 0.1, y], [x + 0.1, y + 0.1], [x, y + 0.1], [x, y]]],
  }
}

describe('ExportAreasLayer', () => {
  beforeEach(() => {
    mockMap = makeMockMap()
    useStore.setState({ resultPolygon: null, idealistaAreas: [], idealistaUrls: [], hoveredAreaIndex: null, idealistaZonesVisible: true })
    useExclusionsStore.setState({ zones: [] })
  })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap()
    expect(container.firstChild).toBeNull()
  })

  it('adds source + fill, line and label layers on mount', () => {
    renderWithMap()
    expect(mockMap.addSource).toHaveBeenCalledWith('export-areas', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'export-areas-fill', type: 'fill' }), undefined)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'export-areas-line', type: 'line' }), undefined)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'export-areas-label', type: 'symbol' }), undefined)
  })

  it('does nothing when map is null', () => {
    render(
      <MapContext.Provider value={null}>
        <ExportAreasLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('feeds one numbered feature per computed area to the source', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)
    useStore.setState({
      resultPolygon: TWO_BLOBS,
      idealistaAreas: [makeArea(2.0, 41.0), makeArea(2.5, 41.5)],
      idealistaUrls: ['u1', 'u2'],
    })
    renderWithMap()
    const data = mockSource.setData.mock.calls.at(-1)![0] as {
      features: Array<{ properties: { label: string } }>
    }
    expect(data.features).toHaveLength(2)
    expect(data.features.map((f) => f.properties.label)).toEqual(['Main', '2'])
  })

  it('gives each feature a numeric id matching its area index', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)
    useStore.setState({
      resultPolygon: TWO_BLOBS,
      idealistaAreas: [makeArea(2.0, 41.0), makeArea(2.5, 41.5)],
      idealistaUrls: ['u1', 'u2'],
    })
    renderWithMap()
    const data = mockSource.setData.mock.calls.at(-1)![0] as { features: Array<{ id: number }> }
    expect(data.features.map((f) => f.id)).toEqual([0, 1])
  })

  it('reflects the hovered area onto the map via feature-state', () => {
    mockMap.getSource.mockReturnValue({ setData: vi.fn() })
    useStore.setState({
      resultPolygon: TWO_BLOBS,
      idealistaAreas: [makeArea(2.0, 41.0), makeArea(2.5, 41.5)],
      idealistaUrls: ['u1', 'u2'],
      hoveredAreaIndex: null,
    })
    renderWithMap()
    act(() => useStore.getState().setHoveredAreaIndex(1))
    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { source: 'export-areas', id: 1 },
      { hover: true },
    )
  })

  it('subscribes to map hover events on the fill layer', () => {
    renderWithMap()
    expect(mockMap.on).toHaveBeenCalledWith('mousemove', 'export-areas-fill', expect.any(Function))
    expect(mockMap.on).toHaveBeenCalledWith('mouseleave', 'export-areas-fill', expect.any(Function))
  })
})
