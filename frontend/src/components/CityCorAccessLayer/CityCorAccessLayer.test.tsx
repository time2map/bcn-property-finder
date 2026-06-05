import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { Feature, Polygon } from 'geojson'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import type { CityCoreCellProps, CityCoreGrid } from '../../services/cityCore/cityCoreData'

const mockPopup = {
  setLngLat: vi.fn().mockReturnThis(),
  setHTML: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

const mockMarker = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
}

vi.mock('maplibre-gl', () => ({
  default: {
    Popup: vi.fn(() => mockPopup),
    Marker: vi.fn(() => mockMarker),
  },
}))

vi.mock('../../services/cityCore/cityCoreData', async (orig) => {
  const actual = await orig<typeof import('../../services/cityCore/cityCoreData')>()
  return { ...actual, loadCityCoreGrid: vi.fn() }
})

import {
  CityCorAccessLayer,
  SOURCE_ID, LAYER_ID,
  SHAPES_SOURCE_ID, SHAPES_FILL_LAYER, SHAPES_LINE_LAYER,
} from './CityCorAccessLayer'
import { loadCityCoreGrid } from '../../services/cityCore/cityCoreData'

function makeProps(): CityCoreCellProps {
  return {
    h3: 'abc',
    sagrada: 10, placa_cat: 5, barceloneta: 30, barri_gotic: 20, pg_gracia: 15,
    arc_triomf: 25, montjuic: 50, placa_espanya: 45, glories: 35, poblenou: 40,
    parc_guell: 60, eixample: 17, waterfront: 55,
  }
}

function cell(props: CityCoreCellProps): Feature<Polygon, CityCoreCellProps> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }
}

const GRID: CityCoreGrid = { type: 'FeatureCollection', features: [cell(makeProps())] }

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
    _sources: sources,
    _layers: layers,
  }
}

type FakeMap = ReturnType<typeof makeFakeMap>

function renderLayer(map: FakeMap | null) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <CityCorAccessLayer />
    </MapContext.Provider>,
  )
}

describe('CityCorAccessLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useStore.setState({ cityCoreVisible: false, enabledLandmarkIds: ALL_LANDMARK_IDS })
    vi.mocked(loadCityCoreGrid).mockResolvedValue(GRID)
  })
  afterEach(() => {
    useStore.setState({ cityCoreVisible: false, enabledLandmarkIds: ALL_LANDMARK_IDS })
  })

  it('renders nothing (null)', () => {
    const { container } = renderLayer(makeFakeMap())
    expect(container.firstChild).toBeNull()
  })

  it('does not load the grid while the layer is off', () => {
    renderLayer(makeFakeMap())
    expect(loadCityCoreGrid).not.toHaveBeenCalled()
  })

  it('loads the grid and adds source + fill layer when enabled', async () => {
    useStore.setState({ cityCoreVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    expect(map.getLayer(LAYER_ID)).toBeDefined()
    expect(map.getSource(SOURCE_ID)).toBeDefined()
  })

  it('refreshes data via setData when enabled landmarks change', async () => {
    useStore.setState({ cityCoreVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    const source = map.getSource(SOURCE_ID)!
    const initialCallCount = source.setData.mock.calls.length

    act(() => useStore.setState({ enabledLandmarkIds: ['sagrada'] }))

    expect(source.setData.mock.calls.length).toBeGreaterThan(initialCallCount)
    const data = source.data as { features: { properties: { index: number } }[] }
    // sagrada = 10 min → score 100 → index = 100
    expect(data.features[0].properties.index).toBe(100)
  })

  it('adds shapes source + fill + line layers for polygon/line landmarks', async () => {
    useStore.setState({ cityCoreVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    expect(map.getSource(SHAPES_SOURCE_ID)).toBeDefined()
    expect(map.getLayer(SHAPES_FILL_LAYER)).toBeDefined()
    expect(map.getLayer(SHAPES_LINE_LAYER)).toBeDefined()
  })

  it('adds a Marker for each enabled landmark when visible', async () => {
    const maplibregl = await import('maplibre-gl')
    const MarkerSpy = vi.mocked(maplibregl.default.Marker)
    useStore.setState({ cityCoreVisible: true, enabledLandmarkIds: ['sagrada', 'barceloneta'] })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })
    // One Marker per enabled landmark
    expect(MarkerSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(mockMarker.addTo).toHaveBeenCalled()
  })

  it('removes markers when layer is toggled off', async () => {
    useStore.setState({ cityCoreVisible: true, enabledLandmarkIds: ['sagrada'] })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })
    act(() => useStore.setState({ cityCoreVisible: false }))
    expect(mockMarker.remove).toHaveBeenCalled()
  })
})
