# 002 · Workplace marker + isochrone

## Goal

User clicks on the map → pin placed, isochrone polygon fetched from OTP2, area outside it dimmed.

## Scope

### Interaction
- Click anywhere on the map → sets `store.workplace`, fires OTP2 request
- Click again → moves the marker
- Loading state while OTP2 responds

### `services/otp.ts`

Calls `GET ${VITE_OTP_URL}/otp/traveltime/isochrone` with:

| Parameter | Value |
|---|---|
| `location` | `"lat,lng"` |
| `time` | ISO-8601, next Monday 09:00 `Europe/Madrid` |
| `cutoff` | `PT${minutes}M` |
| `modes` | `WALK,TRANSIT` |

Returns `MultiPolygon` extracted from `features[0].geometry`.

### `hooks/useIsochrone.ts`
Watches `workplace` and `minutes` in the store. On change: calls `otp.ts`, writes result to `store.resultPolygon`. Debounce 300ms.

### `IsochroneLayer` component
Two MapLibre layers on a single GeoJSON source (`resultPolygon`):
1. **Fill** — semi-transparent green inside the reachable zone
2. **Mask** — inverted polygon covering the rest of Barcelona, `rgba(0,0,0,0.45)`

Inverted polygon: a large world bbox with the isochrone rings as holes. For `MultiPolygon`, each outer ring (`poly[0]`) becomes one hole.

### `FilterPanel` component
Positioned top-left, floating over the map:
- Time: slider 15 / 30 / 45 / 60 / 90 / 120 min (max 2 hours)
- Updates store on change → triggers new isochrone fetch

## Error handling

If OTP2 returns an error or network fails: keep previous polygon, show a brief toast.

## Environment

`.env.local`:
```
VITE_OTP_URL=http://localhost:8080
```

## Default state

On first load (no URL params), the store is initialised with:

| Field | Default value |
|---|---|
| `workplace` | `[2.1687, 41.3874]` — Plaça de Catalunya |
| `minutes` | `60` |

Valid minutes range: 15–120, multiples of 5.

The marker is placed and the isochrone fetched immediately — the user sees a working map without clicking anything.

## Done when

Clicking the map places a marker, the reachable zone lights up, the rest dims. Changing travel time refetches. State survives page refresh via URL params (`lng`, `lat`, `minutes`). On first load the default workplace (Plaça de Catalunya) and time (60 min) are pre-applied.

---

See [004-public-transport-isochrone.md](004-public-transport-isochrone.md) for OTP2 backend details.
