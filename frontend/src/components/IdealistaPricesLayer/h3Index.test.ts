import { describe, it, expect } from 'vitest'
import { aggregateToH3, h3CellsToGeoJSON } from './h3Index'

function makeFeature(lng: number, lat: number, price: number): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { price, adId: Math.random(), priceText: `${price}€` },
  }
}

const BCN = { lat: 41.385, lng: 2.173 }

describe('aggregateToH3', () => {
  it('groups nearby points into same hex', () => {
    const features = [
      makeFeature(BCN.lng, BCN.lat, 300_000),
      makeFeature(BCN.lng + 0.0001, BCN.lat + 0.0001, 400_000),
    ]
    const cells = aggregateToH3(features, 0, 2_000_000)
    // Both points are very close — same hex at res 8
    expect(cells.length).toBe(1)
    expect(cells[0].count).toBe(2)
    expect(cells[0].medianPrice).toBe(350_000)
  })

  it('separates distant points into different hexes', () => {
    const features = [
      makeFeature(2.1, 41.38, 200_000),
      makeFeature(2.19, 41.42, 600_000),
    ]
    const cells = aggregateToH3(features, 0, 2_000_000)
    expect(cells.length).toBe(2)
  })

  it('filters out points outside price range', () => {
    const features = [
      makeFeature(BCN.lng, BCN.lat, 100_000),
      makeFeature(BCN.lng, BCN.lat, 900_000),
    ]
    const cells = aggregateToH3(features, 200_000, 800_000)
    expect(cells.length).toBe(0)
  })

  it('computes correct median for odd count', () => {
    const features = [
      makeFeature(BCN.lng, BCN.lat, 100_000),
      makeFeature(BCN.lng + 0.0001, BCN.lat, 200_000),
      makeFeature(BCN.lng + 0.0002, BCN.lat, 300_000),
    ]
    const cells = aggregateToH3(features, 0, 2_000_000)
    expect(cells.length).toBe(1)
    expect(cells[0].medianPrice).toBe(200_000)
  })

  it('returns empty for empty input', () => {
    expect(aggregateToH3([], 0, 1_000_000)).toEqual([])
  })
})

describe('h3CellsToGeoJSON', () => {
  it('produces valid FeatureCollection', () => {
    const features = [makeFeature(BCN.lng, BCN.lat, 350_000)]
    const cells = aggregateToH3(features, 0, 2_000_000)
    const geojson = h3CellsToGeoJSON(cells)

    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features.length).toBe(1)

    const f = geojson.features[0]
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties?.price).toBe(350_000)
    expect(f.properties?.count).toBe(1)
    // Polygon ring closes on itself
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })
})
