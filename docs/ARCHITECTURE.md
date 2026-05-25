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
├── data/            # Static datasets (Barcelona open data)
│   └── noise/       # Strategic noise map GPKG (gitignored, large)
├── scripts/
│   └── prepare-noise-data.sh  # GPKG → GeoJSON → PMTiles pipeline
└── docs/
```

## Frontend (`frontend/src/`)

```
src/
├── components/
│   ├── Map/             # MapLibre canvas; drag-to-move workplace marker, click-to-place pins
│   ├── IsochroneLayer/  # GeoJSON fill + outer mask layer
│   ├── NoiseLayer/      # PMTiles vector fill layer (Lden) + legend + info modal
│   ├── FilterPanel/     # travel time slider + layer toggles (noise map)
│   ├── ExportButton/    # builds Idealista URL and opens it
│   └── PropertyPins/    # apartment pins: map markers, comparison table, photo lightbox
├── hooks/
│   ├── useIsochrone.ts      # fetches isochrone from OTP2; caches in localStorage
│   ├── usePinAnalytics.ts   # walk/cycle/drive/transit times + noise Lden per pin
│   ├── useScreenshotDrop.ts # screenshot drop → Vision parse → geocode → pin creation
│   └── useUrlState.ts       # syncs Zustand store ↔ URL search params
├── store/
│   ├── index.ts         # Zustand: workplace, minutes, resultPolygon, noiseLayerVisible
│   └── pinsStore.ts     # Zustand: apartment pins, localStorage persistence
├── types/
│   └── pins.ts          # PropertyPin, PinAnalytics (incl. noiseLden, noiseScore)
└── services/
    ├── otp.ts           # OTP2 client: isochrone + point-to-point routing (all modes)
    ├── geocoding.ts     # Nominatim geocoder; multi-query fallback + ES→CA translation
    ├── analytics.ts     # travelIndex + compositeScore (travel × W + noise × W)
    ├── imageUtils.ts    # image compression + base64 helpers
    ├── idealista.ts     # GeoJSON.Polygon → Google Encoded Polyline → Idealista URL
    ├── noise/
    │   ├── noiseData.ts        # PMTiles tile fetch at z=14 + point-in-polygon → Lden
    │   ├── noiseScore.ts       # noiseScore(lden) = clamp(0,100,(75−lden)/30×100)
    │   └── pmtilesProtocol.ts  # registers pmtiles:// protocol with MapLibre (once at startup)
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
