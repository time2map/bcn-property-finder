import { describe, expect, it, vi } from 'vitest'
import { captureMap, layersToHide, sourceRect } from './captureMap'

describe('layersToHide', () => {
  it('hides shop icons and labels, keeps street names, hides contour lines', () => {
    const layers = [
      { id: 'background', type: 'background' },
      { id: 'poi_r20', type: 'symbol' },
      { id: 'mountain_peak-z14', type: 'symbol' },
      { id: 'transportation_name-street', type: 'symbol' },
      { id: 'contour_line', type: 'line' },
      { id: 'road-minor', type: 'line' },
      { id: 'buildings-fill', type: 'fill' },
    ]
    expect(layersToHide(layers)).toEqual(['poi_r20', 'mountain_peak-z14', 'contour_line'])
  })
})

describe('sourceRect', () => {
  const out = { width: 1000, height: 500 }
  it('looks at twice the area when the map is big enough', () => {
    const r = sourceRect({ width: 4000, height: 3000 }, out, { x: 2000, y: 1500 }, { x: 500, y: 250 })
    expect(r).toEqual({ sx: 1000, sy: 1000, sw: 2000, sh: 1000 })
  })
  it('puts the place on the focus point', () => {
    const r = sourceRect({ width: 4000, height: 3000 }, out, { x: 2000, y: 1500 }, { x: 250, y: 250 })
    expect(r.sx).toBe(1500)
  })
  it('looks at as much as lets the place sit on the focus, when the map is small', () => {
    // A 4:5 picture from a landscape map: the place at the middle with the focus 21% down needs a narrow view.
    const r = sourceRect({ width: 2880, height: 1800 }, { width: 1080, height: 1350 }, { x: 1440, y: 900 }, { x: 540, y: 280 })
    expect(r.sh).toBeCloseTo(900 / (1 - 280 / 1350), 5)
    expect(r.sy).toBeCloseTo(900 - (280 / 1350) * r.sh, 5)
    expect(r.sx + (540 / 1080) * r.sw).toBeCloseTo(1440, 5)
  })
  it('moves back inside the map at an edge, at the smallest view', () => {
    const r = sourceRect({ width: 4000, height: 3000 }, out, { x: 100, y: 2900 }, { x: 500, y: 250 })
    expect(r).toEqual({ sx: 0, sy: 2750, sw: 500, sh: 250 })
  })
  it('scales down to the map on a small screen', () => {
    const r = sourceRect({ width: 1170, height: 1992 }, { width: 1200, height: 630 }, { x: 600, y: 900 }, { x: 300, y: 315 })
    expect(r.sw).toBeCloseTo(760)
    expect(r.sx).toBeCloseTo(410)
    expect(r.sx + (300 / 1200) * r.sw).toBeCloseTo(600)
  })
})

describe('captureMap', () => {
  type Handler = () => void
  function fakeMap(opts: { fail?: boolean; ratio?: number } = {}) {
    const visibility = new Map<string, string>()
    const handlers = new Map<string, Handler>()
    let ratio = opts.ratio ?? 1
    const canvas = { width: 2000, height: 1200, clientWidth: 1000 }
    const map = {
      getStyle: () => ({ layers: [{ id: 'poi_r20', type: 'symbol' }, { id: 'transportation_name-street', type: 'symbol' }, { id: 'contour', type: 'line' }, { id: 'old', type: 'symbol' }] }),
      getLayoutProperty: (id: string) => (id === 'old' ? 'none' : visibility.get(id)),
      setLayoutProperty: (id: string, _p: string, v: string) => { visibility.set(id, v) },
      getLayer: () => true,
      getCanvas: () => canvas,
      getPixelRatio: () => ratio,
      setPixelRatio: vi.fn((r: number) => { ratio = r }),
      project: () => { if (opts.fail) throw new Error('lost context'); return { x: 500, y: 300 } },
      once: (e: string, fn: Handler) => { handlers.set(e, fn) },
      triggerRepaint: vi.fn(),
    }
    /** Fires the next 'idle' and then the next 'render', as the map does. */
    const fire = async () => {
      await Promise.resolve()
      handlers.get('idle')?.()
      await Promise.resolve()
      await Promise.resolve()
      handlers.get('render')?.()
    }
    return { map, visibility, fire, ratio: () => ratio }
  }
  const slot = { width: 1200, height: 630, focus: { x: 328, y: 315 } }

  it('hides the noisy layers and sharpens the map, draws the snapshot with the place on the focus, and puts everything back', async () => {
    const { map, visibility, fire, ratio } = fakeMap()
    const drawImage = vi.fn()
    const done = captureMap(map as never, [2.16, 41.39])({ drawImage } as never, slot)
    await Promise.resolve()
    expect([...visibility]).toEqual([['poi_r20', 'none'], ['contour', 'none']]) // 'old' was hidden already: left alone
    expect(ratio()).toBe(2)
    await fire()
    const at = await done
    expect(drawImage).toHaveBeenCalledTimes(1)
    expect(at).not.toBeNull()
    expect(at!.x).toBeCloseTo(328, 0)
    expect([...visibility]).toEqual([['poi_r20', 'visible'], ['contour', 'visible']])
    expect(ratio()).toBe(1)
    expect(map.triggerRepaint).toHaveBeenCalled()
  })

  it('leaves the pixel ratio alone when the screen is sharp already', async () => {
    const { map, fire } = fakeMap({ ratio: 3 })
    const done = captureMap(map as never, [2.16, 41.39])({ drawImage: vi.fn() } as never, slot)
    await Promise.resolve()
    await fire()
    await done
    expect(map.setPixelRatio).not.toHaveBeenCalled()
  })

  it('resolves to null and still restores the layers when the map cannot be read', async () => {
    const { map, visibility, fire, ratio } = fakeMap({ fail: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const done = captureMap(map as never, [2.16, 41.39])({ drawImage: vi.fn() } as never, slot)
    await Promise.resolve()
    await fire()
    expect(await done).toBeNull()
    expect([...visibility]).toEqual([['poi_r20', 'visible'], ['contour', 'visible']])
    expect(ratio()).toBe(1)
  })
})
