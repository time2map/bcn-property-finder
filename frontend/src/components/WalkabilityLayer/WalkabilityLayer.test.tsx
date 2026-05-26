import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { WalkabilityLayer } from './WalkabilityLayer'
import { usePinsStore } from '../../store/pinsStore'
import { MapContext } from '../Map/MapContext'
import type { ServiceResult } from '../../services/walkability/walkabilityTypes'

const mockMarker = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

vi.mock('maplibre-gl', () => ({
  default: {
    Marker: vi.fn(() => mockMarker),
  },
}))

function makeService(categoryId: string): ServiceResult {
  return {
    categoryId,
    label: 'Test',
    emoji: '🏪',
    lat: 41.385,
    lon: 2.173,
    distanceMeters: 500,
    walkingMinutes: 8,
  }
}

const fakeMap = {} as unknown as ReturnType<typeof import('maplibre-gl').default.Map>

describe('WalkabilityLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
  })

  it('renders nothing (null)', () => {
    const { container } = render(
      <MapContext.Provider value={null}>
        <WalkabilityLayer />
      </MapContext.Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('does not create markers when no pin is selected', () => {
    render(
      <MapContext.Provider value={fakeMap}>
        <WalkabilityLayer />
      </MapContext.Provider>,
    )
    expect(mockMarker.addTo).not.toHaveBeenCalled()
  })

  it('creates markers for each service when a pin with walkabilityServices is selected', async () => {
    const maplibregl = await import('maplibre-gl')
    const MarkerMock = vi.mocked(maplibregl.default).Marker

    const services = [makeService('supermarket'), makeService('pharmacy')]
    const pinId = usePinsStore.getState().addPin([2.173, 41.385])
    usePinsStore.getState().updatePinAnalytics(pinId, {
      calculatedAt: new Date().toISOString(),
      walkabilityScore: 50,
      walkabilityServices: services,
    })
    usePinsStore.getState().setSelectedPin(pinId)

    render(
      <MapContext.Provider value={fakeMap}>
        <WalkabilityLayer />
      </MapContext.Provider>,
    )

    expect(MarkerMock).toHaveBeenCalledTimes(services.length)
    expect(mockMarker.addTo).toHaveBeenCalledTimes(services.length)
  })

  it('removes markers when pin is deselected', async () => {
    const services = [makeService('supermarket')]
    const pinId = usePinsStore.getState().addPin([2.173, 41.385])
    usePinsStore.getState().updatePinAnalytics(pinId, {
      calculatedAt: new Date().toISOString(),
      walkabilityServices: services,
    })
    usePinsStore.getState().setSelectedPin(pinId)

    const { rerender } = render(
      <MapContext.Provider value={fakeMap}>
        <WalkabilityLayer />
      </MapContext.Provider>,
    )

    usePinsStore.getState().setSelectedPin(null)
    rerender(
      <MapContext.Provider value={fakeMap}>
        <WalkabilityLayer />
      </MapContext.Provider>,
    )

    expect(mockMarker.remove).toHaveBeenCalled()
  })
})
