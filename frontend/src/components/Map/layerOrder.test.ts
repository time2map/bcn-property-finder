import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as maplibregl from 'maplibre-gl'
import { addLayerOrdered, LAYER_Z_ORDER } from './layerOrder'

function fakeMap(existing: string[]) {
  const layers = new Set(existing)
  const styleAddLayer = vi.fn()
  const map = {
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    addLayer: vi.fn((l: { id: string }) => { layers.add(l.id) }),
    style: { addLayer: styleAddLayer },
    _update: vi.fn(),
  }
  return { map, styleAddLayer }
}
const layer = (id: string) => ({ id, type: 'fill', source: 's' }) as maplibregl.LayerSpecification

describe('addLayerOrdered', () => {
  const [low, mid, high] = [LAYER_Z_ORDER[0], LAYER_Z_ORDER[3], LAYER_Z_ORDER[LAYER_Z_ORDER.length - 1]]

  it('puts a layer under the nearest existing layer above it in the canonical order', () => {
    const { map } = fakeMap([high])
    addLayerOrdered(map as never, layer(mid), mid)
    expect(map.addLayer).toHaveBeenLastCalledWith(layer(mid), high)
    addLayerOrdered(map as never, layer(low), low)
    expect(map.addLayer).toHaveBeenLastCalledWith(layer(low), mid)
  })

  it('puts it on top when nothing above exists yet', () => {
    const { map } = fakeMap([low])
    addLayerOrdered(map as never, layer(mid), mid)
    expect(map.addLayer).toHaveBeenLastCalledWith(layer(mid), undefined)
  })

  it('validates the layer in development and in tests (the public map.addLayer)', () => {
    const { map, styleAddLayer } = fakeMap([])
    addLayerOrdered(map as never, layer(mid), mid)
    expect(map.addLayer).toHaveBeenCalledTimes(1)
    expect(styleAddLayer).not.toHaveBeenCalled()
  })

  describe('in the production build', () => {
    beforeEach(() => { import.meta.env.DEV = false })
    afterEach(() => { import.meta.env.DEV = true })

    it('adds the layer without the validation and asks the map to redraw (058)', () => {
      const { map, styleAddLayer } = fakeMap([high])
      addLayerOrdered(map as never, layer(mid), mid)
      expect(styleAddLayer).toHaveBeenCalledWith(layer(mid), high, { validate: false })
      expect(map._update).toHaveBeenCalledWith(true)
      expect(map.addLayer).not.toHaveBeenCalled()
    })

    it('uses the public map.addLayer when MapLibre no longer has these internals', () => {
      const { map } = fakeMap([])
      addLayerOrdered({ ...map, style: {} } as never, layer(mid), mid)
      addLayerOrdered({ ...map, _update: undefined } as never, layer(low), low)
      expect(map.addLayer).toHaveBeenCalledTimes(2)
    })
  })
})
