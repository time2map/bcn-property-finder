# Feature 024 — Open Price Component (INCASOL)

## Goal

Add a second price component to the Composite Index based on **open government data
(INCASOL / Generalitat de Catalunya)** instead of scraped Idealista listings.

- **Open Price** (INCASOL) — enabled by default, weight 10.
- **Idealista Price** (existing `price` component) — disabled by default, weight 0.
  Reserved for admin use (future gate).

Coverage: Barcelona city at barri level (73 zones); the rest of Catalonia at
municipality level (~358 municipalities).

---

## Why two price components

| | Open Price (INCASOL) | Idealista Price |
|---|---|---|
| Source | Official registry transactions (Registre de la Propietat) | Scraped listing prices |
| Metric | €/m² (normalised per area) | Total listing price (€) |
| Granularity | Barri / municipality | H3 res-9 (~174 m) |
| Coverage | All BCN barris + ~358 Catalonia munis | Only cells that have listings |
| Legal status | CC-BY open data | Legally unclear |
| Cadence | Annual (latest year auto-selected) | Snapshot in time |
| Default | **Enabled** | **Disabled** |

The INCASOL metric is better for comparing *neighbourhood affordability* across the map.
The Idealista metric is better for matching against a user's personal budget.

---

## Data pipeline

### Step 1 — Python preprocessing (new script: `scripts/enrich_h3_with_prices.py`)

For each H3 cell in `livability-h3.geojson` (6 244 cells):

1. Compute centroid coordinates.
2. **Point-in-polygon → barri** (`data/areas/barris.geojson`):
   - If centroid falls inside a barri → look up `sale_total_latest` from
     `data/open-prices/bcn_sale_barri_eur_m2_annual.json`.
   - Source tag: `'barri'`.
3. **Fallback → municipality** (`data/areas/catalonia_municipis_icgc.geojson`):
   - If no barri match (cell is outside Barcelona city) → look up `sale_total_latest`
     from `data/open-prices/catalonia_sale_muni.json`.
   - Source tag: `'muni'`.
4. Write two new fields per cell:
   - `sale_eur_m2: number | null` — the price (€/m²), or null if no data.
   - `sale_src: 'barri' | 'muni' | null` — data source tag (useful for debugging/display).

Output: updated `frontend/public/data/livability-h3.geojson`.

### Normalisation constants (computed during preprocessing)

During enrichment, compute p5 and p95 of all non-null `sale_eur_m2` values and write
them to `frontend/public/data/open-price-meta.json`:

```json
{ "sale_p5": 2100, "sale_p95": 6800 }
```

These become the normalisation floor/ceiling so outlier barris (e.g. Pedralbes, Torre Baró)
don't compress the mid-range into a narrow band.

---

## Score computation

### `openPriceScore(saleEurM2, p5, p95): number`

```
score = clamp(
  (p95 - saleEurM2) / (p95 - p5) × 100,
  0, 100
)
```

- Lower €/m² → **higher** score (cheaper = better for the buyer).
- `saleEurM2 ≤ p5` → 100 (very cheap).
- `saleEurM2 ≥ p95` → 0 (very expensive).
- `null` → missing data, treated by composite missing-data rule (0 + black outline).

The p5/p95 bounds are fixed from preprocessing — not user-adjustable.
This makes the score an *objective affordability* signal independent of any budget filter.

---

## Frontend changes

### `services/composite/compositeScore.ts`

```ts
// New field in CellBundle
interface CellBundle {
  // ... existing ...
  saleEurM2: number | null    // NEW: from livability-h3.geojson → sale_eur_m2
}

// Extended weights
interface CompositeWeights {
  poiAccess: number
  noise: number
  cityCore: number
  openPrice: number   // NEW — INCASOL
  price: number       // existing — Idealista (default 0)
}

// New score function
export function openPriceScore(
  saleEurM2: number,
  p5: number,
  p95: number,
): number
```

### `services/composite/compositeData.ts`

- `CellBundle` gets `saleEurM2` read from `livability-h3.geojson` feature `.properties.sale_eur_m2`.
- `loadPriceMeta(): Promise<{ sale_p5: number; sale_p95: number }>` — fetches
  `open-price-meta.json`, cached in module scope.

### `store/index.ts`

```ts
DEFAULT_COMPOSITE_WEIGHTS = {
  poiAccess: 7,
  noise:     8,
  cityCore:  8,
  openPrice: 10,   // NEW — enabled by default
  price:     0,    // Idealista — disabled by default
}
```

### `components/FilterPanel/CompositeControls.tsx`

Composite panel rows:

```
[✓] POI Access       ████████░░  8
[✓] Noise            ████████░░  8
[✓] City Core  ⚙     ████████░░  8   ← gear → landmark modal (existing)
[✓] Market Price     ██████████  10  ← INCASOL open data (NEW)
[ ] Price      ⚙     ──────────  0   ← Idealista (disabled by default)
```

- Row label for `openPrice`: **"Market Price"**.
- No gear modal for Market Price (normalization is fixed, not user-adjustable).
- Row label for `price`: **"Price (Idealista)"** — to distinguish the two.
- The Idealista price gear modal (price range filter) stays on the `price` row, unchanged.

#### Future: admin gate for Idealista row

The `price` row can be conditionally rendered based on an `isAdmin` flag (not in scope
for this feature). For now it's visible but off by default.

---

## Missing data behaviour

| Situation | `sale_eur_m2` | Behaviour |
|---|---|---|
| H3 cell inside BCN barri with data | number | Normal score |
| H3 cell inside BCN barri, no transactions (e.g. Can Peguera 2025) | `sale_total_latest` from nearest year | Normal score |
| H3 cell outside BCN, inside Catalonia municipality with data | number | Normal score, `sale_src='muni'` |
| H3 cell outside BCN, in municipality too small for INCASOL data | null | Missing data → 0 + black outline |
| H3 cell entirely outside Catalonia | null | Missing data → 0 + black outline |

---

## Coverage expectations

Based on current data (`bcn_sale_barri` + `catalonia_sale_muni`):
- All 6 244 H3 cells in `livability-h3.geojson` are in Barcelona city or immediate metro area.
- Barcelona city cells (all 73 barris have data): **~100% coverage**.
- Cells just outside city boundary (Hospitalet, Badalona, etc.): covered by `catalonia_sale_muni`.
- Estimated total null cells: < 5% (very small municipalities with suppressed data).

---

## Files changed

### New
- `scripts/enrich_h3_with_prices.py`
- `frontend/public/data/open-price-meta.json`

### Modified
- `frontend/public/data/livability-h3.geojson` — new fields `sale_eur_m2`, `sale_src`
- `frontend/src/services/composite/compositeScore.ts` — `openPriceScore()`, updated `CellBundle`, `CompositeWeights`
- `frontend/src/services/composite/compositeData.ts` — reads `sale_eur_m2`, loads `open-price-meta.json`
- `frontend/src/store/index.ts` — `openPrice: 10`, `price: 0` defaults
- `frontend/src/components/FilterPanel/CompositeControls.tsx` — new row, label rename

### Tests to add / update
- `compositeScore.test.ts` — `openPriceScore()` unit tests (normal, clamp, null)
- `compositeData.test.ts` — `saleEurM2` field reading, `loadPriceMeta()` mock
- `CompositeControls.test.tsx` — `openPrice` row render, `price` row label change

---

## Out of scope

- Rental price component (`rent_eur_month`) — separate feature if needed.
- Admin gate for Idealista row — UI flag, separate small feature.
- User-adjustable €/m² range for Market Price — currently fixed at p5/p95.
- Per-cell source indicator in tooltip (showing 'barri' vs 'muni') — nice-to-have.

---

## Definition of Done

- [ ] `scripts/enrich_h3_with_prices.py` runs without errors, adds fields to geojson.
- [ ] `open-price-meta.json` generated with valid p5/p95 values.
- [ ] `openPriceScore()` unit tested: normal case, floor clamp (cheap), ceiling clamp (expensive), p5=p95 edge.
- [ ] `compositeData.ts` unit tested: `saleEurM2` reading (null passthrough, number passthrough).
- [ ] `CompositeControls` renders "Market Price" row enabled, "Price (Idealista)" row disabled.
- [ ] Composite map visually shows price variation across barris (lighter = cheaper, darker = more expensive).
- [ ] Cells outside coverage show black outline when `openPrice` weight > 0.
- [ ] `npm test` — all green.
- [ ] `npm run lint` — no errors.
- [ ] `npm run typecheck` — no errors.
- [ ] Manually verified: disabling Market Price and enabling Idealista Price produces different (H3-level) result.
