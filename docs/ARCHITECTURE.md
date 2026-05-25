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
│  │  mode    │  │  └────┬─────┘ └────┬─────┘ │   lightbox)     │ │ │
│  │ polygon  │  │       │            │        └────────┬────────┘ │ │
│  │  pins    │  │  ┌────▼─────┐      │                 │          │ │
│  └────┬─────┘  │  │ Filter   │      │                 │          │ │
│       │        │  │  Panel   │      │                 │          │ │
│       │        │  └──────────┘      │                 │          │ │
│       │        └───────────────────────────────────────────────┘ │ │
│       │                             │                 │            │
│  ┌────▼──────────────────────────────────────────┐    │            │
│  │                   Hooks                        │    │            │
│  │  useIsochrone ──► OTP2 fetch + localStorage   │    │            │
│  │  usePinAnalytics ──► OTP2 routing × pin       │    │            │
│  │  useScreenshotDrop ──► Vision + Geocoding      │◄───┘            │
│  │  useUrlState ──► URL sync                      │                │
│  └────────────────────────────────────────────────┘                │
│                                                                     │
│  ┌─────────────────────── Services ──────────────────────────────┐ │
│  │  otp.ts         geocoding.ts     vision/          idealista.ts│ │
│  │  (OTP2 client)  (Nominatim +     anthropicProvider analytics.ts│ │
│  │                  ES→CA fallback)  visionService)              │ │
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
  ┌────────────────┐  ┌──────────────────┐
  │  OpenFreeMap   │  │    Idealista      │
  │  (map tiles)   │  │  (search target,  │
  │                │  │   URL only)       │
  └────────────────┘  └──────────────────┘
```

## Repository layout

```
bcn-property-finder/
├── frontend/        # React SPA
├── backend/         # OTP2 via Docker Compose (isochrone/routing engine)
│   └── otp/data/    # GTFS + OSM graph files for OTP
├── data/            # Static datasets (Barcelona open data)
└── docs/
```

## Frontend (`frontend/src/`)

```
src/
├── components/
│   ├── Map/             # MapLibre canvas; drag-to-move workplace marker, click-to-place pins
│   ├── IsochroneLayer/  # GeoJSON fill + outer mask layer (opacity 0.3)
│   ├── FilterPanel/     # transport mode toggle + travel time slider
│   ├── ExportButton/    # builds Idealista URL and opens it
│   └── PropertyPins/    # apartment pins: map markers, comparison table, photo lightbox
├── hooks/
│   ├── useIsochrone.ts      # fetches isochrone from OTP2; caches polygon in localStorage
│   ├── usePinAnalytics.ts   # calculates walk/cycle/drive/transit times for each pin
│   ├── useScreenshotDrop.ts # screenshot drop → Vision parse → geocode → pin creation
│   └── useUrlState.ts       # syncs Zustand store ↔ URL search params
├── store/
│   ├── index.ts         # Zustand: workplace, mode, minutes, resultPolygon (init from localStorage)
│   └── pinsStore.ts     # Zustand: apartment pins, localStorage persistence
├── types/
│   └── pins.ts          # PropertyPin, PinAnalytics types
└── services/
    ├── otp.ts           # OTP2 client: isochrone + point-to-point routing (all modes)
    ├── geocoding.ts     # Nominatim geocoder; multi-query fallback + Spanish→Catalan translation
    ├── analytics.ts     # travelIndex score computation
    ├── imageUtils.ts    # image compression + base64 helpers
    ├── idealista.ts     # GeoJSON.Polygon → Google Encoded Polyline → Idealista URL
    └── vision/
        ├── visionService.ts      # provider-agnostic entry point
        ├── anthropicProvider.ts  # Claude Vision via Anthropic API (VITE_ANTHROPIC_API_KEY)
        └── types.ts              # ParsedListing type
```

## UI

**Mantine** (`@mantine/core` + `@mantine/hooks`) — components (Button, Slider, SegmentedControl, Drawer) and CSS variables for theming. Mobile-first: filter panel is a bottom `Drawer` on mobile, floating card on desktop (`≥ 768px`).

## External services

| Service | Purpose | Notes |
|---|---|---|
| OpenTripPlanner 2 | Isochrone + all routing modes (walk, bike, car, transit) | Self-hosted via Docker, port 8080 |
| Anthropic API | Screenshot → structured listing data (price, area, address, URL) | Model: `claude-haiku-4-5` (env `VITE_ANTHROPIC_MODEL`); key: `VITE_ANTHROPIC_API_KEY` |
| Nominatim (OSM) | Address geocoding for screenshot-parsed addresses | Public endpoint; multi-query fallback with Spanish→Catalan street-name translation |
| OpenFreeMap | Vector map tiles | No API key needed |
| Idealista | Property search target | URL only: `/areas/venta-viviendas/mapa-google?shape=((polyline))` |

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
  → OTP2 routing × 4 modes
  → updatePinAnalytics
```
