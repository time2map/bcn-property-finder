const GEOJSON_URL = '/data/idealista_prices.geojson'

let cache: Promise<GeoJSON.Feature<GeoJSON.Point>[]> | null = null

export function loadIdealistaFeatures(): Promise<GeoJSON.Feature<GeoJSON.Point>[]> {
  if (!cache) {
    cache = fetch(GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load Idealista data: ${r.status}`)
        return r.json() as Promise<GeoJSON.FeatureCollection<GeoJSON.Point>>
      })
      .then((fc) => fc.features)
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

export function resetIdealistaCache(): void {
  cache = null
}
