# 002 · Workplace marker + isochrone

## Goal

User clicks on the map → pin placed, isochrone polygon fetched from OTP2, area outside it dimmed.

## Scope

### Interaction
- **First load / no workplace set:** click anywhere on the map → places the Work marker, fires OTP2 request.
- **Workplace already set:** the marker is **draggable**. Map clicks are ignored for workplace placement — drag the marker to reposition it. This prevents accidental moves.
- Loading state while OTP2 responds.

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
Watches `workplace` and `minutes` in the store. On change: checks `localStorage` for a cached polygon (key `bcn_isochrone:{lng},{lat},{minutes}`); if found, uses it immediately without calling OTP2. On cache miss, calls `otp.ts`, writes result to `store.resultPolygon`, and saves to cache. Debounce 300ms.

The `resultPolygon` is also pre-populated **synchronously at store creation** (before any React render) by reading the cache with the URL-param workplace and minutes. This ensures no flash of empty state on reload.

### `IsochroneLayer` component
Two MapLibre layers on a single GeoJSON source (`resultPolygon`):
1. **Fill** — semi-transparent green inside the reachable zone
2. **Mask** — inverted polygon covering the rest of Barcelona, `rgba(0,0,0,0.15)` (subtle dimming, preserves map readability)

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

- First map click places the Work marker; subsequent repositioning is drag-only.
- The reachable zone lights up, the rest dims with subtle opacity (0.15).
- Changing travel time refetches (or hits cache).
- Isochrone result is cached in `localStorage` — page refresh restores it instantly without an OTP2 call.
- State survives page refresh via URL params (`lng`, `lat`, `minutes`). On first load the default workplace (Plaça de Catalunya) and time (60 min) are pre-applied.

---

See [004-public-transport-isochrone.md](004-public-transport-isochrone.md) for OTP2 backend details.
