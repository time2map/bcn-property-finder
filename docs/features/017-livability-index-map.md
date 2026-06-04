# Feature 017 — Livability index map (H3 grid)

## Goal

Add a **city-wide exploration layer** that scores *every part of Barcelona* on livability —
visible **before** the user picks any apartment. Today the app scores a location only once a pin
is dropped (feature 010); this feature pre-computes a walkability index over a uniform **H3 hex
grid** and renders it as a choropleth, so the user can see "good areas" at a glance.

This is the discovery / top-of-funnel layer (see strategic note below). Walkability and noise are
**workplace-independent**, so the whole grid is **pre-computed offline and served as static data** —
no backend, no per-cell runtime computation.

## Strategic note (why this exists)

Top of the acquisition funnel: a shareable, crawlable livability map answers head queries like
`barcelona neighborhood map` and `mejores zonas para vivir en barcelona` (see `seo/keywords.md`).
It funnels into the comparison tool (feature 005/010) and, later, a paid shortlist. Accessibility
from a chosen workplace is added separately in **feature 018** (per-hub precompute).

## User story

> As someone exploring where to live in Barcelona, I want to open a map that colours the whole
> city by how walkable (and optionally how quiet) each area is, so I can spot good zones before I
> even look at listings.

---

## Behaviour

### Layer toggle + sub-options

In the FilterPanel, a **"Livability"** layer toggle. When enabled:
- the H3 choropleth renders over the map (fill colour by index 0–100, with a legend);
- a sub-checkbox **"Consider noise"** appears. Off → index = walkability only. On → index =
  composite of walkability + noise (reusing the existing composite weights).

The control group is built to be **extensible**: future sub-options (per-hub accessibility from
feature 018, other factors) slot into the same list of checkboxes that appears under "Livability".

### Choropleth

- Each H3 cell is a filled hexagon coloured by its index (sequential colour scale; green = high).
- Legend maps colour → score band.
- Cells with no data (e.g. outside coverage) are not rendered.
- Hover a cell → tooltip with the cell's index and per-factor breakdown (walkability, noise).

### Index definition

Per cell, reusing existing logic where possible:
- **Walkability index (0–100)** — same formula as feature 010 (distance-decay + per-category
  saturation): each nearby object contributes
  `exp(-d/D0)` (closer counts more), summed per category, squashed with a per-category saturation,
  aggregated with weights — evaluated at the **cell centroid**. The python precompute mirrors the
  frontend constants (`WALK_DECAY_M` / `WALK_RMAX_M` + `serviceCategories.ts`).
- **Noise index (0–100)** — `noiseScore(lden)` (feature 009) using the cell's representative Lden
  (mean/median of noise polygons intersecting the cell).
- **Composite (when "Consider noise" on)** — `(walk × W_walk + noise × W_noise) / (W_walk + W_noise)`,
  same weights as the pin composite.

---

## Data source / offline pre-computation

Workplace-independent → computed **once, offline**, shipped as a static file.

```
scripts/
  prepare-livability-grid.(py|sh)
    1. Generate H3 cells covering the coverage area (default: Barcelona city + AMB;
       extendable to a wider Catalonia extent via config) at resolution VITE_LIVABILITY_H3_RES.
    2. For each cell centroid: compute walkability index (reuse POI pmtiles + walkability logic).
    3. For each cell: compute representative Lden from the noise dataset → noise index.
    4. Emit each cell as a GeoJSON polygon (hex boundary baked in) with
       properties { h3, walk, noise } → frontend/public/data/livability-h3.geojson
       (or PMTiles if the file is large at high resolution).
```

Baking hex polygons into the file means the **renderer needs no h3 runtime dependency**; `h3-js`
is only needed later for click→cell lookup (feature 018 / interactive v2).

**Resolution:** default H3 **res 9** (~0.1 km², ~170 m edge) — neighbourhood scale. Coarser res 8
(~0.46 km²) is an option for a lighter city-overview file. Start with one resolution; aggregating
cells up to barri level (for the barri data-table / SEO pages) is a follow-up.

---

## New env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_LIVABILITY_H3_RES` | `9` | H3 resolution for the livability grid |
| `VITE_LIVABILITY_COVERAGE` | `bcn-amb` | Coverage extent for the grid (`bcn`, `bcn-amb`, `catalonia`) |

Composite weights reuse existing `VITE_COMPOSITE_WEIGHT_WALKABILITY` / `_NOISE`.

---

## Architecture (planned)

```
scripts/
  prepare-livability-grid.*       — offline H3 grid + walkability + noise → static GeoJSON/PMTiles

frontend/public/data/
  livability-h3.geojson           — H3 cells with { h3, walk, noise } (static)

frontend/src/
  services/livability/
    livabilityData.ts             — load grid; per-cell index + composite (reuse weights)
  components/LivabilityLayer/
    LivabilityLayer.tsx           — MapLibre fill layer (choropleth) + hover tooltip
  components/FilterPanel/
    LivabilityControls.tsx        — "Livability" toggle + "Consider noise" checkbox
                                    (extensible checkbox list — hosts feature-018 hubs later)
  store/index.ts                  — livabilityVisible, livabilityConsiderNoise (+ setters)
```

Reuses: `barcelona_poi.pmtiles` (010), noise dataset (009), composite weights (010).

## Out of scope (future)

- Per-hub accessibility layers → **feature 018**.
- Interactive "click any point → recompute accessibility surface" → future v2 (needs a live OTP
  in production **or** a pre-computed cell→cell travel-time matrix).
- Barri-level aggregation + crawlable SEO pages → separate feature.

## Definition of Done

- [x] Unit tests: `livabilityScore` (cellNoiseScore, livabilityIndex — walk-only, missing-noise
      fallback, composite), `livabilityData` (withIndex, no-mutation, cached loader, error),
      `LivabilityControls` (sub-option reveal, store toggles), `LivabilityLayer` (loads grid,
      adds source+fill layer, setData on toggle). New files at 100% statement coverage.
- [x] Integration: `LivabilityLayer` test drives load → addSource/addLayer → considerNoise setData.
- [x] `npm test` — all green (407 tests, 43 files).
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
- [x] Offline script produced `frontend/public/data/livability-h3.geojson` (res 9, 6244 cells,
      2.4 MB; 14 902 POIs, 85 253 noise polygons; lden covers the ~16 % of cells inside BCN city —
      the official noise map is municipal-only, AMB cells fall back to walk-only).
- [x] Manual via `npm run dev` + Playwright: toggling "Livability" loads the grid (200), reveals
      the "Consider noise" checkbox + legend, and adds a visible `livability-fill` layer with 1156
      features rendered in-view; toggling "Consider noise" recomputes the composite live
      (verified cell walk=50/lden=62.5 → index=47); no feature-related console errors.
```
