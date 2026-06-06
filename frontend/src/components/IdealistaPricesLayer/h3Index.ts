import { latLngToCell, cellToBoundary } from 'h3-js'

const H3_RESOLUTION = 9

export interface H3Cell {
  h3Index: string
  medianPrice: number
  count: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function aggregateToH3(
  features: GeoJSON.Feature<GeoJSON.Point>[],
  minPrice: number,
  maxPrice: number,
): H3Cell[] {
  const buckets = new Map<string, number[]>()

  for (const f of features) {
    const price = f.properties?.price as number | undefined
    if (!price || price < minPrice || price > maxPrice) continue
    const [lng, lat] = f.geometry.coordinates
    const idx = latLngToCell(lat, lng, H3_RESOLUTION)
    const bucket = buckets.get(idx)
    if (bucket) bucket.push(price)
    else buckets.set(idx, [price])
  }

  return Array.from(buckets.entries()).map(([h3Index, prices]) => ({
    h3Index,
    medianPrice: median(prices),
    count: prices.length,
  }))
}

export function h3CellsToGeoJSON(cells: H3Cell[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => {
      const boundary = cellToBoundary(cell.h3Index)
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...boundary.map(([lat, lng]) => [lng, lat]), [boundary[0][1], boundary[0][0]]]],
        },
        properties: {
          h3Index: cell.h3Index,
          price: cell.medianPrice,
          count: cell.count,
          priceText: new Intl.NumberFormat('en-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cell.medianPrice),
        },
      }
    }),
  }
}
