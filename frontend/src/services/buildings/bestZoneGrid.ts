import { latLngToCell } from 'h3-js'
import type { BuildingData } from './buildingData'

// The grid of Best zones (038, TODO-046). Kept apart from buildingScore.ts so that the scoring worker
// (TODO-058) does not pull h3-js into its bundle.

/** H3 cell of every building centroid — Best zones (038) work on the res-9 grid. */
export function centroidCells(data: BuildingData, res: number): string[] {
  const cells = new Array<string>(data.count)
  for (let i = 0; i < data.count; i++) cells[i] = latLngToCell(data.cols.lat[i], data.cols.lng[i], res)
  return cells
}

/** Mean building score per cell. */
export function cellMeans(score: ArrayLike<number>, cells: readonly string[]): Map<string, number> {
  const sums = new Map<string, number>()
  const counts = new Map<string, number>()
  for (let i = 0; i < cells.length; i++) {
    sums.set(cells[i], (sums.get(cells[i]) ?? 0) + score[i])
    counts.set(cells[i], (counts.get(cells[i]) ?? 0) + 1)
  }
  return new Map([...sums].map(([h, sum]) => [h, sum / counts.get(h)!]))
}
