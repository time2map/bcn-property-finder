import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { FloodZonesLayer, SOURCE_ID, FILL_LAYER_ID, LINE_LAYER_ID } from './FloodZonesLayer'
import { makeFakeVectorMap, type FakeVectorMap } from '../../test/fakeVectorMap'

function renderLayer(map: FakeVectorMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <FloodZonesLayer />
    </MapContext.Provider>,
  )
}

describe('FloodZonesLayer', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ floodLayerVisible: false })
  })

  it('adds the PMTiles source with ACA attribution and hidden layers', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    const src = map.getSource(SOURCE_ID) as { url: string; attribution: string }
    expect(src.url).toMatch(/pmtiles:\/\/.*flood-zones\.pmtiles$/)
    expect(src.attribution).toMatch(/Agència Catalana de l'Aigua/)
    const fill = map.getLayer(FILL_LAYER_ID) as { layout: { visibility: string }; 'source-layer': string }
    expect(fill['source-layer']).toBe('flood')
    expect(fill.layout.visibility).toBe('none')
    expect(map.getLayer(LINE_LAYER_ID)).toBeDefined()
  })

  it('draws the most severe zone on top', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    const fill = map.getLayer(FILL_LAYER_ID) as { layout: { 'fill-sort-key': unknown } }
    expect(JSON.stringify(fill.layout['fill-sort-key'])).toContain('t10')
  })

  it('follows the store visibility', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    act(() => useStore.setState({ floodLayerVisible: true }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(FILL_LAYER_ID, 'visibility', 'visible')
    expect(map.setLayoutProperty).toHaveBeenCalledWith(LINE_LAYER_ID, 'visibility', 'visible')
  })

  it('removes its layers and source on unmount', () => {
    const map = makeFakeVectorMap()
    const { unmount } = renderLayer(map)
    unmount()
    expect(map.removeLayer).toHaveBeenCalledWith(FILL_LAYER_ID)
    expect(map.removeSource).toHaveBeenCalledWith(SOURCE_ID)
  })
})
