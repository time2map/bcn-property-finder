# 004 · Public transport isochrone

## Goal

Add a **Public transport** mode to the isochrone feature. The user gets a single isochrone polygon showing everywhere reachable by public transport — OTP2 finds the optimal route including walking to stops and any transfers it deems necessary.

## Context

Feature 002 covers foot / cycling / driving via OpenRouteService. ORS does not support public transport. This feature adds a self-hosted **OpenTripPlanner 2** instance as a second backend, used only for the public transport mode. ORS remains unchanged for all other modes.

Prerequisite: [004a-otp2-local-setup.md](004a-otp2-local-setup.md) — OTP2 must be running locally at `http://localhost:8080`.

## Transfer behaviour

OTP2's TravelTime Sandbox does not support `maxTransfers` as a per-request parameter, and OTP2 2.5.0 has no hard transfer limit in `router-config.json` either. Transfers are discouraged via `transferPenalty: 300` (5-minute cost per transfer) — OTP will still make a transfer if it saves meaningful time, which is the correct behaviour for a usability tool.

Two-container approach was considered and rejected: too much RAM (~2GB), not viable on a cheap VPS.

## API: OTP2 TravelTime Sandbox

Endpoint: `GET ${VITE_OTP_URL}/otp/traveltime/isochrone`

Transit isochrones in OTP2 live in the **SandboxAPITravelTime** feature (enabled via `otp-config.json`). The legacy `/otp/routers/default/isochrone` endpoint does not support transit mode.

| Parameter | Value |
|---|---|
| `location` | `"lat,lng"` |
| `time` | ISO-8601, default next Monday 09:00 `Europe/Madrid` |
| `cutoff` | `PT${minutes}M` |
| `modes` | `WALK,TRANSIT` |

Returns: GeoJSON `FeatureCollection` with one `MultiPolygon` feature.

Base URL from env var `VITE_OTP_URL` (default: `http://localhost:8080`).

## Data freshness

OTP2 uses **GTFS scheduled data** (TMB + FGC + Rodalies timetables). Typical weekday schedule, not real-time.

## Scope

### Transport modes

Add `public_transport` to `TransportMode` union in the store. UI label: **"Public transport"**.

Segmented control becomes: `foot | cycling | driving | public_transport`.

### `services/otp.ts` (new file)

```ts
fetchOtpIsochrone(lngLat: [number, number], minutes: number): Promise<Polygon>
```

- Calls `GET ${VITE_OTP_URL}/otp/traveltime/isochrone`
- `time` defaults to next Monday 09:00 `Europe/Madrid` (ISO-8601 with offset)
- `cutoff` = `PT${minutes}M`
- `modes=WALK,TRANSIT`
- Extracts `features[0].geometry` from the `FeatureCollection` response
- Response geometry is `MultiPolygon` — pass through as-is (MapLibre handles it)

### `services/ors.ts`

No changes.

### `hooks/useIsochrone.ts`

Route by mode:
- `public_transport` → `fetchOtpIsochrone`
- everything else → `fetchIsochrone` (ORS)

Store type for `resultPolygon` needs to accept both `Polygon` and `MultiPolygon`.

### `FilterPanel` component

- Add `public_transport` option to the segmented control
- Display a short description below the segmented control for the active mode:

| Mode | Description |
|---|---|
| Foot | Walking at average pace (~5 km/h). Via OpenRouteService. |
| Cycling | Regular cycling (~15 km/h). Via OpenRouteService. |
| Driving | Car, typical road speeds. Via OpenRouteService. |
| Public transport | Walk to nearest stop + optimal route (transfers allowed if they save time). Scheduled timetables, typical Mon 09:00. |

## Environment variables

```
VITE_OTP_URL=http://localhost:8080
```

## Error handling

Same as 002: keep previous polygon on error, show a brief toast.

## Out of scope (v1)

- Departure time picker in UI (hardcoded to Mon 09:00)
- VPS deployment (see future 004b)
- Real-time departures

## Done when

1. Selecting "Public transport" fetches and displays an OTP2-based isochrone.
2. Mode description hint is visible for the active mode.
3. Foot / cycling / driving still work via ORS.
4. Unit tests cover `otp.ts` (mocked fetch) and mode-routing in `useIsochrone.ts`.
5. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
6. Manually verified on dev server with OTP2 running locally.
