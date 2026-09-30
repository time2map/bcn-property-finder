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
│  │ minutes  │  │  │  GL JS)  │ │          │ │   compare,      │ │ │
│  │ polygon  │  │  └────┬─────┘ └────┬─────┘ │   lightbox)     │ │ │
│  │  pins    │  │  ┌────▼─────┐ ┌────▼─────┐ └────────┬────────┘ │ │
│  │noiseLayer│  │  │ Filter   │ │  Noise   │          │          │ │
│  │composite │  │  │  Panel   │ │  Layer   │          │          │ │
│  │Visible   │  │  └──────────┘ └──────────┘          │          │ │
│  │prices    │  └───────────────────────────────────────────────┘ │ │
│  │Visible   │                           │                 │       │ │
│  │selectedHex│  ┌────────────────────────────────────────┐       │ │
│  └────┬─────┘  │                   Hooks                 │       │ │
│       │        │  useIsochrone ──► OTP2 + localStorage   │       │ │
│       │        │  usePinAnalytics ──► OTP2 + noise       │◄──────┘ │
│       │        │  useIdealistaAreas ──► effective area   │         │
│       │        │  useScreenshotDrop ──► Vision + Geocode │         │
│       │        │  useSplitPane ──► resizable compare pane│         │
│       │        │  useUrlState ──► URL sync               │         │
│       │        └────────────────────────────────────────┘         │
│                                                                     │
│  ┌─────────────────────── Services ──────────────────────────────┐ │
│  │  otp.ts           geocoding.ts      vision/                   │ │
│  │  analytics.ts     noise/            (Anthropic Vision)        │ │
│  │  (travel score +  walkability/      idealista.ts              │ │
│  │   composite)      cityCore/         idealistaAreas.ts         │ │
│  │                   composite/        idealista/                 │ │
│  │                   livability/       parser/                    │ │
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
  │  OpenFreeMap   │  │  TMB API          │  │  noise.pmtiles  │
  │  (map tiles)   │  │  (metro lines +  │  │  (static file,  │
  │                │  │   stations)       │  │   Range reqs)   │
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
│   ├── prepare-noise-data.sh        # GPKG → GeoJSON → PMTiles pipeline
│   ├── prepare-areas-data.sh        # districtes+barris+AMB municipis → areas.geojson
│   ├── prepare-livability-grid.py   # H3 grid + walkability + noise → livability-h3.geojson
│   ├── climate_risk.py              # flood/wildfire exposure per H3 cell + flood-zones/wildfire.pmtiles (036)
│   ├── fetch_climate_risk.py        # downloads climate-risk sources → data/climate-risk/ (gitignored)
│   ├── prepare-city-core-access.py  # landmark walking-time matrix → city-core-h3.geojson
│   ├── prepare-landmark-geometries.py # landmark point/polygon extraction
│   ├── extract_poi.py               # OSM PBF → barcelona_poi.pmtiles (walkability POIs)
│   ├── fgc-gtfs-to-geojson.mjs      # FGC GTFS → fgc-lines/fgc-stations.geojson
│   ├── fetch_bcn_rental_barri.py    # BCN open data rental stats by barri
│   ├── fetch_catalonia_rental.py    # Generalitat rental price data
│   ├── fetch_incasol_sale_catalonia.py  # INCASOL sale prices (Catalonia)
│   ├── fetch_incasol_sale_prices.py # INCASOL sale prices → price per H3
│   ├── fetch_ine_indices.py         # INE housing price indices
│   ├── build_price_geopackage.py    # joins price sources → price GPKG
│   ├── enrich_h3_with_prices.py     # merges INCASOL prices into H3 grid
│   ├── har_to_geojson.py            # Idealista HAR capture → GeoJSON price dots
│   └── _amb_muni_url.py             # builds the AMB municipalities export URL
└── docs/
```

The built `frontend/public/data/areas.geojson` (118 features, ~150 KB) is committed.

## Frontend (`frontend/src/`)

```
src/
├── components/
│   ├── Map/             # MapLibre canvas; drag-to-move workplace marker, click-to-place pins
│   │   ├── MapContext.ts        # React context exposing the MapLibre map instance
│   │   ├── MapContextMenu.tsx   # right-click context menu (set workplace, add pin)
│   │   ├── layerOrder.ts        # canonical z-order for all MapLibre layers
│   │   └── googleMapsUrl.ts     # builds Google Maps URL for a coordinate
│   ├── IsochroneLayer/  # GeoJSON fill + outer mask layer
│   ├── NoiseLayer/      # PMTiles vector fill layer (Lden) + legend + info modal
│   ├── FloodZonesLayer/ # ACA river flood zones T10/T100/T500 (PMTiles) + legend + info modal
│   ├── WildfireLayer/   # wildfire hazard 2024 classes + WUI outline (PMTiles) + legend + info modal
│   ├── WalkabilityLayer/  # H3 hex choropleth (walkability only) + legend
│   ├── CompositeLayer/    # H3 hex choropleth (4-factor composite index) + legend + hover
│   │   └── scoreRamp.ts         # shared RdYlGn colour ramp for hex layers
│   ├── MetroLayer/      # TMB metro lines + station dots (API: api.tmb.cat)
│   ├── FgcLayer/        # FGC suburban rail lines + stations (static GeoJSON)
│   ├── PoiLayer/        # POI dots from barcelona_poi.pmtiles
│   ├── LandmarksLayer/  # city-core landmark markers (Sagrada Família, Passeig de Gràcia, etc.)
│   ├── IdealistaPricesLayer/ # Idealista scraped price dots on the map
│   │   ├── h3Index.ts           # aggregates price dots to H3 medians
│   │   └── priceColors.ts       # price → colour ramp
│   ├── HexDetailCard/   # hover / click detail card for a single H3 cell
│   ├── FilterPanel/     # travel time slider + layer toggles + composite/exclusion controls
│   │   ├── CompositeControls.tsx  # composite index toggle + weight sliders
│   │   └── ExclusionControls.tsx  # exclusion zone picker + draw mode buttons
│   ├── ExportButton/    # builds Idealista URL from the effective area
│   │   └── BaseUrlInput.tsx       # Idealista base URL input + validation
│   ├── ExportAreasLayer/ # visual overlay of the decomposed export polygons
│   ├── ExclusionLayer/  # red fill + outline for no-go zones
│   ├── ExclusionDraw/   # terra-draw integration (polygon / freehand)
│   └── PropertyPins/    # apartment pins: map markers, comparison table, photo lightbox
│       ├── PinLayer.tsx          # map markers for all pins
│       ├── PinAccuracyLayer.tsx  # circle showing geocode accuracy radius
│       ├── ComparePane.tsx       # resizable side panel (uses useSplitPane)
│       ├── CompareGrid.tsx       # sortable comparison table
│       ├── AddPinButton.tsx      # floating button to add pin at map centre
│       ├── ScreenshotDropZone.tsx # drag-drop target for screenshot parsing
│       ├── PhotoLightbox.tsx     # full-screen photo viewer
│       └── compareHighlight.ts  # logic for highlighted / sorted column
├── hooks/
│   ├── useIsochrone.ts       # fetches isochrone from OTP2; caches in localStorage
│   ├── usePinAnalytics.ts    # walk/cycle/drive/transit times + noise Lden per pin
│   ├── useIdealistaAreas.ts  # computes + stores Idealista export polygon set
│   ├── useScreenshotDrop.ts  # screenshot drop → Vision parse → geocode → pin
│   ├── useSplitPane.ts       # resizable split-pane width + collapse state
│   ├── useEffectiveArea.ts   # isochrone − exclusion zones (shared by mask + export)
│   └── useUrlState.ts        # syncs Zustand store ↔ URL search params
├── store/
│   ├── index.ts                  # Zustand: workplace, minutes, resultPolygon,
│   │                             #   noiseLayerVisible, compositeVisible,
│   │                             #   compositeWeights, idealistaPricesVisible,
│   │                             #   idealistaPriceRange, selectedHexH3, …
│   ├── pinsStore.ts              # Zustand: apartment pins, localStorage persistence
│   ├── exclusionsStore.ts        # Zustand: no-go zones + drawingMode, localStorage
│   └── idealistaBaseUrlStore.ts  # Zustand: custom Idealista base URL, localStorage
├── types/
│   ├── pins.ts              # PropertyPin, PinAnalytics (incl. noiseLden, noiseScore)
│   ├── exclusions.ts        # ExclusionZone (drawn | area)
│   └── IdealistaProperty.ts # scraped Idealista price-dot record
└── services/
    ├── otp.ts           # OTP2 client: isochrone + point-to-point routing (all modes)
    ├── geocoding.ts     # Nominatim geocoder; multi-query fallback + ES→CA translation
    ├── analytics.ts     # travelIndex + per-pin compositeScore (travel × noise × walkability)
    ├── imageUtils.ts    # image compression + base64 helpers
    ├── idealista.ts     # GeoJSON → Google Encoded Polyline → Idealista URL; base URL parse
    ├── idealistaAreas.ts # effective area → simple hole-free polygon set for export
    ├── exclusions.ts    # subtractExclusions (turf union+difference), isPointInExclusions
    ├── areas.ts         # loads areas.geojson; grouped picker options; geometry lookup
    ├── noise/
    │   ├── noiseData.ts        # PMTiles tile fetch at z=14 + point-in-polygon → Lden
    │   ├── noiseScore.ts       # noiseScore(lden) = clamp(0,100,(75−lden)/30×100)
    │   └── pmtilesProtocol.ts  # registers pmtiles:// protocol with MapLibre (once at startup)
    ├── walkability/
    │   ├── walkabilityScore.ts  # distance-decay + per-category saturation over nearby POIs
    │   ├── pmtilesPoi.ts        # reads barcelona_poi.pmtiles; STRtree-style radius lookup
    │   ├── serviceCategories.ts # POI category definitions + saturation caps
    │   └── walkabilityTypes.ts  # shared types for walkability computation
    ├── cityCore/
    │   ├── cityCoreData.ts   # loads city-core-h3.geojson (landmark walking-time matrix)
    │   ├── cityCoreScore.ts  # cellCityCoreIndex: proximity score over selected landmarks
    │   └── landmarks.ts      # landmark definitions (id, name, ALL_LANDMARK_IDS)
    ├── composite/
    │   ├── compositeData.ts  # joins livability + cityCore + INCASOL prices → CellBundle[]
    │   └── compositeScore.ts # computeComposite: 4-factor weighted index + climate-risk penalties
    ├── climateRisk/
    │   └── climateRisk.ts    # floodRisk / fireRisk (0–1) + applyRiskPenalties (036)
    ├── livability/
    │   ├── livabilityData.ts  # loads livability-h3.geojson (walk + lden per cell)
    │   └── livabilityScore.ts # livabilityIndex (walk only, or walk+noise blend — WalkabilityLayer)
    ├── idealista/
    │   └── idealistaRawData.ts # loads Idealista price-dot GeoJSON (scraped via HAR)
    ├── parser/
    │   └── IdealistaHTMLParser.ts # parses Idealista listing HTML → structured fields
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

**Per-pin composite score**: `round((travelIndex × W_travel + noiseScore × W_noise + walkScore × W_walk) / sum(weights))`. Weights from ENV (`VITE_COMPOSITE_WEIGHT_TRAVEL`, `VITE_COMPOSITE_WEIGHT_NOISE`, `VITE_COMPOSITE_WEIGHT_WALKABILITY`). If noise or walkability data is unavailable, falls back gracefully.

## Walkability layer (feature 010 / 017)

H3 hex grid coloured by **walkability only** — nearby POI access via distance-decay + per-category saturation. Workplace-independent, precomputed offline.

- **Data**: `frontend/public/data/livability-h3.geojson` — one hexagon per H3 cell (res 9 ≈ 170 m) covering BCN + AMB. Each cell: `{ h3, walk, lden }`.
- **Score**: `computeWalkabilityScore` (services/walkability) — sums `exp(-d/DECAY)` per nearby POI, saturation-capped per category.
- **Client**: `WalkabilityLayer` renders a GeoJSON fill choropleth (RdYlGn ramp). `livabilityIndex` (services/livability) optionally blends walkability + noise when a "Consider noise" toggle is on.
- **Precompute** (`scripts/prepare-livability-grid.py`): fills H3 cells, scores walkability from OSM PBF via shapely STRtree, reads `lden` from noise GPKG.
- **ENV**: `VITE_LIVABILITY_H3_RES` (default 9), `VITE_LIVABILITY_COVERAGE` (default `bcn-amb`), `VITE_WALK_DECAY_M` (default 400 m), `VITE_WALK_RMAX_M` (default 1500 m).

## Composite Index layer (feature 022)

H3 hex grid coloured by a **4-factor composite index**: walkability (POI access), noise, city-core proximity, and open sale price. All factors are workplace-independent and precomputed offline.

- **Factors**:
  1. `poiAccess` — same walkability score as the Walkability layer
  2. `noise` — `noiseScore(lden)` from the noise layer
  3. `cityCore` — `cellCityCoreIndex`: proximity to selected landmarks (Sagrada Família, Passeig de Gràcia, Barceloneta, etc.) weighted by walking minutes
  4. `openPrice` — INCASOL sale EUR/m² normalised to 0–100 (cheaper = better)
- **Data**: joins `livability-h3.geojson` + `city-core-h3.geojson` + INCASOL price data into `CellBundle[]` (`services/composite/compositeData.ts`).
- **Score**: `computeComposite(bundle, weights, enabledLandmarkIds, priceBounds, riskStrengths)` → weighted average (missing data = 0, see feature 022), then climate-risk penalties.
- **Climate-risk penalties (036)**: `score = base × (1 − sFlood/10 · floodRisk) × (1 − sFire/10 · fireRisk)` — safe cells keep their score. Raw exposure (`flood_t10/t100/t500`, `fire_wui`, `fire_hazard`, `fire_class`, `fire_dist_m`) is baked into `livability-h3.geojson` by `scripts/climate_risk.py`; risks and penalties are computed in `services/climateRisk`. ENV: `VITE_FLOOD_PENALTY_T10/T100/T500`, `VITE_RISK_STRENGTH_FLOOD/FIRE`.
- **Client**: `CompositeLayer` renders the choropleth; `HexDetailCard` shows per-factor breakdown and the climate-risk explanation on hover/click. `FilterPanel/CompositeControls` hosts the layer toggle + per-factor weight sliders + risk-penalty strengths + landmark selection. `FilterPanel/ClimateLayerControls` toggles the Flood Zones / Wildfire Hazard view layers.
- **State**: `compositeVisible`, `compositeWeights`, `compositeScoreRange`, `compositeRiskStrengths`, `floodLayerVisible`, `wildfireLayerVisible`, `selectedHexH3`, `enabledLandmarkIds` in Zustand store.

## Idealista Prices layer (feature 019)

Scraped Idealista listing price dots overlaid on the map as a supplementary reference layer.

- **Data**: captured via HAR (`scripts/har_to_geojson.py`) → `frontend/public/data/idealista-raw.geojson`. Each feature: `{ price, priceByArea }`.
- **Client**: `IdealistaPricesLayer` renders dots coloured by EUR/m² (`priceColors.ts`). `h3Index.ts` aggregates dots to H3 median prices (used in composite + hover card).
- **State**: `idealistaPricesVisible`, `idealistaPriceRange`, `idealistaPriceBounds` in Zustand store.

## Transit layers (feature 020)

- **MetroLayer**: TMB REST API (`api.tmb.cat/v1/transit`) — metro lines + station dots. Requires `VITE_TMB_APP_ID` / `VITE_TMB_APP_KEY`.
- **FgcLayer**: static `fgc-lines.geojson` / `fgc-stations.geojson` in `frontend/public/` (built by `scripts/fgc-gtfs-to-geojson.mjs` from FGC GTFS).

## Exclusion ("no-go") zones

Statically subtracted from the exported area (feature 015). Zones are defined by **drawing**
(terra-draw: polygon / freehand) or **picking** a district / barri / metro municipality, and
persist in `localStorage` (`bcn_exclusion_zones`) independent of workplace/isochrone.

- **Data**: `frontend/public/data/areas.geojson` — BCN districtes + barris ([martgnz/bcn-geodata](https://github.com/martgnz/bcn-geodata)) + AMB municipalities ([opendatasoft georef-spain-municipio](https://public.opendatasoft.com)). Built by `scripts/prepare-areas-data.sh`.
- **Effective area** (`useEffectiveArea`): `subtractExclusions(isochrone, zones)` = `@turf/difference` over `@turf/union`. Shared by the isochrone mask (preview) and the Idealista export so they always match.
- **Export** (`services/idealistaAreas.ts`, `useIdealistaAreas`): Idealista's `shape` accepts only **one simple, hole-free polygon per search** (multiple polygons → 400, holes → silently filled — probed in a real browser). So the effective area is **decomposed** into the minimal set of simple polygons — holes cut into vertical strips via `@turf/intersect`, slivers dropped by `@turf/area`, rings shortened by `@turf/simplify` — and the UI offers **one `((ring))` link per area** (ENV `VITE_IDEALISTA_*`). `ExportAreasLayer` visualises the decomposed polygons on the map.
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
| `VITE_COMPOSITE_WEIGHT_TRAVEL` | 5 | Per-pin composite: travel index weight |
| `VITE_COMPOSITE_WEIGHT_NOISE` | 2 | Per-pin composite: noise score weight |
| `VITE_COMPOSITE_WEIGHT_WALKABILITY` | 3 | Per-pin composite: walkability weight |
| `VITE_WALK_DECAY_M` | 400 | Walkability distance-decay constant (metres) |
| `VITE_WALK_RMAX_M` | 1500 | Walkability hard cutoff radius (metres) |

Composite Index layer weights (per-cell, not per-pin) are stored in Zustand (`compositeWeights`) with defaults `{ poiAccess: 6, noise: 7, cityCore: 8, openPrice: 10 }` and adjusted via UI sliders in `CompositeControls`.

## UI

**Mantine** (`@mantine/core` + `@mantine/hooks`) — components (Button, Slider, Switch, Modal, Drawer, Table) and CSS variables for theming. Mobile-first: filter panel is a bottom `Drawer` on mobile, floating card on desktop (`≥ 768px`). The compare pane is a resizable side panel (desktop) or bottom sheet (mobile), managed by `useSplitPane`.

## External services

| Service | Purpose | Notes |
|---|---|---|
| OpenTripPlanner 2 | Isochrone + all routing modes (walk, bike, car, transit) | Self-hosted via Docker, port 8080 |
| Anthropic API | Screenshot → structured listing data (price, area, address, URL) | Model: `claude-haiku-4-5` (env `VITE_ANTHROPIC_MODEL`) |
| Nominatim (OSM) | Address geocoding for screenshot-parsed addresses | Public endpoint; multi-query fallback with ES→CA translation |
| OpenFreeMap | Vector map tiles | No API key needed |
| TMB API | Metro lines + station data | Requires `VITE_TMB_APP_ID` / `VITE_TMB_APP_KEY` from developer.tmb.cat |
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
  → walkability PMTiles      → walkabilityScore
  → compositeScore (travel + noise + walkability)
  → updatePinAnalytics
```
