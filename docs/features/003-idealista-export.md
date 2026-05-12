# 003 · Idealista export button

## Goal

One button that opens Idealista filtered to the current isochrone zone.

## Scope

### `services/idealista.ts`

Converts `GeoJSON.Polygon` → Idealista search URL.

Steps:
1. Take `polygon.coordinates[0]` (outer ring, array of `[lng, lat]`)
2. Encode as Google Encoded Polyline — coordinates in `[lat, lng]` order (polyline spec)
3. Wrap in `((...))`: `((encoded_string))`
4. Build URL: `https://www.idealista.com/areas/venta-viviendas/mapa-google?shape=` + `encodeURIComponent(wrapped)`

Dependency: `@mapbox/polyline` (or `polyline`) for encoding.

Confirmed format from a real Idealista URL — `((gdr{Fo|gL...))` decodes to valid Barcelona coordinates.

### `ExportButton` component

- Disabled (greyed out) when `store.resultPolygon` is null
- On click: calls `idealista.ts`, opens result in new tab
- Label: "Ver en Idealista ↗"
- Position: bottom-right, floating over the map

## Done when

With a polygon on the map, clicking the button opens Idealista showing properties inside the isochrone area.
