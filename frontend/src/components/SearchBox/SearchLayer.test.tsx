import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useSearchStore } from '../../store/searchStore'
import { useStore } from '../../store'
import { SearchLayer } from './SearchLayer'

const marker = { setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() }
vi.mock('maplibre-gl', () => ({ Marker: vi.fn(function () { return marker }) }))

function fakeMap() {
  const source = { setData: vi.fn() }
  return {
    source,
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn().mockReturnValue(undefined),
    getSource: vi.fn().mockReturnValue(source),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getContainer: () => document.createElement('div'),
    unproject: vi.fn(),
    queryRenderedFeatures: vi.fn().mockReturnValue([]),
  }
}

function mount(map: ReturnType<typeof fakeMap>) {
  return render(
    <MapContext.Provider value={map as never}>
      <SearchLayer />
    </MapContext.Provider>,
  )
}

const outline = { type: 'FeatureCollection', features: [] } as never

describe('SearchLayer', () => {
  beforeEach(() => {
    useSearchStore.getState().clear()
    vi.clearAllMocks()
  })

  it('adds the outline source and layers once', () => {
    const map = fakeMap()
    mount(map)
    expect(map.addSource).toHaveBeenCalledWith('search-area', expect.objectContaining({ type: 'geojson' }))
    expect(map.addLayer).toHaveBeenCalledTimes(2)
  })

  it('fits the map to a selected area and draws its outline', () => {
    const map = fakeMap()
    mount(map)
    act(() => useSearchStore.getState().selectArea('El Born', [2.17, 41.38, 2.19, 41.39], outline))
    expect(map.fitBounds).toHaveBeenCalledWith([[2.17, 41.38], [2.19, 41.39]], expect.objectContaining({ padding: expect.anything() }))
    expect(map.source.setData).toHaveBeenLastCalledWith(outline)
  })

  it('flies to an address, drops a marker and clears the outline', () => {
    const map = fakeMap()
    mount(map)
    act(() => useSearchStore.getState().selectAddress('Carrer X 1', [2.16, 41.39]))
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [2.16, 41.39], zoom: 17 }))
    expect(marker.setLngLat).toHaveBeenCalledWith([2.16, 41.39])
    expect(marker.addTo).toHaveBeenCalledWith(map)
  })

  it('removes the marker and the outline when cleared', () => {
    const map = fakeMap()
    mount(map)
    act(() => useSearchStore.getState().selectAddress('Carrer X 1', [2.16, 41.39]))
    act(() => useSearchStore.getState().clear())
    expect(marker.remove).toHaveBeenCalled()
    expect(map.source.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] })
  })

  it('drops the area outline when a building is picked', () => {
    mount(fakeMap())
    act(() => useSearchStore.getState().selectArea('El Born', [2.17, 41.38, 2.19, 41.39], outline))
    act(() => useStore.getState().setSelectedBuilding(3))
    expect(useSearchStore.getState().selection).toBeNull()
    act(() => useStore.getState().setSelectedBuilding(null))
  })

  it('drops the area outline on a click on the empty map, keeps it on a click on a layer', () => {
    const map = fakeMap()
    mount(map)
    act(() => useSearchStore.getState().selectArea('El Born', [2.17, 41.38, 2.19, 41.39], outline))
    const click = map.on.mock.calls.find(([name]) => name === 'click')![1] as (e: unknown) => void
    map.getLayer.mockReturnValue({})
    map.queryRenderedFeatures.mockReturnValue([{}])
    act(() => click({ point: { x: 1, y: 1 } }))
    expect(useSearchStore.getState().selection).not.toBeNull()
    map.queryRenderedFeatures.mockReturnValue([])
    act(() => click({ point: { x: 1, y: 1 } }))
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('clears the selection on Escape', () => {
    mount(fakeMap())
    act(() => useSearchStore.getState().selectAddress('A', [1, 1]))
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(useSearchStore.getState().selection).toBeNull()
  })
})
