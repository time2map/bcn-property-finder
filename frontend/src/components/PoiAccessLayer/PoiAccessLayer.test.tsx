import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { Feature, Polygon } from 'geojson'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import type { LivabilityCellProps, LivabilityGrid } from '../../services/livability/livabilityData'

const mockPopup = {
  setLngLat: vi.fn().mockReturnThis(),
  setHTML: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

vi.mock('maplibre-gl', () => ({
  default: { Popup: vi.fn(() => mockPopup) },
}))

vi.mock('../../services/livability/livabilityData', async (orig) => {
  const actual = await orig<typeof import('../../services/livability/livabilityData')>()
  return { ...actual, loadLivabilityGrid: vi.fn() }
})

import { PoiAccessLayer, SOURCE_ID, LAYER_ID } from './PoiAccessLayer'
import { loadLivabilityGrid } from '../../services/livability/livabilityData'

function cell(props: LivabilityCellProps): Feature<Polygon, LivabilityCellProps> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }
}
const GRID: LivabilityGrid = {
  type: 'FeatureCollection',
  features: [cell({ h3: 'a', walk: 80, lden: 45 })],
}

interface FakeSource {
  type: string
  data: unknown
  setData: ReturnType<typeof vi.fn>
}

function makeFakeMap() {
  const sources = new Map<string, FakeSource>()
  const layers = new Map<string, unknown>()
  return {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, src: { type: string; data: unknown }) =>
      sources.set(id, { ...src, setData: vi.fn((d: unknown) => { sources.get(id)!.data = d }) }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string }) => layers.set(l.id, l),
    setLayoutProperty: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getCanvas: () => ({ style: {} as Record<string, string> }),
  }
}

type FakeMap = ReturnType<typeof makeFakeMap>

function renderLayer(map: FakeMap | null) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <PoiAccessLayer />
    </MapContext.Provider>,
  )
}

describe('PoiAccessLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useStore.setState({ poiAccessVisible: false })
    vi.mocked(loadLivabilityGrid).mockResolvedValue(GRID)
  })
  afterEach(() => {
    useStore.setState({ poiAccessVisible: false })
  })

  it('renders nothing (null)', () => {
    const { container } = renderLayer(makeFakeMap())
    expect(container.firstChild).toBeNull()
  })

  it('does not load the grid while the layer is off', () => {
    renderLayer(makeFakeMap())
    expect(loadLivabilityGrid).not.toHaveBeenCalled()
  })

  it('loads the grid and adds source + fill layer when enabled', async () => {
    useStore.setState({ poiAccessVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    expect(map.getLayer(LAYER_ID)).toBeDefined()
    expect(map.getSource(SOURCE_ID)).toBeDefined()
    const data = map.getSource(SOURCE_ID)!.data as LivabilityGrid
    expect(data.features[0].properties.walk).toBe(80)
  })

  it('hides the layer when visibility is toggled off', async () => {
    useStore.setState({ poiAccessVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    act(() => useStore.setState({ poiAccessVisible: false }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(LAYER_ID, 'visibility', 'none')
  })
})
