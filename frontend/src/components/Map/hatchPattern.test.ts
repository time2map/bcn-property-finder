import { describe, it, expect, vi } from 'vitest'
import { hatchImage, ensureHatchImages, HATCH_THIN, HATCH_WIDE } from './hatchPattern'

const alphaAt = (img: { width: number; data: Uint8ClampedArray }, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3]

describe('hatchImage (060)', () => {
  it('is a square tile of the given period', () => {
    const img = hatchImage(6, 2)
    expect([img.width, img.height, img.data.length]).toEqual([6, 6, 6 * 6 * 4])
  })

  it('draws diagonal stripes of the given width in light, partly transparent pixels', () => {
    const img = hatchImage(6, 2, 0.5)
    // (x + y) mod 6 < 2 is stripe
    expect(alphaAt(img, 0, 0)).toBeGreaterThan(0)
    expect(alphaAt(img, 1, 0)).toBeGreaterThan(0)
    expect(alphaAt(img, 2, 0)).toBe(0)
    expect(alphaAt(img, 5, 1)).toBeGreaterThan(0) // 5 + 1 = 6 → 0: the stripe runs diagonally
    expect([...img.data.slice(0, 3)]).toEqual([255, 255, 255])
    const stripes = Array.from({ length: 36 }, (_, i) => img.data[i * 4 + 3]).filter((a) => a > 0).length
    expect(stripes).toBe(12) // 2 of every 6 diagonals
  })

  it('the area hatch is wider than the building hatch', () => {
    expect(HATCH_WIDE.period).toBeGreaterThan(HATCH_THIN.period)
    expect(HATCH_WIDE.stripe).toBeGreaterThan(HATCH_THIN.stripe)
  })
})

describe('ensureHatchImages', () => {
  it('registers each pattern once', () => {
    const have = new Set<string>()
    const map = { hasImage: (id: string) => have.has(id), addImage: vi.fn((id: string) => { have.add(id) }) }
    ensureHatchImages(map as never)
    ensureHatchImages(map as never)
    expect(map.addImage).toHaveBeenCalledTimes(2)
    expect(map.addImage).toHaveBeenCalledWith(HATCH_THIN.id, expect.objectContaining({ width: HATCH_THIN.period }))
    expect(map.addImage).toHaveBeenCalledWith(HATCH_WIDE.id, expect.objectContaining({ width: HATCH_WIDE.period }))
  })
})
