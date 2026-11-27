import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { useSearchStore } from '../../store/searchStore'
import type { AreaFeature } from '../../services/areas'
import type { AreaRank } from '../../services/areas/areaRank'

const polygon = (name: string): AreaFeature => ({
  type: 'Feature',
  properties: { id: name, name, kind: 'barri' },
  geometry: { type: 'Polygon', coordinates: [[[2, 41], [2.1, 41], [2.1, 41.1], [2, 41.1], [2, 41]]] },
})
let join: Map<number, AreaFeature> | null = null
vi.mock('../../hooks/useAreaJoin', () => ({ useAreaJoin: () => join }))

const popups: { text: string; removed: boolean }[] = []
vi.mock('maplibre-gl', () => ({
  Popup: class {
    private entry = { text: '', removed: false }
    constructor() { popups.push(this.entry) }
    setLngLat() { return this }
    setText(t: string) { this.entry.text = t; return this }
    addTo() { return this }
    remove() { this.entry.removed = true; return this }
  },
}))

import { AreasLayer, AREAS_SOURCE_ID, AREAS_FILL_ID, AREAS_HATCH_ID, AREAS_LINE_ID, AREAS_LABEL_ID } from './AreasLayer'

function makeFakeMap() {
  const sources = new Map<string, { data?: unknown }>()
  const layers = new Map<string, Record<string, unknown>>()
  const states = new Map<number, Record<string, unknown>>()
  return {
    states, layers, sources,
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, src: { data?: unknown }) => { sources.set(id, src) }),
    hasImage: () => false,
    addImage: vi.fn(),
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string }) => { layers.set(l.id, l as unknown as Record<string, unknown>) },
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    setFeatureState: vi.fn(({ id }: { id: number }, s: Record<string, unknown>) => { states.set(id, { ...states.get(id), ...s }) }),
    removeLayer: vi.fn((id: string) => { layers.delete(id) }),
    removeSource: vi.fn((id: string) => { sources.delete(id) }),
    on: vi.fn(),
    off: vi.fn(),
    getCanvas: () => ({ style: {} as Record<string, string> }),
  }
}
type FakeMap = ReturnType<typeof makeFakeMap>
const handler = (map: FakeMap, event: string) =>
  map.on.mock.calls.filter(([e]) => e === event).at(-1)!.at(-1) as (e?: unknown) => void

const rank = (index: number, extra: Partial<AreaRank> = {}): AreaRank => ({
  index, code: '01', name: `Area ${index}`, kind: 'barri', n: 1240, mean: 70, shareGood: 62, shareGreat: 10,
  gapShare: 0, incomplete: false, strongest: [], ranked: true, ...extra,
})

function renderLayer(map: FakeMap) {
  return render(<MapContext.Provider value={map as never}><AreasLayer /></MapContext.Provider>)
}

describe('AreasLayer (TODO-051)', () => {
  beforeEach(() => {
    popups.length = 0
    join = new Map([[0, polygon('Raval')], [3, polygon('Gòtic')]])
    useSearchStore.setState({ selection: null })
    useStore.setState({ compositeVisible: true, compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, compositeColorRange: [0, 100], areaRanks: null })
  })

  it('adds nothing until the polygons are matched', () => {
    join = null
    const map = makeFakeMap()
    renderLayer(map)
    expect(map.addSource).not.toHaveBeenCalled()
  })

  it('adds the areas as a source, with the index of each area as its feature id', () => {
    const map = makeFakeMap()
    renderLayer(map)
    expect(map.addSource).toHaveBeenCalledWith(AREAS_SOURCE_ID, expect.objectContaining({ type: 'geojson' }))
    const data = map.sources.get(AREAS_SOURCE_ID)!.data as { features: { id: number; properties: { areaIndex: number; name: string } }[] }
    expect(data.features.map((f) => [f.id, f.properties.areaIndex, f.properties.name])).toEqual([[0, 0, 'Raval'], [3, 3, 'Gòtic']])
  })

  it('adds fill, hatch, outline and label that show only below the building zoom', () => {
    const map = makeFakeMap()
    renderLayer(map)
    expect([...map.layers.keys()]).toEqual([AREAS_FILL_ID, AREAS_HATCH_ID, AREAS_LINE_ID, AREAS_LABEL_ID])
    for (const id of [AREAS_FILL_ID, AREAS_HATCH_ID, AREAS_LINE_ID, AREAS_LABEL_ID]) expect(map.layers.get(id)!.maxzoom).toBe(13)
    // wide hatch (060), shown only where the area is marked incomplete in the feature state
    expect(map.layers.get(AREAS_HATCH_ID)).toMatchObject({
      type: 'fill', paint: { 'fill-pattern': 'hatch-wide', 'fill-opacity': ['case', ['boolean', ['feature-state', 'incomplete'], false], 1, 0] },
    })
    expect(map.layers.get(AREAS_LABEL_ID)!.layout).toMatchObject({ 'text-field': ['get', 'name'] })
  })

  it('colours each area by its mean score through feature state', () => {
    const map = makeFakeMap()
    renderLayer(map)
    act(() => useStore.setState({ areaRanks: [rank(0, { mean: 81 }), rank(3, { mean: 42 }), rank(7, { mean: 10 })] }))
    expect(map.states.get(0)).toEqual({ score: 81, incomplete: false })
    expect(map.states.get(3)).toEqual({ score: 42, incomplete: false })
    expect(map.states.has(7)).toBe(false) // no polygon for it
  })

  it('marks the areas with too many incomplete homes for the hatch (060)', () => {
    const map = makeFakeMap()
    renderLayer(map)
    act(() => useStore.setState({ areaRanks: [rank(0, { incomplete: true, gapShare: 0.5 }), rank(3)] }))
    expect(map.states.get(0)).toMatchObject({ incomplete: true })
    expect(map.states.get(3)).toMatchObject({ incomplete: false })
  })

  it('follows the colour range of the buildings (Boost contrast)', () => {
    const map = makeFakeMap()
    renderLayer(map)
    map.setPaintProperty.mockClear()
    act(() => useStore.setState({ compositeColorRange: [40, 80] }))
    expect(map.setPaintProperty).toHaveBeenCalledWith(AREAS_FILL_ID, 'fill-color', expect.anything())
  })

  it('hides with the index and shows with it', () => {
    const map = makeFakeMap()
    renderLayer(map)
    act(() => useStore.setState({ compositeVisible: false }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(AREAS_FILL_ID, 'visibility', 'none')
    act(() => useStore.setState({ compositeVisible: true }))
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(AREAS_LABEL_ID, 'visibility', 'visible')
  })

  it('with no condition on the areas are hidden, with one they show (061)', () => {
    const map = makeFakeMap()
    renderLayer(map)
    const none = { ...DEFAULT_COMPOSITE_WEIGHTS, poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }
    act(() => useStore.setState({ compositeRiskStrengths: { flood: 0, fire: 0, street: 0 }, compositeWeights: none }))
    for (const id of [AREAS_FILL_ID, AREAS_HATCH_ID, AREAS_LINE_ID, AREAS_LABEL_ID]) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'none')
    }
    act(() => useStore.setState({ compositeWeights: { ...none, noise: 1 } }))
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(AREAS_LABEL_ID, 'visibility', 'visible')
  })

  it('hover shows the share of good homes and their number; leaving hides it', () => {
    const map = makeFakeMap()
    renderLayer(map)
    act(() => useStore.setState({ areaRanks: [rank(0, { name: 'el Raval', shareGood: 61.6, n: 1240 })] }))
    handler(map, 'mousemove')({ features: [{ id: 0 }], lngLat: { lng: 2, lat: 41 } })
    expect(popups.at(-1)!.text).toBe('el Raval: 62% good match · 1,240 homes')
    handler(map, 'mouseleave')()
    expect(popups.at(-1)!.removed).toBe(true)
  })

  it('a click on an area flies to it and outlines it', () => {
    const map = makeFakeMap()
    renderLayer(map)
    handler(map, 'click')({ features: [{ id: 3 }] })
    expect(useSearchStore.getState().selection).toMatchObject({ kind: 'area', label: 'Gòtic' })
    useSearchStore.setState({ selection: null })
    handler(map, 'click')({ features: [{ id: 99 }] })
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('removes its layers and source on unmount, and its handlers', () => {
    const map = makeFakeMap()
    const { unmount } = renderLayer(map)
    unmount()
    expect(map.layers.size).toBe(0)
    expect(map.sources.size).toBe(0)
    expect(map.off).toHaveBeenCalledWith('click', AREAS_FILL_ID, expect.any(Function))
  })
})
