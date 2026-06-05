import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { BarrioBoundariesLayer } from './BarrioBoundariesLayer'
import { useStore } from '../../store'

const { AREA_GRACIA } = vi.hoisted(() => ({
  AREA_GRACIA: {
    type: 'Feature' as const,
    properties: { id: 'd-gracia', name: 'Gràcia', kind: 'district' as const },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]],
    },
  },
}))

vi.mock('../../services/areas', () => ({
  loadAreas: vi.fn().mockResolvedValue([AREA_GRACIA]),
}))

vi.mock('../../store/idealistaBaseUrlStore', () => ({
  useIdealistaBaseUrlStore: (sel: (s: { baseUrl: string | null }) => unknown) =>
    sel({ baseUrl: null }),
}))

vi.mock('../../services/idealista', () => ({
  buildIdealistaUrl: vi.fn().mockReturnValue('https://www.idealista.com/areas/test?shape=ABC'),
}))

type ContextMenuHandler = (e: { point: unknown; originalEvent: MouseEvent }) => void

function makeMockMap(overrides?: Record<string, unknown>) {
  const handlers: Record<string, ContextMenuHandler> = {}
  return {
    getSource: vi.fn().mockReturnValue(null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    // Return truthy for all layers so visibility/contextmenu guards pass
    getLayer: vi.fn().mockReturnValue({ id: 'mock-layer' }),
    setLayoutProperty: vi.fn(),
    queryRenderedFeatures: vi.fn().mockReturnValue([AREA_GRACIA]),
    on: vi.fn((event: string, handler: ContextMenuHandler) => {
      handlers[event] = handler
    }),
    off: vi.fn(),
    _handlers: handlers,
    ...overrides,
  }
}

let mockMap: ReturnType<typeof makeMockMap>

function renderWithMap(map = mockMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <BarrioBoundariesLayer />
    </MapContext.Provider>,
  )
}

describe('BarrioBoundariesLayer', () => {
  beforeEach(() => {
    mockMap = makeMockMap()
    useStore.setState({ barrioBoundariesVisible: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing to the DOM initially', () => {
    const { container } = renderWithMap()
    expect(container.firstChild).toBeNull()
  })

  it('does nothing when map is null', () => {
    render(
      <MapContext.Provider value={null}>
        <BarrioBoundariesLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.addSource).not.toHaveBeenCalled()
  })

  it('hides layers when barrioBoundariesVisible is false', () => {
    useStore.setState({ barrioBoundariesVisible: false })
    renderWithMap()
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      'barrio-boundaries-line',
      'visibility',
      'none',
    )
  })

  it('shows layers when barrioBoundariesVisible changes to true', () => {
    useStore.setState({ barrioBoundariesVisible: false })
    const { rerender } = renderWithMap()
    useStore.setState({ barrioBoundariesVisible: true })
    rerender(
      <MapContext.Provider value={mockMap as unknown as maplibregl.Map}>
        <BarrioBoundariesLayer />
      </MapContext.Provider>,
    )
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      'barrio-boundaries-line',
      'visibility',
      'visible',
    )
  })

  it('registers contextmenu handler on map', () => {
    renderWithMap()
    expect(mockMap.on).toHaveBeenCalledWith('contextmenu', expect.any(Function))
  })

  it('shows context menu on right-click over a feature', async () => {
    renderWithMap()
    const handler = mockMap._handlers['contextmenu']
    const nativeEvent = new MouseEvent('contextmenu', { clientX: 100, clientY: 200 })
    Object.defineProperty(nativeEvent, 'preventDefault', { value: vi.fn() })
    await act(async () => {
      handler({ point: { x: 100, y: 200 }, originalEvent: nativeEvent })
    })
    expect(screen.getByText('Gràcia')).toBeInTheDocument()
    expect(screen.getByText(/Open on Idealista/i)).toBeInTheDocument()
  })

  it('closes context menu on Escape', async () => {
    renderWithMap()
    const handler = mockMap._handlers['contextmenu']
    const nativeEvent = new MouseEvent('contextmenu', { clientX: 100, clientY: 200 })
    Object.defineProperty(nativeEvent, 'preventDefault', { value: vi.fn() })
    await act(async () => {
      handler({ point: { x: 100, y: 200 }, originalEvent: nativeEvent })
    })
    expect(screen.getByText(/Open on Idealista/i)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/Open on Idealista/i)).not.toBeInTheDocument()
  })

  it('opens Idealista URL and closes menu on click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithMap()
    const handler = mockMap._handlers['contextmenu']
    const nativeEvent = new MouseEvent('contextmenu', { clientX: 100, clientY: 200 })
    Object.defineProperty(nativeEvent, 'preventDefault', { value: vi.fn() })
    await act(async () => {
      handler({ point: { x: 100, y: 200 }, originalEvent: nativeEvent })
    })
    fireEvent.click(screen.getByText(/Open on Idealista/i))
    expect(openSpy).toHaveBeenCalledWith(
      'https://www.idealista.com/areas/test?shape=ABC',
      '_blank',
      'noopener,noreferrer',
    )
    expect(screen.queryByText(/Open on Idealista/i)).not.toBeInTheDocument()
    openSpy.mockRestore()
  })
})
