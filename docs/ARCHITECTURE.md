# Architecture

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
│   ├── Map/             # MapLibre canvas, click-to-place workplace marker
│   ├── IsochroneLayer/  # GeoJSON fill + outer mask layer
│   ├── FilterPanel/     # transport mode toggle + travel time slider
│   ├── ExportButton/    # builds Idealista URL and opens it
│   └── PropertyPins/    # apartment pins: map markers, comparison table, photo lightbox
├── hooks/
│   ├── useIsochrone.ts     # fetches isochrone polygon from OTP2 TravelTime API
│   ├── usePinAnalytics.ts  # calculates walk/cycle/drive/transit times for each pin
│   └── useUrlState.ts      # syncs Zustand store ↔ URL search params
├── store/
│   ├── index.ts         # Zustand: workplace, mode, minutes, resultPolygon
│   └── pinsStore.ts     # Zustand: apartment pins, localStorage persistence
├── types/
│   └── pins.ts          # PropertyPin, PinAnalytics types
└── services/
    ├── otp.ts           # OTP2 client: isochrone + point-to-point routing (all modes)
    ├── analytics.ts     # travelIndex score computation
    └── idealista.ts     # GeoJSON.Polygon → Google Encoded Polyline → Idealista URL
```

## UI

**Mantine** (`@mantine/core` + `@mantine/hooks`) — components (Button, Slider, SegmentedControl, Drawer) and CSS variables for theming. Mobile-first: filter panel is a bottom `Drawer` on mobile, floating card on desktop (`≥ 768px`).

## External services

| Service | Purpose | Notes |
|---|---|---|
| OpenTripPlanner 2 | Isochrone + all routing modes (walk, bike, car, transit) | Self-hosted via Docker, port 8080 |
| OpenFreeMap | Vector map tiles | No API key needed |
| Idealista | Property search target | URL only: `/areas/venta-viviendas/mapa-google?shape=((polyline))` |

## Backend

**OpenTripPlanner 2** runs locally via Docker Compose (`backend/docker-compose.yml`). It serves the OTP REST API on `http://localhost:8080` and handles isochrone requests for all transport modes (walk, bike, car, public transit).

Graph data (GTFS + OSM) lives in `backend/otp/data/` and is loaded at container startup.
