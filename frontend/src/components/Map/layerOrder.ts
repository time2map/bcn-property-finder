import type maplibregl from 'maplibre-gl'

/**
 * Canonical bottom-to-top z-order for all MapLibre layers in the app.
 * Used by addLayerOrdered to insert each layer in the right position
 * regardless of when it is first added (e.g. lazy-loaded or async layers).
 */
export const LAYER_Z_ORDER: readonly string[] = [
  // Choropleth overlays (bottom)
  'city-core-fill',
  'city-core-shapes-fill',
  'city-core-shapes-line',
  'poi-access-fill',
  'composite-fill',
  'composite-gap-outline',
  'composite-hover-outline',
  'noise-overlay',
  // Climate-risk view layers — features 036, 037
  'wildfire-hazard-fill',
  'flood-zones-fill',
  'flood-zones-line',
  'street-flooding-fill',
  'wildfire-wui-line',
  // Exclusion zones
  'exclusion-fill',
  'exclusion-line',
  // Area boundaries
  'barrio-boundaries-fill',
  'barrio-boundaries-line',
  'barrio-boundaries-label-district',
  'barrio-boundaries-label-barri',
  // Idealista export areas
  'export-areas-fill',
  'export-areas-line',
  'export-areas-label',
  // Idealista price overlay
  'idealista-prices-dots',
  'idealista-prices-labels',
  'idealista-prices-hex-fill',
  'idealista-prices-hex-outline',
  // Isochrone
  'isochrone-mask',
  'isochrone-line',
  'isochrone-label',
  // Transit
  'metro-lines',
  'metro-circles',
  'metro-labels',
  'fgc-line',
  'fgc-circle',
  'fgc-label',
  // POI icons
  'poi-priority',
  'poi-secondary',
  // Pin accuracy halos (top)
  'pin-accuracy-fill',
  'pin-accuracy-line',
]

/**
 * Add a MapLibre layer in its canonical z-position.
 *
 * Finds the first already-existing layer that appears above `anchorId`
 * in LAYER_Z_ORDER and passes it as `before` to map.addLayer().
 * Falls back to appending at top if no higher layer exists yet.
 */
export function addLayerOrdered(
  map: maplibregl.Map,
  layer: maplibregl.LayerSpecification,
  anchorId: string,
): void {
  const idx = LAYER_Z_ORDER.indexOf(anchorId)
  let beforeId: string | undefined
  for (let i = idx + 1; i < LAYER_Z_ORDER.length; i++) {
    if (map.getLayer(LAYER_Z_ORDER[i])) {
      beforeId = LAYER_Z_ORDER[i]
      break
    }
  }
  map.addLayer(layer, beforeId)
}
