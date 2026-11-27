import { describe, it, expect } from 'vitest'
import { latLngToCell } from 'h3-js'
import type { BuildingData } from './buildingData'
import { cellMeans, centroidCells } from './bestZoneGrid'

/** Building rows as columns, like the decoded score blob. */
function makeData(rows: Record<string, number[]>): BuildingData {
  const count = Object.values(rows)[0].length
  const cols = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Float32Array.from(v)]))
  return { meta: { count } as never, count, cols }
}

describe('Best zones grid (TODO-046)', () => {
  it('puts each centroid in its H3 cell and averages the scores per cell', () => {
    const data = makeData({ lat: [41.39, 41.39001, 41.42], lng: [2.17, 2.17001, 2.2] })
    const cells = centroidCells(data, 9)
    expect(cells[0]).toBe(latLngToCell(41.39, 2.17, 9))
    expect(cells[1]).toBe(cells[0])
    expect(cells[2]).not.toBe(cells[0])
    expect(cellMeans([60, 81, 10], cells)).toEqual(new Map([[cells[0], 70.5], [cells[2], 10]]))
  })
})
