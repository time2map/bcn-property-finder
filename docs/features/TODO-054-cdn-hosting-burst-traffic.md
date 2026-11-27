# TODO-054 — Hosting for burst traffic: CDN cache in front, our own server as origin, versioned data

**Status:** Planned, not started. First of the scale track (054–059) — to be done before any press link.
Details and numbers: `local-docs/architecture/01-load-estimate.md`, `02-hosting-options.md`,
`04-data-versioning.md`, `06-server.md`.

## Problem

The site is static on GitHub Pages, which has a soft limit of 100 GB/month and no control over cache headers.
A visit loads ~4–6 MB from our host (bundle, `buildings-scores.bin.gz`, PMTiles range requests). A single
Barcelona newspaper link (50k visits in two days) is ~250 GB: GitHub throttles or asks us to leave, in the
middle of the spike. Data files have fixed names, so a data rebuild can serve a new `buildings.pmtiles` with a
cached old `buildings-meta.json`.

## Decision

Infrastructure principle (owner, 2026-11-11): our own server and containers wherever they do the job; a cloud
service only where our server cannot replace it. Here that is the CDN cache for the spike.

1. **Step 0 — Cloudflare (free) as cache in front of the current site** (same day): DNS moves to Cloudflare,
   proxy on, a cache rule for `/data/*`, `/assets/*`, `*.pmtiles`, `*.bin.gz` with edge TTL 1 month, SSL Full.
   No code change; origin is still GitHub Pages.
2. **Step 1 — Our server becomes the origin**: one `nginx` container (docker compose) serving the frontend
   build at `/`, data at `/data/v/<version>/`, later the basemap (055) at `/basemap/`, and branch previews
   (057) at `/preview/<branch>/`. Cache headers set in nginx. Deploy from GitHub Actions over SSH (`rsync`).
3. **Step 2 — Data under immutable versioned paths** with a small `manifest.json` in the app and
   `Cache-Control: immutable`. The app reads `VITE_DATA_BASE_URL`; empty = `public/data/` as today (local dev).
4. GitHub Pages stays as a cold spare (DNS switch back). Cloudflare Pages + R2 is the fallback plan if the
   server turns out unsuitable (bandwidth cap, location) — see `02-hosting-options.md`.

## Spec

- `frontend/public/data/manifest.json`: `{ version, files: { name: { bytes, sha256 } } }` (committed).
- `services/dataUrl.ts`: `dataUrl(name) → string` = `${VITE_DATA_BASE_URL}/v/${version}/${name}` when a base
  URL is set, else `${BASE_URL}data/${name}`. Every loader (`buildingData.ts`, `buildingDetail.ts`,
  `NoiseLayer`, `FloodZonesLayer`, `StreetFloodingLayer`, `WildfireLayer`, `localsOpinion.ts`, `areas.ts`)
  goes through it; `pmtiles://` URLs too.
- `deploy/nginx.conf` + `deploy/docker-compose.yml` (in the repo): gzip/brotli for text, `immutable` for
  `/assets/*` and `/data/v/*`, `no-cache` for `index.html`, `Accept-Ranges`, CORS for the app origins,
  `/preview/*` with `noindex`.
- `scripts/publish_data.sh <version>`: `rsync` of `frontend/public/data/*.pmtiles|*.bin.gz` to
  `/srv/livability/data/v/<version>/` on the server, then writes `manifest.json`. `scripts/fetch_data.sh`:
  the reverse, for a fresh clone.
- `.github/workflows/deploy.yml`: build → `rsync` `frontend/dist` to `/srv/livability/www/` (atomic: new
  dir + symlink swap). The GitHub Pages job becomes `workflow_dispatch` only (spare).
- `.gitignore`: `frontend/public/data/*.pmtiles`, `*.bin.gz` once the files are published (history untouched
  for now).

## Implementation order

Step 0 (ops only) → `dataUrl.ts` + loaders + tests → `publish_data.sh` + manifest → nginx + compose on the
server → deploy workflow over SSH → DNS to the server.

## Tests

- `dataUrl.test.ts`: local fallback, versioned URL, `pmtiles://` prefix kept, no double slashes.
- Every loader test asserts it calls `dataUrl(name)` (mock) instead of a literal path.
- `scripts/test_publish_data.py`: manifest has every file with size and hash.
- nginx config: `nginx -t` in CI; a curl smoke test in the deploy job for the headers.

## Definition of Done

Per `CLAUDE.md`, plus: `curl -I` of a data file from the live site shows `cf-cache-status: HIT` and
`cache-control: … immutable`; a synthetic load test (`k6`, 500 VUs, 5 min, the visit profile) shows no
non-2xx from the data host and origin traffic < 5 % of edge traffic.

## Open questions

- Server facts to confirm first: bandwidth, traffic allowance, location, what else runs there
  (`local-docs/architecture/06-server.md`).
- Remove the data binaries from git history now (repo 100 MB → ~10 MB) or later? Proposed: later, after
  one data release through the new flow.
