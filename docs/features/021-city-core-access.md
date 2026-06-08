# Feature 021 — City Core Access Index

## Goal

Add a **City Core Access** layer to the livability map that scores how walkable each H3 cell is
to Barcelona's cultural and lifestyle landmarks — answering the question
*"If I live here, do I feel like I'm in Barcelona?"*

This complements livability (POI density, noise) with a different dimension: proximity to the
iconic, non-daily destinations that define the Barcelona experience for expats and relocators.
The layer is backend-free (pre-computed offline) and shareable/crawlable without Idealista data.

## Strategic note

A "City Core Access" heatmap is easy to share on Reddit expat threads and serves long-tail SEO
queries like "barcelona neighborhoods walkable to sagrada familia" or "which barrio is closest to
the beach barcelona". Unlike Idealista price data, this is fully publishable — derived from open
data (OTP2 + OSM).

## User story

> As someone relocating to Barcelona, I want to see a map showing how walkable each neighbourhood
> is to the city's key landmarks, so I can judge whether an area will feel like "real Barcelona"
> on a daily basis — and filter by the landmarks I personally care about.

---

## Landmark set (predefined, user-toggleable)

13 landmarks representing the expat mental model of Barcelona. Three geometry types:
- **point** — classic distance to a coordinate
- **polygon** — distance to nearest boundary edge (0 if you're already inside)
- **line** — distance to nearest point on the polyline

| ID | Name | Geometry | Why |
|----|------|----------|-----|
| `sagrada` | Sagrada Família | point 41.4036, 2.1744 | Symbol of the city |
| `placa_cat` | Plaça de Catalunya | point 41.3870, 2.1700 | City centre, "ground zero" |
| `barceloneta` | Barceloneta beach | point 41.3799, 2.1910 | The sea — quintessential BCN |
| `barri_gotic` | Barri Gòtic / Catedral | point 41.3840, 2.1762 | Historic heart |
| `pg_gracia` | Passeig de Gràcia | point 41.3917, 2.1649 | Modernisme, Eixample identity |
| `arc_triomf` | Arc de Triomf | point 41.3909, 2.1805 | Gateway to Ciutadella / Born axis |
| `montjuic` | Montjuïc | **polygon** (hill boundary) | Cultural hill, southern anchor — distance to edge, not centroid |
| `placa_espanya` | Plaça d'Espanya | point 41.3754, 2.1489 | Fira, Avinguda Reina Maria Cristina |
| `glories` | Torre Glòries / Glòries | point 41.4034, 2.1899 | New BCN hub, Diagonal axis |
| `poblenou` | Rambla del Poblenou | point 41.3975, 2.2011 | Beach neighbourhood + creative district |
| `parc_guell` | Parc Güell | point 41.4145, 2.1527 | Gaudí park, upper city green space |
| `eixample` | Eixample | **polygon** (district boundary) | The grid — anyone inside scores 0 distance |
| `waterfront` | Waterfront | **line** (Besòs → Barceloneta) | Full coastline; nearest point on the coast |

All 13 are enabled by default. User can toggle each individually; index recalculates in real time.

---

## Index definition

For each H3 cell × each landmark:

```
score(cell, landmark) = f(walking_minutes)
  where f:
    ≤ 15 min  → 100
    15–30 min → linear 100 → 75
    30–45 min → linear 75  → 50
    45–90 min → linear 50  → 25
    > 90 min  → 0
    no route  → 0
```

Calibrated so that Badal (Sants-Montjuïc) scores ~50/100 with all 13 landmarks enabled.

**Cell index (0–100):** average of `score(cell, landmark)` over all enabled landmarks.

This gives a smooth gradient: the centre scores ~90+, peripheral areas score lower, and
unreachable areas (e.g. outside city) drop to 0. Linear segments keep the arithmetic simple
and the result interpretable.

---

## UI

### Toggle placement

A new toggle **"City Core Access"** appears in the FilterPanel under the Livability group,
alongside the existing "Consider noise" option. It is **off by default** (same as noise).

When enabled:
- The H3 choropleth switches to City Core Access colouring (replaces or overlays livability — see
  rendering note below).
- A collapsible landmark checklist appears beneath the toggle (8 checkboxes, all on by default).
- Toggling any checkbox instantly recalculates the index for all visible cells (client-side,
  no network request).

### Hover tooltip

Same hex hover as livability. Tooltip shows:
- **City Core Access: 74 / 100**
- Per-landmark breakdown (name + minutes + score bar), e.g.:
  ```
  Sagrada Família   18 min  ████████░░  82
  Plaça Catalunya   12 min  ██████████  100
  Barceloneta       31 min  ███░░░░░░░  56
  …
  ```

### Colour scale

Same sequential scale as livability (green = high access) so the two layers read identically.
Legend label changes to "City Core Access".

### Rendering note

When both Livability and City Core Access are enabled, City Core Access renders **on top**
(higher z-index / separate layer ID). The user sees whichever is most recently toggled as the
dominant layer. A future enhancement could blend them into a composite, but that is out of scope.

---

## Data source / offline pre-computation

Walking times are computed **once offline** using haversine (straight-line) distance with an
urban tortuosity correction factor calibrated for Barcelona.

**Why not OTP2?** OTP2's `/otp/traveltime/isochrone` endpoint was found to include transit
even with `modes=WALK`. From Passeig de Gràcia, OTP2 placed Montbau (5 km away) in the 20-min
band — matching the Metro travel time, not the ~75-min actual walking time confirmed by Google Maps.

**Walking model:**
- Speed: 4.8 km/h (80 m/min, standard pedestrian)
- Tortuosity: 1.35 (Barcelona's urban street-network detour factor)
- Formula: `minutes = haversine_km × 1.35 / 4.8 × 60`
- Spot-check: Montbau → Passeig de Gràcia = 73 min (Google Maps: 75 min ✓)

Three geometry types supported (all pure Python, no external dependencies):
- **point** → haversine point-to-point
- **polygon** → flat-earth projection + ray-casting (inside → 0 km) + min-distance-to-segment
- **line** → flat-earth projection + min-distance-to-segment along the polyline

```
scripts/
  prepare-city-core-access.py
    For each H3 cell centroid:
      For each landmark (point/polygon/line):
        distance_km → walking_minutes
    Emit: frontend/public/data/city-core-access.geojson
```

### GeoJSON schema

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [[...]] },
  "properties": {
    "h3": "891f8b6f94bffff",
    "sagrada": 18,
    "placa_cat": 12,
    "barceloneta": 31,
    "barri_gotic": 22,
    "pg_gracia": 9,
    "arc_triomf": 19,
    "montjuic": 9,
    "placa_espanya": 27,
    "glories": 24,
    "poblenou": 35,
    "parc_guell": 55,
    "eixample": 0,
    "waterfront": 42
  }
}
```

`null` (or absent key) = no walking route found within 90 min (treated as 0 in scoring).

H3 resolution: same as livability grid (`VITE_LIVABILITY_H3_RES`, default res 9).
Coverage: same extent as `livability-h3.geojson` (Barcelona + AMB).

---

## Architecture

```
scripts/
  prepare-city-core-access.*         — offline OTP2 walk → per-landmark minutes → GeoJSON

frontend/public/data/
  city-core-access.geojson           — H3 cells with per-landmark walk minutes (static)

frontend/src/
  services/cityCore/
    landmarks.ts                     — landmark definitions (id, name, coords, default enabled)
    cityCorScore.ts                  — score(minutes) + cellIndex(cell, enabledLandmarks)
    cityCorScore.test.ts
    cityCorData.ts                   — load + cache GeoJSON; build lookup map by h3
    cityCorData.test.ts

  components/CityCorAccessLayer/
    CityCorAccessLayer.tsx           — MapLibre fill layer (choropleth); repaints on landmark toggle
    CityCorAccessLayer.test.tsx

  components/FilterPanel/
    CityCorAccessControls.tsx        — toggle + collapsible landmark checklist
    CityCorAccessControls.test.tsx

  store/
    cityCorStore.ts                  — cityCorVisible, enabledLandmarks (Set<LandmarkId>), setters
    cityCorStore.test.ts
```

Reuses: `LivabilityLayer` colour scale + legend pattern, H3 grid cells from `livability-h3.geojson`
(geometry only; `city-core-access.geojson` provides a separate attribute payload).

---

## New env vars

None — landmark set is hardcoded in `landmarks.ts` (small, infrequently changed). If landmark
editing becomes a power-user feature, a `VITE_CITY_CORE_LANDMARKS` override can be added later.

---

## Out of scope

- Blending City Core Access + Livability into a single composite score (future).
- User-defined custom landmarks (click-to-add pin → add to checklist) — future v2.
- Transit-mode variant (walking only is the point of this feature).
- SEO crawlable pages per landmark ("live within 20 min walk of Sagrada Família") — future.

---

## Definition of Done

- [x] Offline script produces valid `city-core-access.geojson` (res 9, per-landmark minutes, OTP2 walk).
      6244 cells, 3.4 MB. 10 bands per landmark (10–90 min). Min reachable: 10 min.
- [x] Unit tests: `cityCorScore` (score boundaries, cellIndex with subset, null handling),
      `cityCorData` (load, lookup, error), `CityCorAccessControls` (toggle, checkbox, store),
      `CityCorAccessLayer` (loads data, adds layer, repaints on landmark change). 100% coverage on new files.
- [x] `npm test` — all green (469 tests, 50 files).
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
- [x] Manual via `npm run dev`: toggle on → hex grid colours by access (830 cells in viewport);
      layer confirmed in MapLibre (`city-core-fill` + `city-core-h3`); uncheck a landmark →
      live recalc verified (index 28 for 9 landmarks, index=60 for single landmark).

---

> **Note (panel redesign — feature 022 v2):** The standalone `CityCorAccessLayer` and
> `CityCorAccessControls` were **removed**. City Core Access now lives exclusively as a
> weighted component inside the **Composite Index**. The ⚙ gear icon next to "City Core Access"
> in `CompositeControls` opens a modal with the landmark checklist.
> A lightweight `LandmarksLayer` replaces the old marker rendering — it shows pins for enabled
> landmarks whenever the Composite layer is visible and `cityCore` weight > 0.
