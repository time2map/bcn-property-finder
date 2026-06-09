# Feature 024 — Open Price Component (INCASOL)

## Goal

Add a **Market Price** component to the Livability Index based on **open government data
(INCASOL / Generalitat de Catalunya)** instead of scraped Idealista listings.

- **Market Price** (INCASOL) — enabled by default, weight 10.
- **Idealista Price** — removed from the composite index entirely. Remains as a standalone
  dots layer on the map (see `IdealistaPricesLayer`).

Coverage: Barcelona city at barri level (73 zones); the rest of Catalonia at
municipality level (~358 municipalities).

---

## Why INCASOL over Idealista for the composite

| | Market Price (INCASOL) | Idealista (standalone layer) |
|---|---|---|
| Source | Official registry transactions (Registre de la Propietat) | Scraped listing prices |
| Metric | €/m² (normalised per area) | Total listing price (€) |
| Granularity | Barri / municipality | Per-listing (dots) |
| Coverage | All BCN barris + ~358 Catalonia munis | Only cells with active listings |
| Legal status | CC-BY open data | Legally unclear |
| Cadence | Annual (latest year auto-selected) | Snapshot in time |
| Used in composite | **Yes** | **No** |

INCASOL metric is better for comparing *neighbourhood affordability* across the map.
The Idealista dots layer is still available for checking specific listing prices.

---

## Data pipeline

### Step 1 — Base livability grid

`scripts/prepare-livability-grid.py` must run first and produces `livability-h3.geojson`
with all walk/noise/sub-category fields.

### Step 2 — Python preprocessing (`scripts/enrich_h3_with_prices.py`)

Runs **after** `prepare-livability-grid.py`. For each H3 cell in `livability-h3.geojson`
(6 244 cells):

1. Compute centroid coordinates.
2. **Point-in-polygon → barri** (`data/areas/barris.geojson`):
   - If centroid falls inside a barri → look up `sale_total_latest` from
     `data/open-prices/bcn_sale_barri_eur_m2_annual.json`.
   - Source tag: `'barri'`.
3. **Fallback → municipality** (`data/areas/catalonia_municipis_icgc.geojson`):
   - If no barri match → look up `sale_total_latest`
     from `data/open-prices/catalonia_sale_muni.json`.
   - Source tag: `'muni'`.
4. Write two new fields per cell:
   - `sale_eur_m2: number | null` — the price (€/m²), or null if no data.
   - `sale_src: 'barri' | 'muni' | null` — data source tag.

Output: updated `frontend/public/data/livability-h3.geojson`.

### Normalisation constants

During enrichment, compute p5 and p95 of all non-null `sale_eur_m2` values and write
them to `frontend/public/data/open-price-meta.json`:

```json
{ "sale_p5": 2100, "sale_p95": 6800 }
```

These become the normalisation floor/ceiling so outlier barris (e.g. Pedralbes, Torre Baró)
don't compress the mid-range.

---

## Score computation

### `openPriceScore(saleEurM2, bounds): number`

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

---

## Frontend changes

### `services/composite/compositeScore.ts`

```ts
interface CellBundle {
  h3: string
  walk: number
  lden: number | null
  cityCoreProps: CityCoreCellProps
  saleEurM2: number | null    // from livability-h3.geojson → sale_eur_m2
  walkCategories?: Record<string, number>
}

interface CompositeWeights {
  poiAccess: number   // 0–10
  noise: number       // 0–10
  cityCore: number    // 0–10
  openPrice: number   // 0–10 — INCASOL Market Price
}

export function openPriceScore(saleEurM2: number, bounds: OpenPriceBounds): number

function computeComposite(
  cell: CellBundle,
  weights: CompositeWeights,
  enabledLandmarkIds: readonly string[],
  openPriceBounds: OpenPriceBounds,
): { score: number; hasGap: boolean; components: ComponentScores }
```

### `services/composite/compositeData.ts`

- `CellBundle.saleEurM2` read from `livability-h3.geojson` feature `.properties.sale_eur_m2`
  (via `(p as Record<string, unknown>).sale_eur_m2` since the field is added by a separate script
  and not part of `LivabilityCellProps`).
- `loadOpenPriceMeta(): Promise<OpenPriceBounds>` — fetches `open-price-meta.json`, cached in
  module scope as `hexOpenPriceBounds`.

### `store/index.ts`

```ts
DEFAULT_COMPOSITE_WEIGHTS = {
  poiAccess: 6,
  noise:     7,
  cityCore:  8,
  openPrice: 10,
}
```

### `components/FilterPanel/CompositeControls.tsx`

Composite panel rows:

```
[✓] Walkability      ██████░░░░  6
[✓] Noise            ███████░░░  7
[✓] City Core  ⚙     ████████░░  8   ← gear → landmark modal
[✓] Market Price     ██████████  10  ← INCASOL open data
```

No gear modal for Market Price (normalisation is fixed, not user-adjustable).

---

## Missing data behaviour

| Situation | `sale_eur_m2` | Behaviour |
|---|---|---|
| H3 cell inside BCN barri with data | number | Normal score |
| H3 cell outside BCN, inside Catalonia municipality with data | number | Normal score, `sale_src='muni'` |
| H3 cell in municipality too small for INCASOL data | null | Missing data → 0 + black outline |
| H3 cell entirely outside Catalonia | null | Missing data → 0 + black outline |

---

## Coverage

Based on current data (`bcn_sale_barri` + `catalonia_sale_muni`):
- Barcelona city cells (all 73 barris have data): **~100% coverage**.
- Cells just outside city boundary (Hospitalet, Badalona, etc.): covered by `catalonia_sale_muni`.
- Total enriched cells: 6190 / 6244 (~99.1%).

---

## Files changed

### New
- `scripts/enrich_h3_with_prices.py`
- `frontend/public/data/open-price-meta.json`

### Modified
- `frontend/public/data/livability-h3.geojson` — added `sale_eur_m2`, `sale_src` fields
- `frontend/src/services/composite/compositeScore.ts` — `openPriceScore()`, `CellBundle.saleEurM2`, no `price`
- `frontend/src/services/composite/compositeData.ts` — reads `sale_eur_m2`, loads `open-price-meta.json`
- `frontend/src/store/index.ts` — `openPrice: 10` default; no `price` field
- `frontend/src/components/FilterPanel/CompositeControls.tsx` — Market Price row only

---

## Out of scope

- Rental price component (`rent_eur_month`) — separate feature if needed.
- User-adjustable €/m² range for Market Price — fixed at p5/p95.
- Per-cell source indicator in tooltip (showing 'barri' vs 'muni') — nice-to-have.

---

## Definition of Done ✅

- [x] `scripts/enrich_h3_with_prices.py` runs without errors, adds fields to geojson.
- [x] `open-price-meta.json` generated with valid p5/p95 values.
- [x] `openPriceScore()` unit tested: normal case, floor clamp, ceiling clamp, p5=p95 edge.
- [x] `compositeData.ts` unit tested: `saleEurM2` reading (null passthrough, number passthrough).
- [x] `CompositeControls` renders "Market Price" row enabled, no "Price (Idealista)" row.
- [x] Composite map visually shows price variation across barris (lighter = cheaper).
- [x] Cells outside coverage show black outline when `openPrice` weight > 0.
- [x] `npm test` — all green.
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
