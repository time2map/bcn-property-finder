# Feature 010 — 15-Minute City Walkability Score

## Goal

Add a walkability dimension to property scoring: when a pin is selected, show the nearest urban services on the map with estimated walking times, and include a walkability score in the compare table and composite score.

## User story

> As a property hunter, I want to see which essential services (supermarket, pharmacy, park, etc.) are within walking distance of a property, and understand at a glance how "walkable" the location is.

## Behaviour

### Pin selection → map markers

When the user selects a pin in the compare table or on the map:
- Show map markers for the **top N nearest POIs per service category** (N varies by category — see table below)
- Each marker displays: `{emoji} {name} {N} min` — name is always visible, truncated to 14 chars
- Marker border color:
  - **Green** — ≤ 15 min walk
  - **Orange** — 16–25 min
  - **Red** — > 25 min
- Markers are removed when the pin is deselected

Services are shown regardless of whether they fall within the 15-minute threshold.

### Compare table — walkability column

Column `🏙️` shows walkability score (0–100).
- Color coding: green ≥ 70, orange ≥ 40, red < 40; shows `—` while loading
- **Hover tooltip** shows per-category breakdown: emoji, label, nearest POI name, and walking minutes (or `—` if none found)

### Composite score update

Walkability becomes a third factor in the composite score:

```
compositeScore = (travel × W_travel + noise × W_noise + walkability × W_walk)
                 / (W_travel + W_noise + W_walk)
```

Default weights: travel = 5, noise = 2, walkability = 3. All configurable via env vars.

## Service categories

| ID | Label | Emoji | topN | OSM tags |
|----|-------|-------|------|----------|
| supermarket | Supermarket | 🏪 | 3 | `shop=supermarket` |
| pharmacy | Pharmacy | 💊 | 1 | `amenity=pharmacy` |
| park | Park | 🌿 | 3 | `leisure=park` (≥ 5 000 m² area only) |
| school | School | 🎓 | 2 | `amenity=school` |
| kindergarten | Kindergarten | 🧸 | 2 | `amenity=kindergarten` |
| clinic | Clinic / Doctor | 🏥 | 1 | `amenity=doctors`, `amenity=clinic` |
| metro | Metro station | 🚇 | 1 | `station=subway` (one node per station; subway entrances excluded) |
| cafe | Cafe | ☕ | 1 | `amenity=cafe` |
| restaurant | Restaurant | 🍽️ | 3 | `amenity=restaurant` |
| beach | Beach | 🏖️ | 1 | `natural=beach` (polygon centroid) |

## Scoring

**Walking time estimate** (no additional OTP2 calls):
```
walkingMinutes = haversine(meters) × 1.3 / 80
```
- `1.3` — urban detour factor
- `80 m/min` — average walking speed (4.8 km/h)

**Walkability score** (0–100):
```
score = (categories_with_≥1_poi_within_1200m / 10) × 100
```
1200m haversine ≈ 15 min at 80 m/min with 1.3 detour.

## Data source

**PMTiles** — `public/barcelona_poi.pmtiles` (served statically, alongside `noise.pmtiles`):
- Extracted once from `backend/otp/data/barcelona.osm.pbf` via `scripts/extract_poi.py`
- Layer name: `poi`, zoom level z14 only (`-Z14 -z14`), no tile compression
- 14 902 features: ~12 454 POI nodes + 853 park centroids (filtered from 3 184 total) + 86 beach centroids + 1 509 school/kindergarten polygon centroids
- Queried at runtime via the `pmtiles` JS library (same pattern as `noiseData.ts`)
- No external API calls, no rate limits, instant response

**Park area filter:** parks with polygon area < 5 000 m² (shoelace formula with lat correction) are excluded. This removes tiny garden patches that are not actually walkable.

**Regenerating the file** (when OSM data is updated):
```bash
python scripts/extract_poi.py
# Outputs: frontend/public/barcelona_poi.pmtiles
# Requires: ogr2ogr, tippecanoe, python3
```

Full extraction script: `scripts/extract_poi.py`

## New env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_COMPOSITE_WEIGHT_WALKABILITY` | `3` | Walkability weight in composite score |

## Architecture

```
scripts/
  extract_poi.py            — one-time: PBF → GeoJSON (nodes + park/beach centroids, area-filtered) → PMTiles

frontend/public/
  barcelona_poi.pmtiles     — static POI tileset (1.4 MB)

frontend/src/
  services/walkability/
    walkabilityTypes.ts     — ServiceCategory (with topN), ServiceResult types
    serviceCategories.ts    — 10 category definitions with per-category topN
    pmtilesPoi.ts           — direct PMTiles access + haversine + top-N per category
    walkabilityScore.ts     — score computation (0–100, threshold 1200m)

  components/WalkabilityLayer/
    WalkabilityLayer.tsx    — MapLibre HTML markers (emoji + name + time) for selected pin
```

Modified files:
- `types/pins.ts` — added `walkabilityScore?`, `walkabilityServices?` to `PinAnalytics`
- `services/analytics.ts` — added walkability weight, updated `computeCompositeScore`
- `hooks/usePinAnalytics.ts` — added PMTiles POI lookup to `calcAnalytics`
- `components/Map/Map.tsx` — mounted `<WalkabilityLayer />`
- `components/PropertyPins/PinCompareTable.tsx` — walkability column with hover tooltip
- `components/FilterPanel/FilterPanel.tsx` — updated ⓘ info modal (3-factor weights)
- `src/index.css` — walkability marker styles

## Definition of Done

- [x] Unit tests: `pmtilesPoi`, `walkabilityScore`, service category matchers (≥ 80% coverage)
- [x] `npm test` — all green (222 tests)
- [x] `npm run lint` — no errors
- [x] `npm run typecheck` — no errors
- [x] Manual verification via `npm run dev`:
  - Pin added → walkability score appears in table
  - Pin selected → service markers appear on map with emoji + name + time, color-coded
  - Pin deselected → markers disappear
  - Hover over 🏙️ badge → tooltip shows all 10 categories with nearest POI name and walking minutes
  - Composite score reflects walkability component
  - Beach marker visible for coastal pins
  - Only 1 nearest metro station shown; no subway entrance duplicates
  - Small parks (< 5 000 m²) not shown
