# Architecture

## Repository layout

```
bcn-property-finder/
├── frontend/        # React SPA
├── backend/         # Python FastAPI (post-MVP, empty for now)
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
│   └── ExportButton/    # builds Idealista URL and opens it
├── hooks/
│   ├── useIsochrone.ts  # calls ORS API, returns GeoJSON polygon
│   └── useUrlState.ts   # syncs Zustand store ↔ URL search params
├── store/               # Zustand: workplace, mode, minutes, resultPolygon
└── services/
    ├── ors.ts           # OpenRouteService Isochrones API client
    └── idealista.ts     # GeoJSON.Polygon → Google Encoded Polyline → Idealista URL
```

## UI

**Mantine** (`@mantine/core` + `@mantine/hooks`) — components (Button, Slider, SegmentedControl, Drawer) and CSS variables for theming. Mobile-first: filter panel is a bottom `Drawer` on mobile, floating card on desktop (`≥ 768px`).

## External services

| Service | Purpose | Notes |
|---|---|---|
| OpenRouteService | Isochrone computation | 500 req/day free, foot + transit |
| OpenFreeMap | Vector map tiles | No API key needed |
| Idealista | Property search target | URL only: `/areas/venta-viviendas/mapa-google?shape=((polyline))` |

## Backend (post-MVP)

FastAPI + PostGIS, added when Barcelona open datasets need server-side processing (noise, amenity proximity). Will expose a `/filters` endpoint consumed by the frontend.
