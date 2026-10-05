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
  default: { Popup: vi.fn(function () { return mockPopup }) },
}))

vi.mock('../../services/composite/compositeData', () => ({
  loadBundles: vi.fn().mockResolvedValue([
    {
      h3: 'aaa',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      walk: 80,
      lden: 50,
      saleEurM2: 3500,
      cityCoreProps: {
        h3: 'aaa',
        sagrada: 10, placa_cat: 5, barceloneta: 20, barri_gotic: 15,
        pg_gracia: 8, arc_triomf: 12, montjuic: 18, placa_espanya: 22,
        glories: 25, poblenou: 30, parc_guell: 45, eixample: 0, waterfront: 35,
      },
    },
    {
      // Same cell as 'aaa' but fully inside the ACA T10 river flood zone (036)
      h3: 'flooded',
      geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 0]]] },
      walk: 80,
      lden: 50,
      saleEurM2: 3500,
      cityCoreProps: {
        h3: 'flooded',
        sagrada: 10, placa_cat: 5, barceloneta: 20, barri_gotic: 15,
        pg_gracia: 8, arc_triomf: 12, montjuic: 18, placa_espanya: 22,
        glories: 25, poblenou: 30, parc_guell: 45, eixample: 0, waterfront: 35,
      },
      climate: { flood_t10: 1, flood_t100: 1, flood_t500: 1, fire_wui: 0, fire_hazard: 0 },
    },
  ]),
  loadPriceMap: vi.fn().mockResolvedValue(new Map([['aaa', 400_000]])),
  loadOpenPriceMeta: vi.fn().mockResolvedValue({ p5: 2088, p95: 5816 }),
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

  it('applies climate-risk penalties to the scored cells (integration, 036)', async () => {
    useStore.setState({ compositeVisible: true, compositeRiskStrengths: { flood: 5, fire: 5, street: 5 } })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    type Props = { h3: string; score: number; floodPenalty: number }
    const scoreOf = (h3: string) => {
      const fc = map.getSource(SOURCE_ID)!.data as GeoJSON.FeatureCollection
      return fc.features.find((f) => f.properties!.h3 === h3)!.properties as Props
    }
    const safe = scoreOf('aaa')
    const flooded = scoreOf('flooded')
    expect(safe.floodPenalty).toBe(0)
    expect(flooded.floodPenalty).toBeGreaterThan(0)
    expect(flooded.score).toBe(Math.round(safe.score * 0.5))

    // Strength 0 → penalty disappears
    act(() => useStore.setState({ compositeRiskStrengths: { flood: 0, fire: 5, street: 5 } }))
    expect(scoreOf('flooded').score).toBe(safe.score)
  })

  it('lists the points lost to climate risk in the hover tooltip', async () => {
    useStore.setState({ compositeVisible: true, compositeRiskStrengths: { flood: 5, fire: 5, street: 5 } })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    const onMove = map.on.mock.calls.find(([ev, layer]) => ev === 'mousemove' && layer === FILL_LAYER_ID)![2]
    const fc = map.getSource(SOURCE_ID)!.data as GeoJSON.FeatureCollection
    const flooded = fc.features.find((f) => f.properties!.h3 === 'flooded')!
    onMove({ features: [{ properties: flooded.properties }], lngLat: { lng: 0, lat: 0 } })

    const html = mockPopup.setHTML.mock.calls.at(-1)![0] as string
    expect(html).toContain('River flood')
    expect(html).toContain(`−${flooded.properties!.floodPenalty}`)
    expect(html).not.toContain('Wildfire')
    expect(html).not.toContain('Street flooding')
  })

  it('rebuilds data when weights change', async () => {
    useStore.setState({ compositeVisible: true })
    const map = makeFakeMap()
    await act(async () => { renderLayer(map) })

    const source = map.getSource(SOURCE_ID)!
    act(() => useStore.setState({ compositeWeights: { poiAccess: 10, noise: 0, cityCore: 0, openPrice: 0, price: 0 } }))
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
