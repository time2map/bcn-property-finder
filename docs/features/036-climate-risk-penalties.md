# 036 — Climate risk penalties (flood + wildfire)

## Goal

Add two official climate-hazard signals to the Livability Index — **river flood** and **wildfire** —
so that cells exposed to them rank lower, and let the user inspect the underlying hazard zones on the map.

User story: *As someone relocating to Barcelona, I want areas prone to river flooding or wildfires to
score lower (and to see why), so I don't shortlist a flat in a place I'd regret.*

## Scope

- Coverage: the whole livability grid (Barcelona + AMB, H3 res 9). All inputs cover all of Catalonia's
  internal basins, so no cell is left without data.
- Two indicators only (other climate layers in `data/climate-risk/` were reviewed and deliberately left out,
  see "Rejected inputs").
- Two new view layers: **Flood Zones**, **Wildfire Hazard**.

## Data sources

Produced by `scripts/fetch_climate_risk.py` into `data/climate-risk/` (gitignored).

| Indicator | Layer | Source | License |
|---|---|---|---|
| Flood | `flood_catalonia.gpkg` · `aca_flood_zone_t10` / `_t100` / `_t500` | ACA — Agència Catalana de l'Aigua (river flood zones, 10/100/500-year return period) | Generalitat open data, attribution |
| Wildfire | `fire_catalonia.gpkg` · `pcivil_fire_wui_zone` | Protecció Civil de Catalunya — "Zones d'afectació associades a masses forestals ≥ 5 ha" (wildland–urban interface, Llei 5/2003) | Generalitat open data, attribution |
| Wildfire | `fire_hazard_2024.tif` | Generalitat, Dept. d'Agricultura — Mapa de perill bàsic d'incendi forestal 2024, 100 m, classes 1 (low) – 10 (high), nodata 15 = non-forest | Generalitat open data, attribution |

## Why penalties, not regular components

Analysis on the real grid (6,244 cells, 992 in Barcelona):

- ~90% of Barcelona cells touch no ACA flood zone. As a regular weighted-mean component, flood would be
  ≈ 100 almost everywhere, lifting every cell and compressing the differences between neighbourhoods.
  → Both indicators are **multiplicative penalties** on the composite: safe cells are unchanged.
- "Max forest hazard class within 500 m" does not discriminate: 218 of 328 WUI cells in Barcelona see a
  class-10 pixel. → Hazard intensity **decays with distance** to the forest pixel.
- The hazard raster alone flags 160 Barcelona cells outside the WUI (urban parks classified as forest).
  → The **WUI is a gate**, the raster sets the intensity.

## Formulas

### Pipeline (per cell, sampled at H3 children `res + 2`, like `lden_avg`)

| Field | Meaning |
|---|---|
| `flood_t10`, `flood_t100`, `flood_t500` | Share of cell area (0–1) inside each zone; forced nested: `t100 = max(t100, t10)`, `t500 = max(t500, t100)` |
| `fire_wui` | Share of cell area (0–1) inside the WUI |
| `fire_hazard` | Mean over child samples of `max_px(class/10 · exp(−d / FIRE_DECAY_M))` over forest pixels (class 1–10) within `FIRE_SEARCH_RADIUS_M`; 0 when none |
| `fire_class`, `fire_dist_m` | Class and distance (m) of the pixel with the largest contribution at the cell centre — for the detail card |

### Frontend

```
floodRisk = t10·P10 + (t100 − t10)·P100 + (t500 − t100)·P500          ∈ [0, 1]
fireRisk  = fire_wui · fire_hazard                                     ∈ [0, 1]
score     = round(base × (1 − sFlood/10 · floodRisk) × (1 − sFire/10 · fireRisk))
```

- `base` — existing composite (feature 022).
- `sFlood`, `sFire` — penalty strength 0–10 (user slider). 0 = no effect. 10 + a cell fully in T10 → 0.
- Grid without risk fields (old file) → risk 0, no penalty, no gap outline.

Default zone weights reflect how likely a flood is within a 30-year stay (T10 ≈ 96%, T100 ≈ 26%,
T500 ≈ 6%) and that T500 is the official "floodable zone" in Spanish planning law.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `VITE_FLOOD_PENALTY_T10` | 1.0 | frontend |
| `VITE_FLOOD_PENALTY_T100` | 0.6 | frontend |
| `VITE_FLOOD_PENALTY_T500` | 0.25 | frontend |
| `VITE_RISK_STRENGTH_FLOOD` | 5 | frontend (default slider) |
| `VITE_RISK_STRENGTH_FIRE` | 5 | frontend (default slider) |
| `CLIMATE_SAMPLE_RES` | `LIVABILITY_H3_RES + 2` | pipeline |
| `FIRE_SEARCH_RADIUS_M` | 500 | pipeline |
| `FIRE_DECAY_M` | 150 | pipeline |
| `CLIMATE_RISK_DIR` | `data/climate-risk` | pipeline |

Calibrated on the real grid (2026-09-30) and kept at the defaults above. With them:

| | Cells | Touch T10 / T100 / T500 | In WUI | Fire exposure p50 / p90 / max |
|---|---|---|---|---|
| Barcelona | 992 | 1.4% / 1.9% / 9.8% | 33.1% | 0.00 / 0.56 / 0.78 |
| Rest of grid (AMB) | 5,252 | 14.1% / 17.8% / 22.6% | 69.6% | 0.33 / 0.65 / 0.78 |

Visual check in QGIS: flood risk follows the Besòs corridor (Bon Pastor, Baró de Viver, Sant Adrià,
Santa Coloma) and the Collserola streams; fire risk is highest inside Collserola / Garraf forest, fades
across the Sarrià / Horta / Nou Barris edge and is 0 in the dense city. Example in the app (default
strengths): a Bon Pastor cell 41% in the T500 zone loses 3 points; a Vallvidrera cell in the WUI with a
class-7 forest ~100 m away loses 6 points.

## UI

> Labels renamed in feature 037 to keep river and street flooding apart: *River flood risk*,
> *River flood zones*, card row *River flooding*.

- **Livability Index panel** — new sub-section "Risk penalties" with two rows: *Flood risk*,
  *Wildfire risk* (slider 0–10, same row component as the index weights), ℹ info text: what is measured,
  limitations, sources.
- **Layer toggles** — *Flood Zones* (T500 / T100 / T10 fills, blues) and *Wildfire Hazard* (hazard
  classes 1–10 green→red + WUI outline), each with a legend and source attribution.
- **Hex detail card** — when strength > 0:
  - "Flood: T500 zone (35% of cell) · −8 pts" / "Outside mapped flood zones"
  - "Wildfire: WUI · hazard class 9 forest at ~80 m · −12 pts" / "Not in wildland–urban interface"

## Limitations (shown in the info modal)

- Flood = **river flooding only** (ACA). Street / pluvial flooding from heavy rain is not included.
- Wildfire hazard is **structural** (2024 map), not a daily forecast or a probability; the August 2026
  Collserola fire is not reflected.
- Both are exposure to a hazard, not the expected damage to a specific flat (floor, basement and building
  type are unknown).

## Rejected inputs (reviewed, not used)

- Pluvial hazard index, RESCCUE depth/damage, critical areas — Barcelona-only, no explicit license yet;
  candidates for a later iteration.
- ARPSI pluvial — covers 98.6% of Barcelona, no signal.
- INFOCAT municipal danger/vulnerability — one value per municipality, derived from WMS colours.
- Heat-impact, population density, vulnerability factors — describe residents, not the place.

## Files

- `scripts/climate_risk.py` — per-cell enrichment + view-layer tiles; `enrich_grid` is called from
  `prepare-livability-grid.py`. Run: `arch -x86_64 python3 scripts/climate_risk.py` (`--tiles-only` to
  rebuild just the tiles). Takes ~4.5 min for enrichment + ~3 min for tiles.
- `scripts/test_climate_risk.py`
- `frontend/public/data/flood-zones.pmtiles`, `frontend/public/data/wildfire.pmtiles`
- `frontend/src/services/climateRisk/climateRisk.ts`
- `frontend/src/components/FloodZonesLayer/`, `frontend/src/components/WildfireLayer/`
  (layer + legend with info modal each), `frontend/src/components/FilterPanel/ClimateLayerControls.tsx`
- Changes: `compositeScore.ts`, `compositeData.ts`, `livabilityData.ts`, `store/index.ts`,
  `CompositeControls.tsx`, `FilterPanel.tsx`, `HexDetailCard.tsx`, `layerOrder.ts`, `Map.tsx`

## Definition of Done

1. Unit tests cover new business logic (≥80%): pipeline functions (Python), `climateRisk.ts`, composite penalties.
2. Integration test: grid cell with risk fields → reduced score in `CompositeLayer`.
3. `npm test`, `npm run lint`, `npm run typecheck` — green.
4. Manual check in `npm run dev`: toggles, sliders (0 → index unchanged), detail card in Bon Pastor (flood)
   and Vallvidrera (fire).
5. Docs updated: this file (final parameters), `022-composite-livability-index.md`, `ARCHITECTURE.md`.
