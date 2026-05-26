# 011 — POI Map Layer (Maki Icons)

## Goal
Always-on ambient POI layer on the map using Maki icons from the existing `barcelona_poi.pmtiles` file. Shows basic life-services (supermarket, pharmacy, school, park, etc.) from zoom 14, and dense POIs (cafe, restaurant) from zoom 16.

## Categories

| Category     | Maki icon     | minzoom |
|--------------|---------------|---------|
| supermarket  | grocery       | 14      |
| pharmacy     | pharmacy      | 14      |
| park         | park          | 14      |
| school       | school        | 14      |
| kindergarten | playground    | 14      |
| clinic       | doctor        | 14      |
| beach        | beach         | 14      |
| cafe         | cafe          | 16      |
| restaurant   | restaurant    | 16      |

Metro is excluded — already rendered by MetroLayer.

## Implementation

- **Component:** `src/components/PoiLayer/PoiLayer.tsx`
- **Source:** PMTiles vector source `pmtiles:///barcelona_poi.pmtiles`, source-layer `poi`
- **Icons:** `@mapbox/maki` SVGs loaded via Vite `?raw`, colored `#374151`, added as map images with `pixelRatio: 2`
- **Layers:**
  - `poi-priority` — priority categories, minzoom 14, icon + text label (text fades in at zoom 15)
  - `poi-secondary` — cafe + restaurant, minzoom 16, icon only
- **Text:** name from POI properties, Noto Sans Regular, white halo, `text-optional: true`

## Definition of Done
- [ ] Unit tests ≥ 80%
- [ ] `npm test` green
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] Verified visually via `npm run dev`
