import { afterEach, describe, expect, it } from 'vitest'
import { visibleBounds } from './visibleBounds'

/** A map whose unproject is the identity on pixels: bounds come out as [minX, minY, maxX, maxY] in pixels. */
const fakeMap = (width: number, height: number) =>
  ({
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
  }) as unknown as Parameters<typeof visibleBounds>[0]

function addBox(className: string, rect: Partial<DOMRect>) {
  const el = document.createElement('div')
  el.className = className
  el.getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, ...rect }) as DOMRect
  document.body.appendChild(el)
}

afterEach(() => { document.body.innerHTML = '' })

describe('visibleBounds', () => {
  it('is the whole map when nothing covers it', () => {
    expect(visibleBounds(fakeMap(1000, 600))).toEqual([0, 0, 1000, 600])
  })

  it('leaves out the left panel and the right card', () => {
    addBox('top-panel', { left: 12, right: 276 })
    addBox('building-card-overlay', { left: 700, right: 940 })
    expect(visibleBounds(fakeMap(1000, 600))).toEqual([276, 0, 700, 600])
  })

  it('leaves out the onboarding sheet at the bottom of a phone', () => {
    addBox('onboarding-sheet', { top: 380, bottom: 800 })
    expect(visibleBounds(fakeMap(375, 800))).toEqual([0, 0, 375, 380])
  })

  it('ignores a sheet that does not reach the bottom of the map', () => {
    addBox('onboarding-sheet', { top: 100, bottom: 300 })
    expect(visibleBounds(fakeMap(375, 800))).toEqual([0, 0, 375, 800])
  })
})
