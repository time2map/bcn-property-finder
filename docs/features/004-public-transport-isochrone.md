# 004 · Public transport isochrone

## Goal

Single isochrone mode: everywhere reachable by public transport within N minutes. OTP2 finds the optimal route including walking to stops and any transfers it deems necessary.

## Architecture

The app uses a single backend — a self-hosted **OpenTripPlanner 2** instance — for all isochrone requests. ORS (OpenRouteService) is not used.

Prerequisite: [004a-otp2-local-setup.md](004a-otp2-local-setup.md) — OTP2 must be running locally at `http://localhost:8080`.

## Why OTP2 only supports transit isochrones

OTP2's TravelTime Sandbox endpoint (`/otp/traveltime/isochrone`) always runs Raptor (the transit routing algorithm) regardless of the `modes` parameter. This is because `TravelTimeResource.java` calls `allowEmptyAccessEgressPaths(true)`, meaning transit is always active. There is no way to get a walk-only or car-only isochrone from this endpoint.

The OTP2 GraphQL API (`/otp/routers/default/index/graphql`) supports point-to-point routing but has no isochrone query, making it impractical for this use case.

## Transfer behaviour

Transfers are discouraged via `transferPenalty: 300` in `router-config.json` (5-minute cost per transfer). OTP will still transfer if it saves meaningful time.

## API: OTP2 TravelTime Sandbox

Endpoint: `GET ${VITE_OTP_URL}/otp/traveltime/isochrone`

Transit isochrones live in the **SandboxAPITravelTime** feature (enabled via `otp-config.json`).

| Parameter | Value |
|---|---|
| `location` | `"lat,lng"` |
| `time` | ISO-8601, next Monday 09:00 `Europe/Madrid` |
| `cutoff` | `PT${minutes}M` |
| `modes` | `WALK,TRANSIT` (hardcoded) |

Returns: GeoJSON `FeatureCollection` with one `MultiPolygon` feature.

Base URL from env var `VITE_OTP_URL` (default: `http://localhost:8080`).

## Data freshness

OTP2 uses **GTFS scheduled data** (TMB + FGC + Rodalies timetables). Typical weekday schedule, not real-time.

## `services/otp.ts`

```ts
fetchOtpIsochrone(lngLat: [number, number], minutes: number): Promise<MultiPolygon>
```

- `getNextMondayMadridISO()` — computes next Monday 09:00 Europe/Madrid as ISO-8601 with UTC offset via `Intl.DateTimeFormat` `longOffset`
- Extracts `features[0].geometry` from the `FeatureCollection` response

## `hooks/useIsochrone.ts`

Always calls `fetchOtpIsochrone(workplace, minutes)`. No mode routing.

## Store

```ts
workplace: [number, number] | null
minutes: number
resultPolygon: Polygon | MultiPolygon | null
```

No `mode` field — transport mode is not configurable.

## Environment variables

```
VITE_OTP_URL=http://localhost:8080
```

## Error handling

Keep previous polygon on error, call optional `onError` callback.

## Out of scope

- Departure time picker in UI (hardcoded to Mon 09:00)
- VPS deployment (see future 004b)
- Real-time departures
- Non-transit modes (walk-only, cycling, driving)

## Done when

1. Clicking the map fetches and displays an OTP2-based transit isochrone.
2. Changing the travel time slider refetches.
3. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
4. Manually verified on dev server with OTP2 running locally.
