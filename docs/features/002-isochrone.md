# 002 · Workplace marker + isochrone

## Goal

User clicks on the map → pin placed, isochrone polygon fetched from ORS, area outside it dimmed.

## Scope

### Interaction
- Click anywhere on the map → sets `store.workplace`, fires ORS request
- Click again → moves the marker
- Loading state while ORS responds (pin shows spinner or pulse)

### `services/ors.ts`
Calls `POST https://api.openrouteservice.org/v2/isochrones/{profile}` with:
```json
{ "locations": [[lng, lat]], "range": [minutes * 60] }
```
Returns the first `Feature.geometry` as `GeoJSON.Polygon`. API key read from `import.meta.env.VITE_ORS_API_KEY`.

### `hooks/useIsochrone.ts`
Watches `workplace`, `mode`, `minutes` in the store. On change: calls `ors.ts`, writes result to `store.resultPolygon`. Debounce 300ms.

### `IsochroneLayer` component
Two MapLibre layers on a single GeoJSON source (`resultPolygon`):
1. **Fill** — semi-transparent green inside the reachable zone
2. **Mask** — inverted polygon covering the rest of Barcelona, `rgba(0,0,0,0.45)`

Inverted polygon: a large world bbox with the isochrone as a hole (`coordinates[0]` = outer ring of world, `coordinates[1]` = isochrone ring).

### `FilterPanel` component
Positioned top-left, floating over the map:
- Transport mode: segmented control `foot | cycling | driving`
- Time: slider 15 / 30 / 45 / 60 / 90 / 120 min (max 2 hours)
- Updates store on change → triggers new isochrone fetch

## ORS profiles mapping

| UI label | ORS profile |
|---|---|
| foot | `foot-walking` |
| cycling | `cycling-regular` |
| driving | `driving-car` |

## Error handling

If ORS returns an error or network fails: keep previous polygon, show a brief toast.

## Environment

`.env.local`:
```
VITE_ORS_API_KEY=your_key_here
```

## Default state

On first load (no URL params), the store is initialised with:

| Field | Default value |
|---|---|
| `workplace` | `{ lng: 2.1687, lat: 41.3874 }` — Plaça de Catalunya |
| `mode` | `foot` |
| `minutes` | `60` |

Valid minutes range: 15–120, multiples of 5.

The marker is placed and the isochrone fetched immediately — the user sees a working map without clicking anything.

## Done when

Clicking the map places a marker, the reachable zone lights up, the rest dims. Changing mode/time refetches. State survives page refresh via URL params. On first load the default workplace (Plaça de Catalunya), mode (transit), and time (30 min) are pre-applied.
