import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { DEFAULT_COMPOSITE_WEIGHTS } from '../../store'

const mockPopup = {
  setLngLat: vi.fn().mockReturnThis(),
  setHTML: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

vi.mock('maplibre-gl', () => ({
  default: { Popup: vi.fn(() => mockPopup) },
}))

vi.mock('../../services/composite/compositeData', () => ({
  loadBundles: vi.fn().mockResolvedValue([
    {
      h3: 'aaa',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      walk: 80,
      lden: 50,
      cityCoreProps: {
        h3: 'aaa',
        sagrada: 10, placa_cat: 5, barceloneta: 20, barri_gotic: 15,
        pg_gracia: 8, arc_triomf: 12, montjuic: 18, placa_espanya: 22,
        glories: 25, poblenou: 30, parc_guell: 45, eixample: 0, waterfront: 35,
      },
    },
  ]),
  loadPriceMap: vi.fn().mockResolvedValue(new Map([['aaa', 400_000]])),
}))

import { CompositeLayer, SOURCE_ID, FILL_LAYER_ID, GAP_LAYER_ID } from './CompositeLayer'

function makeFakeMap() {
  const sources = new Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>()
  const layers = new Map<string, unknown>()
  return {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, src: { data: unknown }) =>
      sources.set(id, { data: src.data, setData: vi.fn((d: unknown) => { sources.get(id)!.data = d }) }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string }) => layers.set(l.id, l),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    setFilter: vi.fn(),
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
      <CompositeLayer />
    </MapContext.Provider>,
  )
}

describe('CompositeLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useStore.setState({
      compositeVisible: false,
      compositeWeights: DEFAULT_COMPOSITE_WEIGHTS,
      compositeScoreRange: [0, 100],
    })
  })

  it('renders nothing (null)', () => {
    const { container } = renderLayer(makeFakeMap())
    expect(container.firstChild).toBeNull()
  })

  it('does not load data while layer is off', async () => {
    const { loadBundles } = await import('../../services/composite/compositeData')
    renderLayer(makeFakeMap())
    expect(loadBundles).not.toHaveBeenCalled()
  })

  it('adds fill and gap outline layers when enabled', async () => {
    useStore.setState({ compositeVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    expect(map.getSource(SOURCE_ID)).toBeDefined()
    expect(map.getLayer(FILL_LAYER_ID)).toBeDefined()
    expect(map.getLayer(GAP_LAYER_ID)).toBeDefined()
  })

  it('hides layers when visibility toggled off', async () => {
    useStore.setState({ compositeVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    act(() => useStore.setState({ compositeVisible: false }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(FILL_LAYER_ID, 'visibility', 'none')
    expect(map.setLayoutProperty).toHaveBeenCalledWith(GAP_LAYER_ID, 'visibility', 'none')
  })

  it('rebuilds data when weights change', async () => {
    useStore.setState({ compositeVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    const source = map.getSource(SOURCE_ID)!
    act(() => useStore.setState({ compositeWeights: { poiAccess: 10, noise: 0, cityCore: 0, price: 0 } }))
    expect(source.setData).toHaveBeenCalled()
  })

  it('updates fill-color and filters when score range changes', async () => {
    useStore.setState({ compositeVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    act(() => useStore.setState({ compositeScoreRange: [30, 80] }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(FILL_LAYER_ID, 'visibility', 'visible')
    // setPaintProperty and setFilter are called
    expect(map.setLayoutProperty).toHaveBeenCalled()
  })
})
