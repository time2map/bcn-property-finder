import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { Polygon } from 'geojson'
import { MapContext } from '../Map/MapContext'
import { ExclusionLayer } from './ExclusionLayer'
import { useExclusionsStore } from '../../store/exclusionsStore'

const GEOM: Polygon = {
  type: 'Polygon',
  coordinates: [[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]],
}

function makeMockMap(overrides?: Record<string, unknown>) {
  return {
    getSource: vi.fn().mockReturnValue(null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer: vi.fn().mockReturnValue(null),
    setLayoutProperty: vi.fn(),
    ...overrides,
  }
}

let mockMap: ReturnType<typeof makeMockMap>

function renderWithMap(map = mockMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <ExclusionLayer />
    </MapContext.Provider>,
  )
}

describe('ExclusionLayer', () => {
  beforeEach(() => {
    mockMap = makeMockMap()
    useExclusionsStore.setState({ zones: [], exclusionsVisible: true })
  })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap()
    expect(container.firstChild).toBeNull()
  })

  it('adds source and fill + line layers on mount', () => {
    renderWithMap()
    expect(mockMap.addSource).toHaveBeenCalledWith('exclusions', expect.objectContaining({ type: 'geojson' }))
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'exclusion-fill', type: 'fill' }), undefined)
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'exclusion-line', type: 'line' }), undefined)
  })

  it('uses grey fill color', () => {
    renderWithMap()
    const fillCall = mockMap.addLayer.mock.calls.find(
      ([l]: [{ id: string }]) => l.id === 'exclusion-fill',
    )
    expect(fillCall?.[0].paint['fill-color']).toBe('#555555')
  })

  it('does nothing when map is null', () => {
    render(
      <MapContext.Provider value={null}>
        <ExclusionLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('feeds zone geometries to the source via setData', () => {
    const mockSource = { setData: vi.fn() }
    mockMap.getSource.mockReturnValueOnce(null).mockReturnValue(mockSource)
    useExclusionsStore.setState({
      zones: [{ id: '1', name: 'No-go', source: 'drawn', geometry: GEOM }],
    })
    renderWithMap()
    const data = mockSource.setData.mock.calls[0][0] as { features: unknown[] }
    expect(data.features).toHaveLength(1)
  })

  it('hides layers when exclusionsVisible is false', () => {
    const mockLayer = { id: 'exclusion-fill' }
    mockMap.getLayer.mockReturnValue(mockLayer)
    useExclusionsStore.setState({ exclusionsVisible: false })
    renderWithMap()
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('exclusion-fill', 'visibility', 'none')
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('exclusion-line', 'visibility', 'none')
  })
})
