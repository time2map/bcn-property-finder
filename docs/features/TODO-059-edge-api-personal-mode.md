# TODO-059 — Edge API for the personal mode (if it ever goes public): isochrone cache, vision proxy

**Status:** Design only, not planned. Written so the public architecture does not paint us into a corner.

## Problem

The personal mode (isochrone, pins, screenshot parsing) needs OpenTripPlanner 2 and third-party keys. Today
OTP2 runs in Docker on the developer's machine and the Anthropic key would sit in the browser. Neither can be
public: OTP2 isochrones cost ~0.5–2 s of CPU each on a 4–8 GB graph, and a browser key is stolen in minutes.

## Decision (when the time comes)

- Keep the public map static. Add a thin **API container** on our server (node or go, docker compose next to
  nginx; `local-docs/architecture/06-server.md`) only for the two calls that need secrets or heavy compute,
  behind the Cloudflare cache:
  1. `GET /isochrone?lng&lat&minutes` → the API rounds the point to ~50 m and minutes to 5, answers from
     its cache (on-disk / Redis; the CDN caches the response too), otherwise calls the OTP2 container on the
     same host (no public port), stores the polygon (simplified, ≤ 50 KB). Rate limit per IP (10/min).
     OTP2 needs 6–8 GB RAM for the Barcelona metro graph.
  2. `POST /parse-listing` → the API calls the Anthropic API with the server-side key, size-limited image,
     rate-limited and behind a captcha (Turnstile or hCaptcha). Returns the same `ParsedListing`.
- Alternative for isochrones that needs no server at all: precompute travel-time grids from a lattice of
  workplaces (r5py, 250 m grid, transit only) to static PMTiles and let the browser pick the nearest origin.
  Chosen later by measured demand.
- Pins stay in localStorage; nothing user-specific is stored server-side.

## Interfaces to keep stable now

- `services/otp.ts` already isolates the two calls (`fetchOtpDuration`, `fetchOtpIsochrone`): the API
  speaks the same shapes, `VITE_OTP_URL` becomes the API URL.
- `services/vision/visionService.ts` is the single entry point; the provider swap is one file.

## Tests (when built)

- API unit tests: cache key rounding, rate limit, upstream error mapping.
- Contract tests on the frontend against recorded API responses.
