# Feature 022 — Composite Livability Index

## Goal

Replace the current "Livability" layer with a **Livability Index** that lets the user combine up to
four independent sub-scores into a single H3 choropleth — each sub-score weighted on a 0–10 slider.
The old walkability-only layer is absorbed into the composite as the "Walkability" component.

---

## Sub-scores (components)

| ID | Display name | Source | Score direction |
|----|-------------|--------|-----------------|
| `poiAccess` | Walkability | `livability-h3.geojson` → `walk` (already 0–100) | Higher = better |
| `noise` | Noise | `livability-h3.geojson` → `lden`, converted via `noiseScore()` (0–100) | Higher = quieter |
| `cityCore` | City Core Access | `city-core-access.geojson` → `cellIndex(enabledLandmarks)` (0–100) | Higher = better access |
| `openPrice` | Market Price | `livability-h3.geojson` → `sale_eur_m2`, normalised via p5/p95 (INCASOL) | Higher = cheaper |

> **Note:** Idealista listing price was removed from composite scoring (feature 024 decision).
> It remains available as a separate dots layer on the map.

---

## Composite score formula

```
composite(cell) = Σ (score_i × weight_i) / Σ weight_i
```

- `weight_i` ∈ [0, 10], integer, set by user slider.
- Component is **inactive** when `weight_i = 0` (excluded from numerator and denominator).
- Score range: 0–100.

### Climate-risk penalties (feature 036)

After the weighted mean, flood and wildfire risks are applied as multiplicative penalties — they are
not components, so safe cells keep their score:

```
score(cell) = composite(cell) × (1 − sFlood/10 · floodRisk) × (1 − sFire/10 · fireRisk)
```

`sFlood`, `sFire` ∈ [0, 10] are separate "Risk penalties" sliders (default 5). Details, data sources and
formulas for `floodRisk` / `fireRisk`: `036-climate-risk-penalties.md`.

### Missing data rule

If a cell has no data for a component whose weight > 0:
- That component contributes **0** to the numerator.
- The denominator still includes `weight_i` (i.e., missing data acts as a penalty, not a skip).
- The cell's polygon border is rendered with a **black outline (1.5 px)** to signal incomplete data.

---

## Panel redesign (v2 — implemented after initial feature)

The standalone layers were simplified to reduce panel clutter. The composite index became the
primary analysis tool.

### Changes

| Before | After |
|--------|-------|
| Area Boundaries layer (always-on toggle) | **Removed** — cluttered and redundant with base tiles |
| Idealista Prices — dots + H3 hex mode | **Dots only** — hex view removed |
| POI Access standalone layer | **Removed** — accessible via composite with only poiAccess weight > 0 |
| City Core Access standalone layer | **Removed** — accessible via composite; gear modal replaces the checklist |
| Noise label | Renamed **"Noise Areas"** |
| Landmark checklist in FilterPanel | Moved **inside composite** → ⚙ gear next to City Core Access row |
| "Composite Index" toggle label | Renamed **"Livability Index"** (with ℹ info modal) |

### Resulting FilterPanel structure

```
Commute from work   [slider]
─────────────────
Idealista Prices    [toggle]
─────────────────
Exclusion Zones     [toggle]
─────────────────
Noise Areas         [toggle]
─────────────────
Livability Index ℹ  [toggle]
  [✓] Walkability   ██████░░  6
  [✓] Noise         ███████░  7
  [✓] City Core ⚙   ████████  8   ← gear → landmark modal
  [✓] Market Price  ██████████ 10
  Score range  [===========]
  [legend]
```

### Deleted components

- `components/BarrioBoundariesLayer/`
- `components/PoiAccessLayer/`
- `components/CityCorAccessLayer/`
- `components/FilterPanel/PoiAccessControls.tsx`
- `components/FilterPanel/CityCorAccessControls.tsx`
- `components/LivabilityLayer/`

### Added components

- `components/LandmarksLayer/LandmarksLayer.tsx` — renders MapLibre markers for enabled landmarks
  when composite is visible and `cityCore` weight > 0.
- `components/HexDetailCard/HexDetailCard.tsx` — click hex → detail card (feature 025).

### Removed store keys

`barrioBoundariesVisible`, `cityCoreVisible`, `poiAccessVisible`, `idealistaPricesMode`

---

## Composite Layer — component

```
components/CompositeLayer/
  CompositeLayer.tsx          — MapLibre fill layer; recomputes on weight/filter/landmark change
  CompositeLegend.tsx         — sequential colour scale
  CompositeLayer.test.tsx
```

### Rendering

- Fill colour: sequential green ramp (red → yellow → green).
- Cells with missing data: same fill colour + **black stroke** (`line-width: 1.5`).
- Toggle: separate switch in FilterPanel ("Livability Index").
- Opacity: 0.6.
- Hover: white border highlight (`composite-hover-outline` layer).
- Click: opens `HexDetailCard` with full breakdown (feature 025).

---

## Service — `compositeScore`

```
services/composite/
  compositeScore.ts           — computeComposite(cell, weights, enabledLandmarks, openPriceBounds)
  compositeScore.test.ts
  compositeData.ts            — join livability + cityCore lookups; expose per-cell data bundle
  compositeData.test.ts
```

`computeComposite` signature (current):

```ts
interface CellBundle {
  h3: string
  walk: number            // 0–100
  lden: number | null     // dB, nullable
  cityCoreProps: CityCoreCellProps
  saleEurM2: number | null    // €/m² from INCASOL, nullable
  walkCategories?: Record<string, number>  // per-category sub-scores (pipeline v2+)
}

interface CompositeWeights {
  poiAccess: number   // 0–10
  noise: number       // 0–10
  cityCore: number    // 0–10
  openPrice: number   // 0–10
}

function computeComposite(
  cell: CellBundle,
  weights: CompositeWeights,
  enabledLandmarkIds: readonly string[],
  openPriceBounds: OpenPriceBounds,
): { score: number; hasGap: boolean; components: ComponentScores }
```

`hasGap: true` when any active component (weight > 0) has null data — drives the black outline.

---

## Store changes

```ts
// New
compositeVisible: boolean
compositeWeights: { poiAccess: number; noise: number; cityCore: number; openPrice: number }
// defaults: { poiAccess: 6, noise: 7, cityCore: 8, openPrice: 10 }
compositeScoreRange: [number, number]  // default [0, 100]
selectedHexH3: string | null           // feature 025
```

---

## Info modal (ℹ)

Clicking ℹ next to "Livability Index" opens a modal explaining:
- How the weighted average works
- Each component's normalisation formula
- Source data for each component

---

## Definition of Done ✅

- [x] `LivabilityLayer` deleted; composite fully replaces it.
- [x] `IdealistaPricesLayer` dots-only; H3 res-9.
- [x] `compositeScore.ts` — unit tests: weighted formula, missing data rule, component breakdown.
- [x] `compositeData.ts` — unit tests: join logic, null handling.
- [x] `CompositeLayer` — integration test: renders on toggle, repaints on weight change.
- [x] `CompositeControls` — unit tests: checkbox toggle, slider, weight reset/restore, gear modals.
- [x] `LandmarksLayer` — renders pins for enabled landmarks when composite is active.
- [x] Hover tooltip shows livability score + per-component breakdown (active components only).
- [x] Score range filter: RangeSlider hides cells outside range; legend remaps colour scale.
- [x] Hover white-border highlight on hex.
- [x] Click hex → `HexDetailCard` with full breakdown (feature 025).
- [x] "Composite Index" renamed to "Livability Index" with ℹ info modal.
- [x] "POI Access" renamed to "Walkability" throughout.
- [x] `npm test` — all green.
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
