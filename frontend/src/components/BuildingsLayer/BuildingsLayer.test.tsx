import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen, within } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { useExclusionsStore } from '../../store/exclusionsStore'
import { DEFAULT_CONDITIONS } from '../../services/buildings/conditions'
import type { BuildingData } from '../../services/buildings/buildingData'

/** Two buildings inside the view (lng 0.2 / 0.8): a quiet one in a Barcelona barri, a loud one in AMB. */
const DATA: BuildingData = {
  meta: {
    count: 2, columns: [], price_bounds: { p5: 2000, p95: 6000 },
    areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 4000 }, { code: '08101', name: 'Hospitalet', kind: 'muni', price: 2500 }],
    categories: ['supermarket', 'park'], landmarks: ['sagrada'], minutes_cap: { walk: 30, cityCore: 120 },
  },
  count: 2,
  cols: {
    lng: Float32Array.from([0.2, 0.8]), lat: Float32Array.from([0.5, 0.5]),
    min_supermarket: Float32Array.from([3, 12]), min_park: Float32Array.from([8, 18]),
    cc_sagrada: Float32Array.from([10, 70]), lden_avg: Float32Array.from([50, 72]),
    area: Float32Array.from([0, 1]), river_zone: Float32Array.from([NaN, NaN]),
    fire_wui: Float32Array.from([0, 0]), fire_hazard: Float32Array.from([0, 0]),
    street_t10_cm: Float32Array.from([0, NaN]), street_t100_cm: Float32Array.from([0, NaN]),
    year_built: Float32Array.from([1925, 1968]),
  },
}

vi.mock('../../services/buildings/buildingData', async (orig) => ({
  ...(await orig<typeof import('../../services/buildings/buildingData')>()),
  loadScores: vi.fn(() => Promise.resolve(DATA)),
  loadBuildings: vi.fn(() => Promise.resolve(DATA)),
}))
vi.mock('../../services/localsOpinion/localsOpinion', async (orig) => ({
  ...(await orig<typeof import('../../services/localsOpinion/localsOpinion')>()),
  loadBarriVibe: vi.fn(() => Promise.resolve({ barris: { '01': { satisfAdj: 7.5, lowN: false } } })),
}))

vi.mock('../../hooks/useAreaJoin', () => ({ useAreaJoin: () => null }))

const popups: { text: string; removed: boolean; lngLat?: unknown }[] = []
vi.mock('maplibre-gl', () => ({
  Popup: class {
    private entry = { text: '', removed: false } as { text: string; removed: boolean; lngLat?: unknown }
    constructor() { popups.push(this.entry) }
    setLngLat(l: unknown) { this.entry.lngLat = l; return this }
    setText(t: string) { this.entry.text = t; return this }
    addTo() { return this }
    remove() { this.entry.removed = true; return this }
  },
}))

import { scoreClient } from '../../services/buildings/scoreClient'
import { AreasList } from '../AreasList/AreasList'
import { BuildingsLayer, SOURCE_ID, DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID } from './BuildingsLayer'

function makeFakeMap() {
  const sources = new Map<string, unknown>()
  const layers = new Map<string, Record<string, unknown>>()
  const states = new Map<number, Record<string, unknown>>()
  return {
    states,
    layers,
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }),
    unproject: ([x, y]: [number, number]) => ({ lng: x / 100, lat: 1 - y / 100 }),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, src: unknown) => { sources.set(id, src) }),
    hasImage: () => false,
    addImage: vi.fn(),
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string }) => { layers.set(l.id, l) },
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    setFeatureState: vi.fn(({ id }: { id: number }, s: Record<string, unknown>) => {
      states.set(id, { ...states.get(id), ...s })
    }),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    queryRenderedFeatures: vi.fn((): unknown[] => []),
    getCanvas: () => ({ style: {} as Record<string, string> }),
    getZoom: vi.fn(() => 15),
  }
}

type FakeMap = ReturnType<typeof makeFakeMap>

const handler = (map: FakeMap, event: string, layer?: string) =>
  map.on.mock.calls.filter(([e, l]) => e === event && (layer === undefined || l === layer)).at(-1)!.at(-1) as
    (e?: unknown) => void

async function renderLayer(map: FakeMap) {
  render(<MapContext.Provider value={map as never}><BuildingsLayer /></MapContext.Provider>)
  await act(async () => {})
}

describe('BuildingsLayer (TODO-046)', () => {
  beforeEach(() => {
    popups.length = 0
    useStore.setState({
      compositeVisible: true, compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, selectedBuilding: null,
      enabledWalkCategories: ['supermarket', 'park'], enabledLandmarkIds: ['sagrada'],
      compositeRiskStrengths: { flood: 5, fire: 5, street: 5 }, resultPolygon: null, compositeColorRange: [0, 100],
      ageEras: ['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'], conditions: DEFAULT_CONDITIONS,
    })
    useExclusionsStore.setState({ zones: [] })
  })

  it('adds the vector source with dots, footprints and outlines', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    expect(map.addSource).toHaveBeenCalledWith(SOURCE_ID, expect.objectContaining({ type: 'vector' }))
    expect([...map.layers.keys()]).toEqual([DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID])
    // incomplete data (060): a hatch layer gated by the `gap` feature state (and not `out`, 077), no black outline
    expect(map.addImage).toHaveBeenCalledWith('hatch-thin', expect.objectContaining({ width: expect.any(Number) }))
    expect(map.layers.get(HATCH_LAYER_ID)).toMatchObject({ type: 'fill', paint: { 'fill-pattern': 'hatch-thin' } })
    expect(map.layers.get(FILL_LAYER_ID)).toMatchObject({ 'source-layer': 'b', filter: ['==', ['geometry-type'], 'Polygon'] })
  })

  it('ranks the areas after scoring, and the dots give way to the area view below z13 (TODO-051)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    expect(map.layers.get(DOT_LAYER_ID)).toMatchObject({ minzoom: 13 })
    const ranks = useStore.getState().areaRanks!
    expect(ranks.map((r) => r.name).sort()).toEqual(['Hospitalet', 'el Raval'])
    const raval = ranks.find((r) => r.name === 'el Raval')!
    expect(raval.n).toBe(1)
    expect(raval.mean).toBe(map.states.get(0)!.score)
    expect(raval.strongest.length).toBeGreaterThan(0)
    expect(raval.ranked).toBe(false) // one building is below the minimum
  })

  it('sets every building score as feature state; the quiet central one scores higher', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    const [a, b] = [map.states.get(0)!, map.states.get(1)!]
    expect(a.score).toBeGreaterThan(b.score as number)
    expect([a.gap, b.gap]).toEqual([false, false]) // both have noise and price data; Locals' opinion is off
  })

  it('recomputes after a pause when the user changes a condition or drops a service (049)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    vi.useFakeTimers()
    try {
      const before = map.states.get(0)!.score
      act(() => useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, noise: 0, cityCore: 0, openPrice: 0 } }))
      expect(map.states.get(0)!.score).toBe(before) // not yet: waits for the slider to stop
      await act(async () => { vi.advanceTimersByTime(200) })
      expect([map.states.get(0)!.score, map.states.get(1)!.score]).toEqual([100, 50]) // services within 10 min
      act(() => useStore.getState().setConditions({ ...DEFAULT_CONDITIONS, walkMaxMin: 5 }))
      await act(async () => { vi.advanceTimersByTime(200) })
      expect([map.states.get(0)!.score, map.states.get(1)!.score]).toEqual([70, 0]) // park 8 min > 5
      const calls = map.setFeatureState.mock.calls.length
      act(() => useStore.getState().setEnabledWalkCategories(['supermarket']))
      await act(async () => { vi.advanceTimersByTime(200) })
      expect(map.states.get(0)!.score).toBe(100)
      expect(map.setFeatureState.mock.calls.length - calls).toBe(1) // only building 0 changed
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets up the source and the layers before the scores arrive, so the tiles load meanwhile (058)', async () => {
    const { loadScores } = await import('../../services/buildings/buildingData')
    let arrive!: (d: BuildingData) => void
    vi.mocked(loadScores).mockReturnValueOnce(new Promise((resolve) => { arrive = resolve }))
    const map = makeFakeMap()
    await renderLayer(map)
    expect(map.addSource).toHaveBeenCalledWith(SOURCE_ID, expect.objectContaining({ type: 'vector' }))
    expect([...map.layers.keys()]).toEqual([DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID])
    expect(map.setFeatureState).not.toHaveBeenCalled()
    await act(async () => { arrive(DATA) })
    expect(map.addSource).toHaveBeenCalledTimes(1)
    expect(map.states.get(0)!.score).toBeGreaterThan(map.states.get(1)!.score as number)
  })

  it('scores without waiting for the map, and colours the buildings when the map is ready (058)', async () => {
    useStore.setState({ buildingScores: null })
    const spy = vi.spyOn(scoreClient, 'score')
    try {
      const { rerender } = render(<MapContext.Provider value={null}><BuildingsLayer /></MapContext.Provider>)
      await act(async () => {})
      expect(spy).toHaveBeenCalledTimes(1)
      expect(useStore.getState().buildingScores).toBeNull()
      const map = makeFakeMap()
      rerender(<MapContext.Provider value={map as never}><BuildingsLayer /></MapContext.Provider>)
      await act(async () => {})
      expect(spy).toHaveBeenCalledTimes(1)
      expect(map.states.size).toBe(2)
      expect(useStore.getState().buildingScores).toHaveLength(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('asks for no building tiles while the area view is shown: every layer starts at its zoom (058)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    for (const id of [DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID]) {
      expect(map.layers.get(id)).toMatchObject({ minzoom: 13 })
    }
  })

  it('scoring runs through the score client, and a result that arrives after a newer change is not applied (058)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    const resolvers: ((r: { score: Uint8Array; gap: Uint8Array } | null) => void)[] = []
    const spy = vi.spyOn(scoreClient, 'score').mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve) }))
    vi.useFakeTimers()
    try {
      act(() => useStore.getState().setConditions({ ...DEFAULT_CONDITIONS, walkMaxMin: 5 }))
      await act(async () => { vi.advanceTimersByTime(200) })
      act(() => useStore.getState().setConditions({ ...DEFAULT_CONDITIONS, walkMaxMin: 15 }))
      await act(async () => { vi.advanceTimersByTime(200) })
      expect(resolvers).toHaveLength(2)
      expect(spy.mock.calls[1][1].conditions.walkMaxMin).toBe(15)
      await act(async () => { resolvers[0]({ score: Uint8Array.from([7, 7]), gap: Uint8Array.from([0, 0]) }) })
      expect(map.states.get(0)!.score).not.toBe(7) // the older answer is dropped
      await act(async () => { resolvers[1]({ score: Uint8Array.from([55, 44]), gap: Uint8Array.from([0, 0]) }) })
      expect([map.states.get(0)!.score, map.states.get(1)!.score]).toEqual([55, 44])
      expect(useStore.getState().buildingScores).toEqual(Uint8Array.from([55, 44]))
    } finally {
      vi.useRealTimers()
      spy.mockRestore()
    }
  })

  it('a request that the client dropped (null) changes nothing', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    const before = map.states.get(0)!.score
    const spy = vi.spyOn(scoreClient, 'score').mockResolvedValue(null)
    vi.useFakeTimers()
    try {
      act(() => useStore.getState().setConditions({ ...DEFAULT_CONDITIONS, walkMaxMin: 5 }))
      await act(async () => { vi.advanceTimersByTime(200) })
      expect(map.states.get(0)!.score).toBe(before)
    } finally {
      vi.useRealTimers()
      spy.mockRestore()
    }
  })

  it('building age (TODO-047): unticking an era rescores the buildings of that era', async () => {
    const map = makeFakeMap()
    useStore.setState({ compositeWeights: { poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0, localsOpinion: 0, age: 1 } })
    await renderLayer(map)
    expect([map.states.get(0)!.score, map.states.get(1)!.score]).toEqual([100, 100]) // every era liked
    vi.useFakeTimers()
    try {
      act(() => useStore.getState().setAgeEras(['1900-1939']))
      await act(async () => { vi.advanceTimersByTime(200) })
      expect([map.states.get(0)!.score, map.states.get(1)!.score]).toEqual([100, 0])
    } finally {
      vi.useRealTimers()
    }
  })

  it('colours on the fixed 0–100 scale and never refits: no moveend handler (TODO-050, 077)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    const color = (map.layers.get(FILL_LAYER_ID)!.paint as Record<string, unknown[]>)['fill-color']
    const stops = (color[2] as (number | string)[]).slice(3)
    expect(stops.filter((_, i) => i % 2 === 0)).toEqual([0, 25, 50, 75, 100])
    expect(stops[9]).toBe('#1a9850')
    expect(map.on.mock.calls.some(([e]) => e === 'moveend')).toBe(false)
    expect(map.setPaintProperty).not.toHaveBeenCalled()
  })

  describe('the isochrone sets the area (077)', () => {
    /** Covers building 0 (lng 0.2) only. */
    const WEST = { type: 'Polygon' as const, coordinates: [[[0, 0], [0.5, 0], [0.5, 1], [0, 1], [0, 0]]] }

    it('hides the buildings outside: opacity 0 and no hatch on `out`; removing the isochrone shows them again', async () => {
      useStore.setState({ resultPolygon: WEST })
      const map = makeFakeMap()
      await renderLayer(map)
      expect(map.states.get(1)!.out).toBe(true)
      expect(map.states.get(0)!.out).toBeUndefined() // inside: never marked
      const out = ['boolean', ['feature-state', 'out'], false]
      expect(map.layers.get(FILL_LAYER_ID)!.paint).toMatchObject({ 'fill-opacity': ['case', out, 0, 0.75] })
      expect(map.layers.get(DOT_LAYER_ID)!.paint).toMatchObject({ 'circle-opacity': ['case', out, 0, 0.85] })
      expect((map.layers.get(HATCH_LAYER_ID)!.paint as Record<string, unknown>)['fill-opacity'])
        .toEqual(['case', ['all', ['boolean', ['feature-state', 'gap'], false], ['!', out]], 1, 0])
      act(() => useStore.setState({ resultPolygon: null }))
      expect(map.states.get(1)!.out).toBe(false)
    })

    it('ranks the areas from the buildings inside only, and again when the isochrone goes', async () => {
      useStore.setState({ resultPolygon: WEST })
      const map = makeFakeMap()
      await renderLayer(map)
      expect(useStore.getState().areaRanks!.map((r) => r.name)).toEqual(['el Raval'])
      act(() => useStore.setState({ resultPolygon: null }))
      expect(useStore.getState().areaRanks!.map((r) => r.name).sort()).toEqual(['Hospitalet', 'el Raval'])
    })

    it('an exclusion zone over a building inside the isochrone hides it too', async () => {
      useStore.setState({ resultPolygon: WEST })
      useExclusionsStore.setState({
        zones: [{ id: 'z', geometry: { type: 'Polygon', coordinates: [[[0.1, 0.4], [0.3, 0.4], [0.3, 0.6], [0.1, 0.6], [0.1, 0.4]]] } }] as never,
      })
      const map = makeFakeMap()
      await renderLayer(map)
      expect(map.states.get(0)!.out).toBe(true)
      expect(useStore.getState().areaRanks).toEqual([])
    })

    it('hover, tooltip and click skip a building outside', async () => {
      useStore.setState({ resultPolygon: WEST })
      const map = makeFakeMap()
      await renderLayer(map)
      vi.useFakeTimers()
      try {
        act(() => handler(map, 'mousemove', FILL_LAYER_ID)({ features: [{ id: 1 }], lngLat: { lng: 0.8, lat: 0.5 } }))
        act(() => { vi.advanceTimersByTime(100) })
        expect(map.states.get(1)!.hover).toBeUndefined()
        expect(popups).toHaveLength(0)
        act(() => handler(map, 'click', FILL_LAYER_ID)({ features: [{ id: 1 }], point: { x: 0, y: 0 } }))
        expect(useStore.getState().selectedBuilding).toBeNull()
        act(() => handler(map, 'click', FILL_LAYER_ID)({ features: [{ id: 0 }], point: { x: 0, y: 0 } }))
        expect(useStore.getState().selectedBuilding).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it('a tap near a building outside picks nothing (TODO-062)', async () => {
      useStore.setState({ resultPolygon: WEST })
      const map = makeFakeMap()
      await renderLayer(map)
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }))
      vi.useFakeTimers()
      try {
        // The map-wide click (no layer) is the near tap.
        const nearTap = map.on.mock.calls.find(([e, l]) => e === 'click' && typeof l === 'function')![1] as unknown as (e: unknown) => void
        const near = (id: number) => map.queryRenderedFeatures.mockImplementation((p: unknown) => (Array.isArray(p) && Array.isArray(p[0]) ? [{ id }] : []))
        near(1)
        act(() => nearTap({ point: { x: 80, y: 50 }, lngLat: { lng: 0.8, lat: 0.5 } }))
        act(() => { vi.advanceTimersByTime(1000) })
        expect(useStore.getState().selectedBuilding).toBeNull()
        near(0) // inside: picked as before
        act(() => nearTap({ point: { x: 20, y: 50 }, lngLat: { lng: 0.2, lat: 0.5 } }))
        act(() => { vi.advanceTimersByTime(1000) })
        expect(useStore.getState().selectedBuilding).toBe(0)
      } finally {
        vi.useRealTimers()
        vi.unstubAllGlobals()
      }
    })

    it('stretches the colours over the buildings inside; without the isochrone the scale is 0–100 again', async () => {
      useStore.setState({ resultPolygon: WEST })
      const map = makeFakeMap()
      await renderLayer(map)
      const s = map.states.get(0)!.score as number // the only building inside: the scale is widened to 20 points
      const range = useStore.getState().compositeColorRange
      expect(range[1] - range[0]).toBe(20)
      expect(range[0]).toBeLessThanOrEqual(s)
      expect(range[1]).toBeGreaterThanOrEqual(s)
      const stops = () => {
        const call = map.setPaintProperty.mock.calls.filter(([l, p]) => l === FILL_LAYER_ID && p === 'fill-color').at(-1)!
        return ((call[2] as unknown[][])[2].slice(3) as number[]).filter((_, i) => i % 2 === 0)
      }
      expect(stops()[0]).toBe(range[0])
      expect(stops()[4]).toBe(range[1])
      expect(map.setPaintProperty).toHaveBeenCalledWith(DOT_LAYER_ID, 'circle-color', expect.anything())
      act(() => useStore.setState({ resultPolygon: null }))
      expect(useStore.getState().compositeColorRange).toEqual([0, 100])
      expect(stops()).toEqual([0, 25, 50, 75, 100])
    })

    it('while the daily trip place is being picked a click opens no card (078)', async () => {
      const map = makeFakeMap()
      await renderLayer(map)
      useStore.setState({ commutePicking: true })
      try {
        act(() => handler(map, 'click', FILL_LAYER_ID)({ features: [{ id: 0 }], point: { x: 0, y: 0 } }))
        expect(useStore.getState().selectedBuilding).toBeNull()
      } finally {
        useStore.setState({ commutePicking: false })
      }
    })

    it('the card closes when a new isochrone leaves its building outside', async () => {
      const map = makeFakeMap()
      await renderLayer(map)
      act(() => useStore.getState().setSelectedBuilding(1))
      await act(async () => { useStore.setState({ resultPolygon: WEST }) }) // the positions load first (058)
      expect(useStore.getState().selectedBuilding).toBeNull()
    })
  })

  it('on a touch screen the card waits for a possible double-tap zoom (TODO-062)', async () => {
    vi.useRealTimers()
    const map = makeFakeMap()
    await renderLayer(map)
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }))
    vi.useFakeTimers()
    const click = handler(map, 'click', FILL_LAYER_ID)
    // A single tap: the card opens after the pause.
    act(() => click({ features: [{ id: 1 }], point: { x: 0, y: 0 } }))
    expect(useStore.getState().selectedBuilding).toBeNull()
    act(() => { vi.advanceTimersByTime(300) })
    expect(useStore.getState().selectedBuilding).toBe(1)
    // A double tap: the second touch cancels the first tap's pick.
    act(() => click({ features: [{ id: 2 }], point: { x: 0, y: 0 } }))
    act(() => handler(map, 'touchstart')())
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useStore.getState().selectedBuilding).toBe(1)
    vi.unstubAllGlobals()
  })

  it('click selects a building, a second click closes it; hiding the index clears it', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    const click = handler(map, 'click', FILL_LAYER_ID)
    act(() => click({ features: [{ id: 1 }], point: { x: 0, y: 0 } }))
    expect(useStore.getState().selectedBuilding).toBe(1)
    expect(map.states.get(1)!.selected).toBe(true)
    act(() => click({ features: [{ id: 1 }], point: { x: 0, y: 0 } }))
    expect(useStore.getState().selectedBuilding).toBeNull()
    act(() => useStore.getState().setSelectedBuilding(0))
    act(() => useStore.setState({ compositeVisible: false }))
    expect(useStore.getState().selectedBuilding).toBeNull()
    expect(map.setLayoutProperty).toHaveBeenCalledWith(FILL_LAYER_ID, 'visibility', 'none')
  })

  it('with no condition on the map is neutral: layers hidden, card closed; a condition brings them back (061)', async () => {
    const map = makeFakeMap()
    await renderLayer(map)
    act(() => useStore.getState().setSelectedBuilding(0))
    act(() => useStore.setState({ compositeRiskStrengths: { flood: 0, fire: 0, street: 0 }, compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 } }))
    for (const id of [DOT_LAYER_ID, FILL_LAYER_ID, HATCH_LAYER_ID, HOVER_LAYER_ID]) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'none')
    }
    expect(useStore.getState().selectedBuilding).toBeNull()
    act(() => useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, poiAccess: 1, noise: 0, cityCore: 0, openPrice: 0 } }))
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(HOVER_LAYER_ID, 'visibility', 'visible')
  })

  describe('hover tooltip (TODO-050)', () => {
    const move = (map: FakeMap, id: number) =>
      act(() => handler(map, 'mousemove', FILL_LAYER_ID)({ features: [{ id }], lngLat: { lng: 0.2, lat: 0.5 } }))

    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('shows the band and score after a short pause, and hides on leave', async () => {
      vi.useRealTimers()
      const map = makeFakeMap()
      await renderLayer(map)
      vi.useFakeTimers()
      move(map, 0)
      expect(popups).toHaveLength(0) // debounced
      act(() => { vi.advanceTimersByTime(100) })
      expect(popups).toHaveLength(1)
      const score = map.states.get(0)!.score
      expect(popups[0].text).toMatch(/^(Great|Good|Partial|Poor) match · \d+$/)
      expect(popups[0].text).toMatch(new RegExp(`· ${score}$`))
      act(() => handler(map, 'mouseleave', FILL_LAYER_ID)())
      expect(popups[0].removed).toBe(true)
    })

    it('does not show for a quick pass across buildings', async () => {
      vi.useRealTimers()
      const map = makeFakeMap()
      await renderLayer(map)
      vi.useFakeTimers()
      move(map, 0)
      act(() => { vi.advanceTimersByTime(20) })
      move(map, 1)
      act(() => { vi.advanceTimersByTime(100) })
      expect(popups).toHaveLength(1)
      expect(popups[0].text).toMatch(new RegExp(`· ${map.states.get(1)!.score}$`))
    })

    it('is off below zoom 14 and on touch devices', async () => {
      vi.useRealTimers()
      const map = makeFakeMap()
      await renderLayer(map)
      vi.useFakeTimers()
      map.getZoom.mockReturnValue(12)
      move(map, 0)
      act(() => { vi.advanceTimersByTime(100) })
      expect(popups).toHaveLength(0)
      map.getZoom.mockReturnValue(15)
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(hover: none)' }))
      move(map, 1)
      act(() => { vi.advanceTimersByTime(100) })
      expect(popups).toHaveLength(0)
      vi.unstubAllGlobals()
    })
  })
})

describe('integration: the commute zone in "Your areas" (077)', () => {
  /** 60 homes in el Raval (lng 0.2) and 60 in Gràcia (lng 0.8): both over the minimum of 50 for a rank. */
  const rep = (a: number, b: number) => Float32Array.from({ length: 120 }, (_, i) => (i < 60 ? a : b))
  const BIG: BuildingData = {
    meta: {
      ...DATA.meta, count: 120,
      areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 4000 }, { code: '02', name: 'Gràcia', kind: 'barri', price: 2500 }],
    },
    count: 120,
    cols: {
      lng: rep(0.2, 0.8), lat: rep(0.5, 0.5), min_supermarket: rep(3, 12), min_park: rep(8, 18), cc_sagrada: rep(10, 70),
      lden_avg: rep(50, 72), area: rep(0, 1), river_zone: rep(NaN, NaN), fire_wui: rep(0, 0), fire_hazard: rep(0, 0),
      street_t10_cm: rep(0, NaN), street_t100_cm: rep(0, NaN), year_built: rep(1925, 1968),
    },
  }
  const WEST = { type: 'Polygon' as const, coordinates: [[[0, 0], [0.5, 0], [0.5, 1], [0, 1], [0, 0]]] }
  const listed = () => within(screen.getByRole('region', { name: 'Barcelona' }))
    .queryAllByRole('button', { name: /of homes are a good match/ }).map((b) => b.getAttribute('aria-label')!.replace(/,.*/, ''))

  it('with an isochrone only the areas with homes inside are ranked; without it, the whole city again', async () => {
    const { loadScores, loadBuildings } = await import('../../services/buildings/buildingData')
    vi.mocked(loadScores).mockResolvedValueOnce(BIG)
    vi.mocked(loadBuildings).mockResolvedValue(BIG)
    useStore.setState({
      compositeVisible: true, compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, selectedBuilding: null, areaRanks: null,
      enabledWalkCategories: ['supermarket', 'park'], enabledLandmarkIds: ['sagrada'],
      compositeRiskStrengths: { flood: 5, fire: 5, street: 5 }, resultPolygon: WEST,
      ageEras: ['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'], conditions: DEFAULT_CONDITIONS,
    })
    useExclusionsStore.setState({ zones: [] })
    try {
      render(
        <>
          <MapContext.Provider value={makeFakeMap() as never}><BuildingsLayer /></MapContext.Provider>
          <AreasList />
        </>,
      )
      await act(async () => {})
      expect(listed()).toEqual(['1. el Raval'])
      act(() => useStore.setState({ resultPolygon: null }))
      expect(listed()).toHaveLength(2)
    } finally {
      vi.mocked(loadBuildings).mockResolvedValue(DATA)
    }
  })
})
