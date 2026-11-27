import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import type * as maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { FunnelLayer } from './FunnelLayer'
import { useStore } from '../../store'
import { resetStore } from '../Conditions/testUtils'
import { cityFixture, VIBE } from '../../services/funnel/funnelFixture'
import { buildFunnelData } from '../../services/funnel/funnelWishes'

const buildings = cityFixture()
const fd = buildFunnelData(buildings, VIBE, 4)
vi.mock('../../services/funnel/funnelData', () => ({
  loadFunnelData: () => Promise.resolve({ buildings, fd }),
}))

function makeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>()
  const layers = new Set<string>()
  const map = {
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => { sources.set(id, { setData: vi.fn() }) }),
    removeSource: vi.fn((id: string) => { sources.delete(id) }),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    addLayer: vi.fn((l: { id: string }) => { layers.add(l.id) }),
    removeLayer: vi.fn((id: string) => { layers.delete(id) }),
    fitBounds: vi.fn(),
  }
  return { map, sources, layers }
}

const renderLayer = (map: unknown) => render(
  <MapContext.Provider value={map as maplibregl.Map}><FunnelLayer /></MapContext.Provider>,
)

describe('FunnelLayer', () => {
  beforeEach(() => {
    resetStore()
    useStore.setState({ funnelOpen: true, funnelPicks: [], funnelSea: false })
  })

  it('draws every building that takes part, the dropped ones and the winner as their own layers', async () => {
    const { map, layers } = makeMap()
    renderLayer(map)
    await waitFor(() => expect(map.addSource).toHaveBeenCalledTimes(1))
    const data = map.addSource.mock.calls[0][1].data as GeoJSON.FeatureCollection
    expect(data.features).toHaveLength(fd.rows.length)
    expect([...layers]).toEqual(['funnel-out', 'funnel-in', 'funnel-winner'])
  })

  it('updates the dots after each pick and marks one winner at the end', async () => {
    const { map, sources } = makeMap()
    renderLayer(map)
    await waitFor(() => expect(map.addSource).toHaveBeenCalled())
    act(() => { useStore.setState({ funnelPicks: ['quiet', 'metro', 'park', 'shops', 'new'] }) })
    const setData = sources.get('funnel')!.setData
    await waitFor(() => expect(setData).toHaveBeenCalled())
    const last = setData.mock.calls.at(-1)![0] as GeoJSON.FeatureCollection
    const props = last.features.map((f) => f.properties!)
    expect(props.filter((p) => p.w === 1)).toHaveLength(1)
    expect(props.some((p) => p.s === 1)).toBe(true) // dropped at the first step
    expect(map.fitBounds).toHaveBeenCalled()
  })

  it('with the sea, only the buildings within reach of it are drawn', async () => {
    useStore.setState({ funnelSea: true })
    const { map } = makeMap()
    renderLayer(map)
    await waitFor(() => expect(map.addSource).toHaveBeenCalled())
    const data = map.addSource.mock.calls[0][1].data as GeoJSON.FeatureCollection
    expect(data.features).toHaveLength(Array.from(fd.seaOk).filter(Boolean).length)
  })

  it('removes its layers when the funnel closes', async () => {
    const { map, layers, sources } = makeMap()
    renderLayer(map)
    await waitFor(() => expect(map.addSource).toHaveBeenCalled())
    act(() => { useStore.setState({ funnelOpen: false }) })
    await waitFor(() => expect(layers.size).toBe(0))
    expect(sources.size).toBe(0)
  })
})
