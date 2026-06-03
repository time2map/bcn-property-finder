# Feature 015 — Exclusion ("no-go") zones + Idealista area export

## Goal

Let the user mark areas where they definitely won't live, and **statically subtract** those
areas from the zone exported to Idealista. Workplace/isochrone change often; no-go zones stay
fixed and are always cut out of the resulting area.

Additionally: split the effective area into one or several Idealista search links tied to real
Barcelona neighbourhoods (barris), so each link opens a valid, meaningful search.

## User story

> As a property hunter, I want to mark neighbourhoods I refuse to live in — either by drawing
> them on the map or by picking a district/sub-district — so that every Idealista export
> automatically excludes them, regardless of how I change my workplace or commute time.

---

## Exclusion zones

### Defining a no-go zone

Two ways, both producing an `ExclusionZone` persisted in `localStorage`:

1. **Draw** — a "Draw zone" button enters drawing mode (terra-draw: freehand lasso or
   click-vertex polygon, with vertex editing). Finishing the shape adds a `source: 'drawn'` zone.
   `Esc` cancels.
2. **Add by button** — a grouped picker lists Barcelona `districte` (10) → `barri` (73) and
   metro-area municipalities. Selecting one adds a `source: 'area'` zone with that boundary's
   geometry, and it appears on the map.

Zones are **static**: changing workplace or isochrone minutes does not alter them.

### Map rendering

Exclusion zones render as a distinct red, semi-transparent hatched fill with an outline
(separate from the isochrone mask). Each zone is listed in the panel with its name and a remove (×).

### Effect on the exported area

The **effective area** = isochrone result − union(exclusion zones), computed with
`@turf/difference` over `@turf/union`. Both the in-app preview (isochrone mask) and the
Idealista export use this effective area, so what you see equals what you export.

### Effect on pins (comparison tool)

A pin whose coordinates fall inside any exclusion zone is **flagged**, not removed:
- compare grid shows an "excluded" badge,
- its map marker is dimmed.

---

## Data source

`frontend/public/data/areas.geojson` — built by `scripts/prepare-areas-data.sh`:
- BCN `barris` + `districtes` → Open Data BCN.
- Metro-area municipalities → ICGC Catalunya municipal boundaries (filtered to AMB / adjacent).
- Each feature: `{ id, name, kind: 'district' | 'barri' | 'municipality', parent? }`, simplified
  to keep the file lean. Loaded on demand (plain GeoJSON, not PMTiles).
- 118 features total: 10 districts, 73 barris, 35 municipalities.

---

## Idealista export — URL constraints

Idealista's `shape` was probed in a real browser with minimal URLs:
- ✅ single simple polygon `((ring))` → works
- ❌ multiple polygons `((p1)(p2))` → **HTTP 400**
- ❌ polygon with a hole `((outer)(hole))` → opens but **silently fills the hole**

So **Idealista accepts exactly one simple, hole-free polygon per search**. The export
decomposes the effective area into a small set of simple hole-free polygons and offers
**one link per area** (`services/idealistaAreas.ts`).

---

## Idealista export — barri-based zone decomposition

### Why barri-based zones

The purely geometric decomposition (`decomposeForIdealista`) produced artefacts:
- **Zones over water** — OTP's isochrone extends over the sea near Barceloneta / Port Olímpic.
- **Barceloneta complex contour** — the coastline creates a very jagged polygon.
- **Not tied to real neighbourhoods** — arbitrary geometric slices are hard to interpret and
  change shape unpredictably as the isochrone grows or shrinks.
- **Vertical stripe artefacts** — `cutHoles()` applied to the merged union generated thin
  vertical strips where exclusion zones intersected.

### Algorithm: `decomposeByBarris` (`services/idealistaAreas.ts`)

Primary path; falls back to `decomposeForIdealista()` if no areas loaded or no clips found.

```
1. Intersect each barri/municipality polygon from areas.geojson with the effective area
   → clips are land-only (no barri polygon covers the open sea → water artefacts vanish)
2. Drop clips below MIN_AREA_KM2 (barris that just barely touch the isochrone edge)
3. Union all clips → adjacent barris merge; small simplification gaps fill automatically
4. Buffer expand by MERGE_GAP_DEG then shrink back (expand+shrink trick)
   → fills alleys / precision seams between adjacent barris
   → attaches nearby island pieces to the main polygon (≈ 55 m default)
5. For each connected component: take OUTER RING ONLY
   → clips were already intersected against effectiveArea (exclusions already subtracted),
     so no significant holes remain; outer-ring-only avoids vertical-strip artefacts
   → thin slivers (bounding box min-dimension < MIN_BBOX_DIM_DEG) are dropped here
6. fitToUrlBudget() — simplify to fit the Idealista URL limit
7. Drop slivers below MIN_AREA_KM2, sort by area DESC, cap at MAX_AREAS
```

Key difference from the original algorithm: **no `cutHoles()` pass** on the barri union.
Since exclusions were already subtracted before the barri intersection, the merged union has
no significant holes. Using outer ring only avoids the vertical-stripe problem.

### `decomposeForIdealista` (geometric fallback)

Used when `areas.geojson` is not yet loaded or no barri clips survive. Pipeline:
1. Flatten sub-polygons; significant holes (≥ `HOLE_MIN_KM2`, i.e. exclusion zones) are
   honoured by cutting vertical strips at each hole's mid-x (`@turf/intersect`). Tiny natural
   holes are filled (harmless). A strip's failed intersect falls back to the hole-free outer
   ring — area is never silently dropped.
2. `fitToUrlBudget()` — `@turf/simplify`, doubling tolerance until URL ≤ `MAX_URL_CHARS`;
   pathological pieces fall back to their bounding box (4 points, always fits).
3. Drop negligible slivers (`MIN_AREA_KM2`), sort by area, cap at `MAX_AREAS`.

### Artifact filtering — two-layer defence

1. **Buffer absorbs**: the expand+shrink pass merges slivers within `MERGE_GAP_DEG` of the
   main polygon body.
2. **`isThinSliver()` filter**: removes isolated slivers whose bounding box minimum dimension
   is below `MIN_BBOX_DIM_DEG` — these are isochrone-boundary clips that weren't absorbed
   because they're geometrically separated from the nearest land mass.

---

## Idealista export — UX

### Button-triggered computation

Zones are **not recomputed reactively** (prevents lag when moving the isochrone slider).

- When an isochrone exists but no zones are computed: a **"🏠 Make zones for Idealista"**
  button is shown. Clicking it triggers `compute()`.
- During computation: the button is **disabled** with a spinner ("Computing…"). The
  `setTimeout(0)` pattern ensures React renders the spinner before the synchronous
  blocking computation runs.
- When the effective area changes (slider moved, exclusion added/removed), previously
  computed zones are **cleared automatically** — stale zones are never shown.

`useComputeIdealistaAreas()` hook provides `{ compute, computing, hasAreas }`.  
`useIdealistaAreas()` hook reads results from the Zustand store without triggering computation.

### Area links

Once computed, the panel shows one link per area:
- Area index 0 → **"Main Area ↗"** (always the largest zone by area)
- Areas 1…N → **"Area k/N ↗"**
- A **👁 / 🔇 visibility toggle** button shows/hides zones on the map without clearing them.

### Area ↔ link hover highlighting

Hovering is **bidirectional** via shared store state `hoveredAreaIndex`:
- hover a panel link → the matching area's fill/outline is emphasised (MapLibre `feature-state`);
- hover an area on the map → its panel link is emphasised (`variant="filled"`).
Each map feature carries a numeric `id` = its area index; `setData` clears feature-state, so
the active hover is re-applied after every data swap.

---

## Tunable ENV variables

All in `frontend/.env.local.example`:

| Variable | Default | Meaning |
|---|---|---|
| `VITE_IDEALISTA_MAX_AREAS` | `16` | Cap on exported links (biggest kept) |
| `VITE_IDEALISTA_MIN_AREA_KM2` | `0.05` | Absolute floor; keeps real islands |
| `VITE_IDEALISTA_AREA_RATIO` | `0` | Relative floor fraction of largest (off by default) |
| `VITE_IDEALISTA_HOLE_MIN_KM2` | `0.1` | Only cut open holes ≥ this (exclusion zones) |
| `VITE_IDEALISTA_SIMPLIFY_TOL` | `0.0004` | Initial ring simplification tolerance |
| `VITE_IDEALISTA_MAX_URL_CHARS` | `900` | URL budget per link |
| `VITE_IDEALISTA_MERGE_GAP_DEG` | `0.0005` | Buffer expand+shrink to merge barris/islands (~55 m) |
| `VITE_IDEALISTA_MIN_BBOX_DIM_DEG` | `0.0003` | Sliver filter: drop if bbox min dim < this (~33 m) |

---

## Architecture

```
scripts/
  prepare-areas-data.sh        — build areas.geojson (BCN districtes+barris + metro municipalities)

frontend/public/data/
  areas.geojson                — district/barri/municipality boundaries (118 features)

frontend/src/
  types/exclusions.ts          — ExclusionZone
  store/exclusionsStore.ts     — zustand + localStorage (bcn_exclusion_zones)
  store/index.ts               — idealistaAreas, idealistaUrls, idealistaZonesVisible,
                                  hoveredAreaIndex, setIdealistaAreas, clearIdealistaAreas,
                                  setIdealistaZonesVisible, setHoveredAreaIndex
  services/exclusions.ts       — subtractExclusions (union+difference), isPointInExclusions
  services/areas.ts            — loadAreas() (module-cached); listAreas; getAreaGeometry(id)
  services/idealistaAreas.ts   — decomposeByBarris (primary), isThinSliver,
                                  decomposeForIdealista (geometric fallback), buildIdealistaUrls
  hooks/useEffectiveArea.ts    — memoized isochrone − exclusions
  hooks/useIdealistaAreas.ts   — useIdealistaAreas() (store reader),
                                  useComputeIdealistaAreas() (button-triggered compute + state)
  components/ExclusionLayer/    — red hatched fill + outline
  components/ExclusionDraw/     — terra-draw integration
  components/ExportAreasLayer/  — numbered outlines + hover highlighting;
                                  respects idealistaZonesVisible; label[0]="Main"
  components/FilterPanel/ExclusionControls.tsx — draw button + area picker + active zone list
  components/ExportButton/ExportButton.tsx     — "🏠 Make zones" button → area links
                                                  + 👁/🔇 visibility toggle
```

Modified files (beyond new modules above):
- `services/idealista.ts` — single simple ring per URL (`buildIdealistaUrl`)
- `components/IsochroneLayer/IsochroneLayer.tsx` — mask from effective area
- `components/Map/Map.tsx` — mount `<ExclusionLayer/>` + `<ExclusionDraw/>`
- `components/PropertyPins/PinLayer.tsx`, `CompareGrid.tsx` — pin-in-exclusion flag
- `docs/ARCHITECTURE.md` — document exclusion modules + areas dataset

## New dependencies

`terra-draw`, `terra-draw-maplibre-gl-adapter`, `@turf/buffer`, `@turf/difference`,
`@turf/union`, `@turf/intersect`, `@turf/area`, `@turf/simplify`.

---

## Definition of Done

- [x] Unit tests: exclusionsStore, exclusions service, areas service, useEffectiveArea,
      idealista (single ring), idealistaAreas (hole-cut, filter, cap, decomposeByBarris —
      null geometry, no areas fallback, no-intersection fallback, adjacent merge, tiny clip
      filter, municipality kind, hole-free output, isThinSliver),
      useIdealistaAreas / useComputeIdealistaAreas (store reader, compute populates store,
      clears on effectiveArea change), ExportButton ("Make zones" button, "Main Area" label,
      visibility toggle), ExportAreasLayer (label 'Main'/'2', feature-state hover)
- [x] Integration test: workplace → isochrone → add exclusion → effective area excludes it →
      per-area export URLs change; pin inside gets badge (CompareGrid)
- [x] `npm test` — all green (365 tests)
- [x] `npm run lint` — no errors
- [x] `npm run typecheck` — no errors
- [x] Idealista format probed in a real browser: only a single simple hole-free polygon per
      search works → export decomposes into per-area links
- [x] Performance: isochrone slider drag does not recompute zones (button-triggered only)
- [x] No water zones: barri-based decomposition produces land-only areas
- [x] No vertical stripe artefacts: outer-ring-only avoids cutHoles on the merged union
- [x] Island attachment: buffer expand+shrink merges nearby pieces within ~55 m
- [x] Thin sliver filtering: two-layer defence (buffer absorbs, isThinSliver removes isolated)
- [ ] **Remaining (manual, human):** open the generated per-area URLs in a real browser and
      confirm each opens a valid Idealista search (no 400) and the excluded zone is not covered
- [ ] **Remaining (manual):** in `npm run dev` with a real basemap, visually confirm the red
      zone fill + dimmed mask hole + dimmed pin marker
