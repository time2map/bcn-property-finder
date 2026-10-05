import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { StreetFloodingLayer, SOURCE_ID, FILL_LAYER_ID, STREET_DEPTH_STYLES } from './StreetFloodingLayer'
import { FLOOD_ZONE_STYLES } from '../FloodZonesLayer/FloodZonesLayer'
import { makeFakeVectorMap, type FakeVectorMap } from '../../test/fakeVectorMap'

function renderLayer(map: FakeVectorMap) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <StreetFloodingLayer />
    </MapContext.Provider>,
  )
}

describe('StreetFloodingLayer', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ streetFloodingLayerVisible: false, streetFloodingReturnPeriod: 't10' })
  })

  it('adds the RESCCUE depth tiles with attribution, hidden, filtered to T10', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    const src = map.getSource(SOURCE_ID) as { url: string; attribution: string }
    expect(src.url).toMatch(/pmtiles:\/\/.*street-flooding\.pmtiles$/)
    expect(src.attribution).toMatch(/RESCCUE/)
    expect(src.attribution).toMatch(/Ajuntament de Barcelona/)
    const fill = map.getLayer(FILL_LAYER_ID) as { layout: { visibility: string }; filter: unknown; 'source-layer': string }
    expect(fill['source-layer']).toBe('street')
    expect(fill.layout.visibility).toBe('none')
    expect(fill.filter).toEqual(['==', ['get', 'rp'], 't10'])
  })

  it('never reuses a river-flood colour', () => {
    const river = FLOOD_ZONE_STYLES.map((s) => s.color)
    for (const s of STREET_DEPTH_STYLES) expect(river).not.toContain(s.color)
  })

  it('follows visibility and return period from the store', () => {
    const map = makeFakeVectorMap()
    renderLayer(map)
    act(() => useStore.setState({ streetFloodingLayerVisible: true, streetFloodingReturnPeriod: 't100' }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith(FILL_LAYER_ID, 'visibility', 'visible')
    expect(map.setFilter).toHaveBeenCalledWith(FILL_LAYER_ID, ['==', ['get', 'rp'], 't100'])
  })

  it('removes its layer and source on unmount', () => {
    const map = makeFakeVectorMap()
    const { unmount } = renderLayer(map)
    unmount()
    expect(map.removeLayer).toHaveBeenCalledWith(FILL_LAYER_ID)
    expect(map.removeSource).toHaveBeenCalledWith(SOURCE_ID)
  })
})
