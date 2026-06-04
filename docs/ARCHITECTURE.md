# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                          │
│                                                                     │
│  ┌──────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ Zustand  │  │                    UI Components                 │ │
│  │  store   │  │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │ │
│  │          │  │  │   Map    │ │ Isochrone│ │  PropertyPins   │ │ │
│  │workplace │◄─┤  │ (MapLibre│ │  Layer   │ │  (markers,      │ │ │
│  │ minutes  │  │  │  GL JS)  │ │          │ │   table,        │ │ │
│  │ polygon  │  │  └────┬─────┘ └────┬─────┘ │   lightbox)     │ │ │
│  │  pins    │  │  ┌────▼─────┐ ┌────▼─────┐ └────────┬────────┘ │ │
│  │noiseLayer│  │  │ Filter   │ │  Noise   │          │          │ │
│  │ Visible  │  │  │  Panel   │ │  Layer   │          │          │ │
│  └────┬─────┘  │  └──────────┘ └──────────┘          │          │ │
│       │        └───────────────────────────────────────────────┘ │ │
│       │                             │                 │            │
│  ┌────▼──────────────────────────────────────────┐    │            │
│  │                   Hooks                        │    │            │
│  │  useIsochrone ──► OTP2 fetch + localStorage   │    │            │
│  │  usePinAnalytics ──► OTP2 routing × pin        │    │            │
│  │                      + noise Lden lookup       │◄───┘            │
│  │  useScreenshotDrop ──► Vision + Geocoding      │                │
│  │  useUrlState ──► URL sync                      │                │
│  └────────────────────────────────────────────────┘                │
│                                                                     │
│  ┌─────────────────────── Services ──────────────────────────────┐ │
│  │  otp.ts         geocoding.ts     vision/          idealista.ts│ │
│  │  analytics.ts   noise/           (Nominatim +     imageUtils  │ │
│  │  (travel +      noiseData.ts      ES→CA fallback) .ts         │ │
│  │   composite     noiseScore.ts                                 │ │
│  │   score)        pmtilesProtocol.ts                            │ │
│  └───────┬────────────────┬──────────────┬──────────────────────┘ │
└──────────┼────────────────┼──────────────┼────────────────────────┘
           │                │              │
           ▼                ▼              ▼
  ┌────────────────┐ ┌────────────┐ ┌──────────────────┐
  │ OpenTripPlanner│ │ Nominatim  │ │  Anthropic API   │
  │ 2 (localhost:  │ │ (OSM,      │ │  Claude Vision   │
  │ 8080, Docker)  │ │ public)    │ │  (claude-haiku)  │
  └────────────────┘ └────────────┘ └──────────────────┘
           │
  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐
  │  OpenFreeMap   │  │    Idealista      │  │  noise.pmtiles  │
  │  (map tiles)   │  │  (search target,  │  │  (static file,  │
  │                │  │   URL only)       │  │   Range reqs)   │
  └────────────────┘  └──────────────────┘  └─────────────────┘
```

## Repository layout

```
bcn-property-finder/
├── frontend/        # React SPA
├── backend/         # OTP2 via Docker Compose (isochrone/routing engine)
│   └── otp/data/    # GTFS + OSM graph files for OTP
├── data/            # Static datasets (Barcelona open data, gitignored raw)
│   ├── noise/       # Strategic noise map GPKG (gitignored, large)
│   └── areas/       # Raw district/barri/municipality downloads (gitignored)
├── scripts/
│   ├── prepare-noise-data.sh   # GPKG → GeoJSON → PMTiles pipeline
│   ├── prepare-areas-data.sh   # districtes+barris+AMB municipis → areas.geojson
│   ├── prepare-livability-grid.py # H3 grid + walkability + noise → livability-h3.geojson
│   ├── extract_poi.py          # OSM PBF → barcelona_poi.pmtiles (walkability POIs)
│   └── _amb_muni_url.py        # builds the AMB municipalities export URL
└── docs/
```

The built `frontend/public/data/areas.geojson` (118 features, ~150 KB) is committed.

## Frontend (`frontend/src/`)

```
src/
├── components/
│   ├── Map/             # MapLibre canvas; drag-to-move workplace marker, click-to-place pins
│   ├── IsochroneLayer/  # GeoJSON fill + outer mask layer
│   ├── NoiseLayer/      # PMTiles vector fill layer (Lden) + legend + info modal
│   ├── LivabilityLayer/ # H3 grid choropleth (walkability ± noise) + ramp + legend
│   ├── FilterPanel/     # travel time slider + layer toggles + Exclusion/Livability controls
│   ├── ExportButton/    # builds Idealista URL from the effective area
│   ├── ExclusionLayer/  # red fill + outline for no-go zones
│   ├── ExclusionDraw/   # terra-draw integration (polygon / freehand)
│   └── PropertyPins/    # apartment pins: map markers, comparison table, photo lightbox
├── hooks/
│   ├── useIsochrone.ts      # fetches isochrone from OTP2; caches in localStorage
│   ├── usePinAnalytics.ts   # walk/cycle/drive/transit times + noise Lden per pin
│   ├── useScreenshotDrop.ts # screenshot drop → Vision parse → geocode → pin creation
│   ├── useEffectiveArea.ts  # isochrone − exclusion zones (shared by mask + export)
│   └── useUrlState.ts       # syncs Zustand store ↔ URL search params
├── store/
│   ├── index.ts            # Zustand: workplace, minutes, resultPolygon, noise + livability layer state
│   ├── pinsStore.ts        # Zustand: apartment pins, localStorage persistence
│   └── exclusionsStore.ts  # Zustand: no-go zones + drawingMode, localStorage persistence
├── types/
│   ├── pins.ts          # PropertyPin, PinAnalytics (incl. noiseLden, noiseScore)
│   └── exclusions.ts    # ExclusionZone (drawn | area)
└── services/
    ├── otp.ts           # OTP2 client: isochrone + point-to-point routing (all modes)
    ├── geocoding.ts     # Nominatim geocoder; multi-query fallback + ES→CA translation
    ├── analytics.ts     # travelIndex + compositeScore (travel × W + noise × W)
    ├── imageUtils.ts    # image compression + base64 helpers
    ├── idealista.ts     # GeoJSON → Google Encoded Polyline (all rings) → Idealista URL
    ├── exclusions.ts    # subtractExclusions (turf union+difference), isPointInExclusions
    ├── areas.ts         # loads areas.geojson; grouped picker options; geometry lookup
    ├── noise/
    │   ├── noiseData.ts        # PMTiles tile fetch at z=14 + point-in-polygon → Lden
    │   ├── noiseScore.ts       # noiseScore(lden) = clamp(0,100,(75−lden)/30×100)
    │   └── pmtilesProtocol.ts  # registers pmtiles:// protocol with MapLibre (once at startup)
    ├── livability/
    │   ├── livabilityScore.ts  # cellNoiseScore + livabilityIndex (walk, or walk+noise composite)
    │   └── livabilityData.ts   # loads livability-h3.geojson; withIndex(grid, considerNoise)
    └── vision/
        ├── visionService.ts      # provider-agnostic entry point
        ├── anthropicProvider.ts  # Claude Vision via Anthropic API
        └── types.ts              # ParsedListing type
```

## Noise layer

**Data**: Barcelona Strategic Noise Map 2022, `Total_Lden` — road traffic + railways + industry + leisure/entertainment. Source: [Open Data BCN](https://opendata-ajuntament.barcelona.cat/data/en/dataset/isofones-mapa-estrategic-soroll).

**Pipeline** (`scripts/prepare-noise-data.sh`):
1. Download `2022_Isofones_Total_Lden_BCN.gpkg` (~274 MB)
2. `ogr2ogr` → GeoJSON with numeric `lden` midpoints from `Rang` string field
3. `tippecanoe` → `frontend/public/data/noise.pmtiles` (z10–z16, ~34 MB)

**Client**:
- MapLibre reads `noise.pmtiles` via `pmtiles://` protocol (HTTP Range requests — only visible tiles fetched)
- Scoring: fetch z=14 tile for pin coords → decode MVT → point-in-polygon → `lden` midpoint
- Score formula: `clamp(0, 100, round((75 − lden) / 30 × 100))`

**Composite score**: `round((travelIndex × W_travel + noiseScore × W_noise) / (W_travel + W_noise))`. Weights are ENV vars (`VITE_COMPOSITE_WEIGHT_TRAVEL`, `VITE_COMPOSITE_WEIGHT_NOISE`). If noise data is unavailable for a pin, falls back to `travelIndex` only.

## Livability index map (feature 017)

A city-wide **exploration layer**: an H3 hex grid coloured by livability, visible before any pin is
dropped. Walkability and noise are **workplace-independent**, so the whole grid is precomputed
offline and served as static data — no backend, no per-cell runtime computation.

- **Data**: `frontend/public/data/livability-h3.geojson` — one hexagon per H3 cell (res 9 ≈ 170 m)
  covering BCN + AMB (cells filled from `areas.geojson`). Each cell carries
  `{ h3, walk, lden }`: `walk` = walkability index 0–100 (distance-decay + per-category saturation
  over nearby POIs at the cell centroid — same formula as the per-pin score, feature 010); `lden` =
  representative noise level (dB) or `null`.
- **Precompute** (`scripts/prepare-livability-grid.py`): fills H3 cells over the coverage union,
  scores walkability from the OSM PBF (reusing `extract_poi.py` config) via a shapely STRtree, and
  reads `lden` per cell from the noise GPKG/GeoJSON (reusing the feature-009 `Rang`→`lden` parsing).
  Needs `pip install h3 shapely` + `ogr2ogr`.
- **Client**: `services/livability/` loads the grid and computes per-cell `index` =
  walkability only, or a weighted **walk + noise composite** when "Consider noise" is on (reusing the
  composite weights). `LivabilityLayer` renders a MapLibre GeoJSON fill choropleth (RdYlGn ramp) and
  recomputes `index` via `setData` when the toggle flips; a hover popup shows the per-factor
  breakdown. `FilterPanel/LivabilityControls` hosts the layer toggle + "Consider noise" in an
  **extensible** checkbox group (future per-hub accessibility layers — feature 018 — slot in here).
- **State**: `livabilityVisible`, `livabilityConsiderNoise` in the Zustand store (localStorage).
- **ENV**: `VITE_LIVABILITY_H3_RES` (default 9), `VITE_LIVABILITY_COVERAGE` (default `bcn-amb`).

## Exclusion ("no-go") zones

Statically subtracted from the exported area (feature 015). Zones are defined by **drawing**
(terra-draw: polygon / freehand) or **picking** a district / barri / metro municipality, and
persist in `localStorage` (`bcn_exclusion_zones`) independent of workplace/isochrone.

- **Data**: `frontend/public/data/areas.geojson` — BCN districtes + barris ([martgnz/bcn-geodata](https://github.com/martgnz/bcn-geodata)) + AMB municipalities ([opendatasoft georef-spain-municipio](https://public.opendatasoft.com)). Built by `scripts/prepare-areas-data.sh`.
- **Effective area** (`useEffectiveArea`): `subtractExclusions(isochrone, zones)` = `@turf/difference` over `@turf/union`. Shared by the isochrone mask (preview) and the Idealista export so they always match.
- **Export** (`services/idealistaAreas.ts`, `useIdealistaAreas`): Idealista's `shape` accepts only **one simple, hole-free polygon per search** (multiple polygons → 400, holes → silently filled — probed in a real browser). So the effective area is **decomposed** into the minimal set of simple polygons — holes cut into vertical strips via `@turf/intersect`, slivers dropped by `@turf/area`, rings shortened by `@turf/simplify` — and the UI offers **one `((ring))` link per area** (ENV `VITE_IDEALISTA_*`). See `docs/features/TODO-015-exclusion-zones.md`.
- **Pins**: `isPointInExclusions` flags pins inside a zone — "excluded" badge in the compare grid + dimmed map marker (kept, not removed).
- **Deps**: `terra-draw`, `terra-draw-maplibre-gl-adapter`, `@turf/difference`, `@turf/union`, `@turf/intersect`, `@turf/area`, `@turf/simplify`.

## Scoring weights (ENV)

All scoring weights are in `.env.local` (see `.env.local.example`):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_WEIGHT_WALK` | 4 | Travel sub-index: walking |
| `VITE_WEIGHT_PT` | 3 | Travel sub-index: public transport |
| `VITE_WEIGHT_CYCLE` | 2 | Travel sub-index: cycling |
| `VITE_WEIGHT_CAR` | 1 | Travel sub-index: driving |
| `VITE_TRAVEL_CAP_MINUTES` | 60 | Minutes beyond which mode score = 0 |
| `VITE_COMPOSITE_WEIGHT_TRAVEL` | 5 | Composite: travel index weight |
| `VITE_COMPOSITE_WEIGHT_NOISE` | 2 | Composite: noise score weight |

## UI

**Mantine** (`@mantine/core` + `@mantine/hooks`) — components (Button, Slider, Switch, Modal, Drawer, Table) and CSS variables for theming. Mobile-first: filter panel is a bottom `Drawer` on mobile, floating card on desktop (`≥ 768px`).

## External services

| Service | Purpose | Notes |
|---|---|---|
| OpenTripPlanner 2 | Isochrone + all routing modes (walk, bike, car, transit) | Self-hosted via Docker, port 8080 |
| Anthropic API | Screenshot → structured listing data (price, area, address, URL) | Model: `claude-haiku-4-5` (env `VITE_ANTHROPIC_MODEL`) |
| Nominatim (OSM) | Address geocoding for screenshot-parsed addresses | Public endpoint; multi-query fallback with ES→CA translation |
| OpenFreeMap | Vector map tiles | No API key needed |
| Idealista | Property search target | URL only |

## Backend

**OpenTripPlanner 2** runs locally via Docker Compose (`backend/docker-compose.yml`). It serves the OTP REST API on `http://localhost:8080` and handles isochrone requests for all transport modes (walk, bike, car, public transit).

Graph data (GTFS + OSM) lives in `backend/otp/data/` and is loaded at container startup.

## Screenshot → Pin flow

```
User drops screenshot
        │
        ▼
  compressImage + fileToBase64 (parallel)
        │
        ▼
  Anthropic Claude Vision
  → { price, area, address, addressIsApproximate, url }
        │
        ├──► updatePin: price, area, url, comment (address), photo
        │
        ▼
  geocoding.ts (if address present)
  1. Full address + "Barcelona"
  2. Street-only + "Barcelona"
  3. Catalan-translated street + "Barcelona"
        │
        ├── success → updatePin: { coordinates }
        └── fail    → keep fallback coords (workplace or map center)
        │
        ▼
  calcAnalytics(finalCoords, workplace)
  → OTP2 routing × 4 modes  → travelIndex
  → noise PMTiles lookup     → noiseLden, noiseScore
  → compositeScore
  → updatePinAnalytics
```
