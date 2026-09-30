import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { WildfireLayer, SOURCE_ID, HAZARD_LAYER_ID, WUI_LAYER_ID } from './WildfireLayer'
import { makeFakeVectorMap, type FakeVectorMap } from '../../test/fakeVectorMap'

function renderLayer(map: FakeVectorMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <WildfireLayer />
    </MapContext.Provider>,
  )
}

describe('WildfireLayer', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ wildfireLayerVisible: false })
  })

  it('adds hazard fill and WUI outline from wildfire.pmtiles', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    const src = map.getSource(SOURCE_ID) as { url: string; attribution: string }
    expect(src.url).toMatch(/pmtiles:\/\/.*wildfire\.pmtiles$/)
    expect(src.attribution).toMatch(/Generalitat de Catalunya/)
    expect(src.attribution).toMatch(/Protecció Civil/)
    expect((map.getLayer(HAZARD_LAYER_ID) as { 'source-layer': string })['source-layer']).toBe('hazard')
    expect((map.getLayer(WUI_LAYER_ID) as { 'source-layer': string })['source-layer']).toBe('wui')
  })

  it('follows the store visibility', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    act(() => useStore.setState({ wildfireLayerVisible: true }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(HAZARD_LAYER_ID, 'visibility', 'visible')
    expect(map.setLayoutProperty).toHaveBeenCalledWith(WUI_LAYER_ID, 'visibility', 'visible')
  })

  it('removes its layers and source on unmount', () => {
    const map = makeFakeVectorMap()
    const { unmount } = renderLayer(map)
    unmount()
    expect(map.removeLayer).toHaveBeenCalledWith(HAZARD_LAYER_ID)
    expect(map.removeLayer).toHaveBeenCalledWith(WUI_LAYER_ID)
    expect(map.removeSource).toHaveBeenCalledWith(SOURCE_ID)
  })
})
