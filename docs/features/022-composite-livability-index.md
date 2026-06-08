# Feature 022 — Composite Livability Index

## Goal

Replace the current "Livability" layer with a **Composite Index** that lets the user combine up to
four independent sub-scores into a single H3 choropleth — each sub-score weighted on a 0–10 slider.
The old walkability-only layer is relabelled **"POI Access"** and remains available as a standalone
layer.

---

## Sub-scores (components)

| ID | Display name | Source | Score direction |
|----|-------------|--------|-----------------|
| `poiAccess` | POI Access | `livability-h3.geojson` → `walk` (already 0–100) | Higher = better |
| `noise` | Noise | `livability-h3.geojson` → `lden`, converted via `noiseScore()` (0–100) | Higher = quieter |
| `cityCore` | City Core Access | `city-core-access.geojson` → `cellIndex(enabledLandmarks)` (0–100) | Higher = better access |
| `price` | Idealista Price | Idealista points aggregated to H3 res-9, normalised vs. user's price filter | Higher = cheaper relative to filter |

---

## Composite score formula

```
composite(cell) = Σ (score_i × weight_i) / Σ weight_i
```

- `weight_i` ∈ [0, 10], integer, set by user slider.
- Component is **inactive** when `weight_i = 0` (excluded from numerator and denominator).
- Score range: 0–100.

### Missing data rule

If a cell has no data for a component whose weight > 0:
- That component contributes **0** to the numerator.
- The denominator still includes `weight_i` (i.e., missing data acts as a penalty, not a skip).
- The cell's polygon border is rendered with a **black outline (1.5 px)** to signal incomplete data.

This makes it immediately visible that "this area is cheap on paper but we have no price data here."

---

## Price component — normalisation

```
price_score(cell) = clamp(
  (max_price - cell_median_price) / (max_price - min_price) × 100,
  0, 100
)
```

- `min_price` / `max_price` = user's current Idealista price filter bounds.
- If `min_price === max_price`: price_score = 50 (avoid division by zero).
- Interpretation: a listing at exactly `min_price` (cheapest you'd accept) scores **100**;
  a listing at `max_price` scores **0**; below `min_price` is clamped to 100.
- Cells without any Idealista listings → "missing data" → treated per the missing data rule above.

---

## Panel redesign (v2 — implemented after initial feature)

The standalone layers were simplified to reduce panel clutter. The composite index became the
primary analysis tool.

### Changes

| Before | After |
|--------|-------|
| Area Boundaries layer (always-on toggle) | **Removed** — cluttered and redundant with base tiles |
| Idealista Prices — dots + H3 hex mode | **Dots only** — hex view available by enabling composite with price only |
| POI Access standalone layer | **Removed** — accessible via composite with only poiAccess weight > 0 |
| City Core Access standalone layer | **Removed** — accessible via composite; gear modal replaces the checklist |
| Noise label | Renamed **"Noise Areas"** |
| Price range in Idealista Prices section | Moved **inside composite** → ⚙ gear next to Idealista Price row |
| Landmark checklist in FilterPanel | Moved **inside composite** → ⚙ gear next to City Core Access row |

### Resulting FilterPanel structure

```
Commute from work   [slider]
─────────────────
Idealista Prices    [toggle]
─────────────────
Noise Areas         [toggle]
─────────────────
Composite Index     [toggle]
  [✓] POI Access    ████████  8
  [✓] Noise         ███████░  7
  [✓] City Core ⚙   ████████  8   ← gear → landmark modal
  [✓] Price      ⚙  ████████  10  ← gear → price range modal
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
  when composite is visible and `cityCore` weight > 0. Replaces the marker logic that was in `CityCorAccessLayer`.

### Removed store keys

`barrioBoundariesVisible`, `cityCoreVisible`, `poiAccessVisible`, `idealistaPricesMode`

---

## Renamed / restructured layers

### POI Access (formerly Livability)

- `LivabilityLayer` **deleted** (composite replaces it entirely).
- Raw walk score still usable: enable Composite, set only `poiAccess` weight > 0.

### Noise (existing layer, unchanged)

- `NoiseLayer` (PMTiles visual) stays unchanged.
- Noise is available as a composite input via the `lden` field in `livability-h3.geojson`.

### City Core Access (absorbed into composite)

- Standalone `CityCorAccessLayer` **deleted**.
- Landmark checklist moved to ⚙ gear modal inside `CompositeControls`.
- `LandmarksLayer` shows landmark pins on the map when the component is active.

### Idealista Prices (simplified)

- `IdealistaPricesLayer` is **dots-only** — hex mode removed.
- H3 resolution fixed: `h3Index.ts` `H3_RESOLUTION = 9` (was 8).
- Price range slider moved to ⚙ gear modal inside `CompositeControls`.

---

## Composite Layer — new component

```
components/CompositeLayer/
  CompositeLayer.tsx          — MapLibre fill layer; recomputes on weight/filter/landmark change
  CompositeLegend.tsx         — sequential colour scale, "Composite Score" label
  CompositeLayer.test.tsx
```

### Rendering

- Fill colour: same sequential green ramp as livability.
- Cells with missing data: same fill colour + **black stroke** (`line-width: 1.5`).
- Toggle: separate switch in FilterPanel ("Composite Index").
- Opacity: 0.6 (slightly higher than standalone layers for readability).

---

## New service — `compositeScore`

```
services/composite/
  compositeScore.ts           — computeComposite(cell, weights, priceMap, enabledLandmarks)
  compositeScore.test.ts
  compositeData.ts            — join livability + cityCore lookups; expose per-cell data bundle
  compositeData.test.ts
```

`computeComposite` signature:

```ts
interface CellBundle {
  walk: number            // 0–100
  lden: number | null     // dB, nullable
  cityCore: number        // 0–100, computed from enabledLandmarks
  medianPrice: number | null  // €, nullable
}

interface CompositeWeights {
  poiAccess: number   // 0–10
  noise: number       // 0–10
  cityCore: number    // 0–10
  price: number       // 0–10
}

function computeComposite(
  cell: CellBundle,
  weights: CompositeWeights,
  priceRange: [number, number],
): { score: number; hasGap: boolean }
```

`hasGap: true` when any active component (weight > 0) has null data — drives the black outline.

---

## UI — FilterPanel

New **"Composite Index"** section, rendered by `CompositeControls.tsx`:

```
[ ] Composite Index
  When checked, expands to:

  [✓] POI Access      ████████░░  8   [slider 0–10]
  [✓] Noise           ████░░░░░░  4   [slider 0–10]
  [ ] City Core       ──────────  0   (grayed, slider hidden)
  [✓] Price           ██████░░░░  6   [slider 0–10]

  ⬤ Black outline = missing data for this area
```

- Checkbox = enabled/disabled (weight resets to 0 when unchecked; restores previous value when re-checked).
- Slider only shown when checkbox is checked.
- Enabling "Composite Index" does **not** automatically enable or disable other standalone layers.
- When Price component is enabled, the Idealista price filter is required context — a note appears:
  *"Price score is relative to your price filter (€800 – €1 500)."*

---

## Idealista H3 resolution fix

`frontend/src/components/IdealistaPricesLayer/h3Index.ts`, line 3:

```diff
-const H3_RESOLUTION = 8
+const H3_RESOLUTION = 9
```

This aligns the Idealista hex grid with livability and city-core grids. The hex display in
"Idealista Prices" mode becomes denser (matching the res-9 cells) — this is an improvement.

---

## Store changes

```ts
// Renamed
livabilityVisible      → poiAccessVisible
livabilityConsiderNoise → (removed — noise moves to composite weight)

// New
compositeVisible: boolean
compositeWeights: { poiAccess: number; noise: number; cityCore: number; price: number }
// default: { poiAccess: 7, noise: 8, cityCore: 8, price: 8 }
```

All four components are enabled by default — the composite works out-of-the-box without
the user needing to configure anything.

---

## Data loading strategy

All three data files are already loaded lazily by their respective layers. The composite service
does not fetch anything new — it joins the already-loaded in-memory data:

| Data | Already in memory when… |
|------|-------------------------|
| `livability-h3.geojson` | PoiAccessLayer or CompositeLayer is first enabled |
| `city-core-access.geojson` | CityCorAccessLayer or CompositeLayer is first enabled |
| Idealista H3 map | IdealistaPricesLayer is mounted (always, on app start) |

If CompositeLayer is enabled before IdealistaPricesLayer has loaded the raw features:
price component is treated as all-missing (all cells get black outline for price) until data arrives,
then CompositeLayer recomputes automatically.

---

## Architecture diagram

```
livability-h3.geojson ─┐
                        ├─→ compositeData.ts ─→ CellBundle[]
city-core-access.geojson┘       ↑
                         cityCorData (existing)
                         cityCorScore (existing)

IdealistaPricesLayer ──→ h3Map (res-9) ──→ CellBundle.medianPrice

CompositeLayer ──→ computeComposite(bundle, weights, priceRange)
               ──→ MapLibre fill + black-outline layer
```

---

## Out of scope

- Exporting composite scores as CSV.
- User-saved composite presets ("my weights").
- Blending composite with per-pin scores (future: composite score shown in property popup).
- Sub-score breakdown in hover tooltip (nice-to-have, can be added in v2).

---

## Definition of Done

- [x] `LivabilityLayer` deleted; composite fully replaces it.
- [x] `IdealistaPricesLayer` dots-only; H3 res-9.
- [x] `compositeScore.ts` — unit tests: weighted formula, missing data rule, price normalisation,
      component breakdown (`components` field).
- [x] `compositeData.ts` — unit tests: join logic, null handling.
- [x] `CompositeLayer` — integration test: renders on toggle, repaints on weight change.
- [x] `CompositeControls` — unit tests: checkbox toggle, slider, weight reset/restore, gear modals.
- [x] `LandmarksLayer` — renders pins for enabled landmarks when composite is active with cityCore weight > 0.
- [x] Hover tooltip shows composite score + per-component breakdown (active components only).
- [x] Score range filter: RangeSlider hides cells outside range; legend remaps colour scale.
- [x] `npm test` — all green (476 tests, 49 files).
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
