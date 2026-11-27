import { describe, it, expect, vi } from 'vitest'
import { mapLayerOf, type MapLayerId } from './index'

async function freshStore() {
  vi.resetModules()
  return (await import('./index')).useStore
}
const flags = (s: { noiseLayerVisible: boolean; floodLayerVisible: boolean; streetFloodingLayerVisible: boolean; wildfireLayerVisible: boolean }) =>
  [s.noiseLayerVisible, s.floodLayerVisible, s.streetFloodingLayerVisible, s.wildfireLayerVisible]

describe('mapLayerOf', () => {
  const base = { noiseLayerVisible: false, floodLayerVisible: false, streetFloodingLayerVisible: false, wildfireLayerVisible: false }
  it('is none when no layer is on', () => expect(mapLayerOf(base)).toBe('none'))
  it.each([
    ['noise', { noiseLayerVisible: true }],
    ['river', { floodLayerVisible: true }],
    ['street', { streetFloodingLayerVisible: true }],
    ['wildfire', { wildfireLayerVisible: true }],
  ] as [MapLayerId, Partial<typeof base>][])('is %s when only that layer is on', (id, on) => {
    expect(mapLayerOf({ ...base, ...on })).toBe(id)
  })
  it('takes the first by priority when several are on: noise, river, street, wildfire', () => {
    expect(mapLayerOf({ ...base, floodLayerVisible: true, wildfireLayerVisible: true })).toBe('river')
    expect(mapLayerOf({ ...base, noiseLayerVisible: true, wildfireLayerVisible: true })).toBe('noise')
  })
})

describe('setMapLayer (TODO-052)', () => {
  it('turns exactly one layer on, in one update, and saves each flag', async () => {
    localStorage.clear()
    const s = await freshStore()
    s.getState().setNoiseLayerVisible(true)
    let updates = 0
    const unsub = s.subscribe(() => { updates++ })
    s.getState().setMapLayer('wildfire')
    unsub()
    expect(updates).toBe(1)
    expect(flags(s.getState())).toEqual([false, false, false, true])
    expect(localStorage.getItem('bcn_noise_layer_visible')).toBe('false')
    expect(localStorage.getItem('bcn_wildfire_layer_visible')).toBe('true')
  })

  it('none clears every layer', async () => {
    localStorage.clear()
    const s = await freshStore()
    s.getState().setMapLayer('river')
    s.getState().setMapLayer('none')
    expect(flags(s.getState())).toEqual([false, false, false, false])
    expect(mapLayerOf(s.getState())).toBe('none')
  })

  it('each id turns on its own flag', async () => {
    localStorage.clear()
    const s = await freshStore()
    const expected: Record<Exclude<MapLayerId, 'none'>, boolean[]> = {
      noise: [true, false, false, false], river: [false, true, false, false],
      street: [false, false, true, false], wildfire: [false, false, false, true],
    }
    for (const id of Object.keys(expected) as (keyof typeof expected)[]) {
      s.getState().setMapLayer(id)
      expect(flags(s.getState())).toEqual(expected[id])
    }
  })
})

describe('saved layers with the new panel', () => {
  it('keeps only the first layer when several were saved (the segmented control shows one)', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_flood_layer_visible', 'true')
    localStorage.setItem('bcn_wildfire_layer_visible', 'true')
    localStorage.setItem('bcn_noise_layer_visible', 'true')
    const s = await freshStore()
    expect(flags(s.getState())).toEqual([true, false, false, false])
  })

  it('a single saved layer stays', async () => {
    localStorage.clear()
    localStorage.setItem('bcn_street_flooding_layer_visible', 'true')
    const s = await freshStore()
    expect(flags(s.getState())).toEqual([false, false, true, false])
  })
})
