import { describe, it, expect } from 'vitest'
import type { MultiPolygon, Polygon } from 'geojson'
import { inArea } from './inArea'

const square = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]

describe('inArea (077)', () => {
  it('marks the centroids inside a polygon', () => {
    const area: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 1, 1)] }
    const mask = inArea(Float32Array.from([0.5, 1.5, -0.2]), Float32Array.from([0.5, 0.5, 0.5]), area)
    expect([...mask]).toEqual([1, 0, 0])
  })

  it('handles every part of a MultiPolygon; a point in a hole (exclusion zone) is outside', () => {
    const area: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 1, 1), square(0.4, 0.4, 0.6, 0.6)], [square(2, 2, 3, 3)]],
    }
    const lng = Float32Array.from([0.2, 0.5, 2.5, 1.5])
    const lat = Float32Array.from([0.2, 0.5, 2.5, 1.5])
    expect([...inArea(lng, lat, area)]).toEqual([1, 0, 1, 0])
  })
})
