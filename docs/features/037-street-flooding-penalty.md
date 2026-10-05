# 037 — Street flooding penalty (RESCCUE) + depth layer

## Goal

Add flooding of **streets during heavy rain** — Barcelona's main flood risk — to the Livability Index,
next to the river-flood and wildfire penalties from feature 036, and let the user see the modelled
water depth on the map.

User story: *As someone looking for a flat in Barcelona, especially a ground-floor flat or one with an
underground parking space, I want streets that fill with water in a heavy downpour to score lower, and to
see how deep the water gets.*

## Data source

`data/climate-risk/flood_bcn.gpkg` (from `scripts/fetch_climate_risk.py`):

| Layer | What | Elements |
|---|---|---|
| `bcn_resccue_depth_t10_current` | RESCCUE 1D/2D model, 10-year rain, current climate | ~198k |
| `bcn_resccue_depth_t100_current` | … 100-year rain, current climate | ~328k |

Fields used: `area2d` (m², model mesh element ≤ 150 m²), `depth2d` (m, ≥ 0.01). Source: Ajuntament de
Barcelona — Atles de resiliència, RESCCUE project (BCASA / Aquatec). **No explicit license** on the public
viewer; published with attribution, license risk accepted by the product owner. Attribution text:
"Street flooding: RESCCUE model (BCASA / Aquatec) · Atles de resiliència, Ajuntament de Barcelona".

Coverage: Barcelona municipality only.

## River flooding ≠ street flooding

Two different datasets with different meanings — the UI must never mix them up:

| | River flood zones (036) | Street flooding (037) |
|---|---|---|
| Source | ACA | RESCCUE model |
| Shows | *where* a river overflows, by probability (T10/T100/T500) | *how deep* water gets on streets in heavy rain (T10/T100) |
| Depth | no | yes |
| Colours | blues by probability, with outline | magenta scale by depth, no outline |
| Labels | "River flood zones", "River flood risk", "River flooding" | "Street flooding (heavy rain)", "Street flooding risk", "Street flooding" |

Each layer's info modal cross-references the other.

## Who it matters for

Street water is a problem mainly for **ground-floor flats (planta baja / bajos), basements and underground
parking** — water gets in over the door step and down the ramps. For flats higher up it mostly means the
street is impassable for a while. Shown in the index info modal, the layer legend modal and in the hex detail
card when the penalty is > 0.

## Depth threshold analysis

Share of the 992 Barcelona cells (H3 res 9) where water deeper than X covers > 1% of the cell:

| Depth > | T10 | T100 |
|---|---|---|
| 10 cm | 45% | 68% |
| 15 cm | 36% | 60% |
| 30 cm | 21% | 42% |
| 50 cm | 12% | 28% |
| 1 m | 5% | 12% |

- A hard 10 cm threshold flags two thirds of the city at T100 — the index stops discriminating — and 10 cm
  mostly stays inside the kerb (~15 cm in Barcelona).
- A hard 30 cm threshold creates a cliff (29 cm → nothing, 31 cm → full).
- → **Smooth weight**: 0 at ≤ 10 cm, linear to 1 at ≥ 50 cm. 15–30 cm: water over the kerb and door step
  (RESCCUE's high pedestrian hazard also starts at ~16 cm); ≥ 50 cm: cars float, serious ground-floor damage.

## Formulas

### Pipeline (`scripts/climate_risk.py`)

```
severity(d) = clip((d − MIN) / (MAX − MIN), 0, 1)                 MIN = 0.10 m, MAX = 0.50 m
street_T    = Σ area2d · severity(depth2d) / cell_area             T ∈ {t10, t100}
```

- Elements are assigned to H3 cells by centroid (elements ≤ 150 m², cells ~105,000 m²).
- Cells whose centre is in the Barcelona municipality get a number (0 when dry); other cells `null`.

Severity-weighted flooded share in Barcelona: p90 / p99 = 0.05 / 0.16 (T10), 0.11 / 0.28 (T100). The top
cells coincide with RESCCUE's critical areas (Torrent de Tapioles, Zona Franca / Seat, Raval / Sant Pau,
Paral·lel).

### Frontend (`services/climateRisk/climateRisk.ts`)

```
r10   = min(1, street_t10 / SAT)
r100  = max(min(1, street_t100 / SAT), r10)
streetFloodRisk = r10 · P10 + (r100 − r10) · P100                 SAT = 0.15; P10 / P100 = 1.0 / 0.6 (as 036)
score = base × (1 − sRiver/10 · riverFlood) × (1 − sFire/10 · fire) × (1 − sStreet/10 · streetFlood)
```

`null` (outside Barcelona) → risk 0.

### Calibration (2026-10-05, defaults kept)

Grid run: 992 Barcelona cells; `street_t10` > 0 in 71%, `street_t100` > 0 in 83%;
p50 / p90 / p99 = 0.002 / 0.038 / 0.150 (T10), 0.010 / 0.098 / 0.288 (T100).

| Street-flooding risk | Share of Barcelona cells |
|---|---|
| > 0.1 | 37% |
| > 0.3 | 17% |
| > 0.6 | 8% |
| = 1 | 1% |

At strength 5 on a base score of 60, the median cell loses ~1.5 points, the worst 10% lose ≥ 15, the
maximum is 30. Visual check in QGIS: the highest-risk cells match RESCCUE's critical areas (Sant Pau /
Paral·lel, Riera Blanca / Parcerisa, Zona Franca / Seat, Torrent de Tapioles, Tajo-Cartellà, Sant Andreu –
Rambla Prim, Diagonal Bruc – Roger de Flor) plus the old stream beds (rieres). In the app: a Raval cell next
to carrer de Sant Pau goes 72 → 36 (effective flooded area 20% at T10, 29% at T100); an L'Hospitalet cell
shows "No street-flooding model outside Barcelona".

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `VITE_STREET_FLOOD_SATURATION` | 0.15 | frontend — weighted flooded share that counts as full risk |
| `VITE_RISK_STRENGTH_STREET` | 5 | frontend — default slider strength |
| `STREET_FLOOD_MIN_DEPTH_M` | 0.10 | pipeline |
| `STREET_FLOOD_MAX_DEPTH_M` | 0.50 | pipeline |

## UI

- **Risk penalties**: "River flood risk" (renamed), "Wildfire risk", new "Street flooding risk".
- **Layer toggles**: "River flood zones" (renamed), "Wildfire hazard", new "Street flooding (heavy rain)" —
  depth classes 10–30 cm / 30–50 cm / > 50 cm, T10 / T100 switch in the legend (default T10).
- **Hex detail card**: "River flooding" (renamed), new "Street flooding":
  - "Effective flooded area: 4% (10-year rain) · 11% (100-year rain)" + "Matters most for ground-floor flats,
    basements and underground parking" when the penalty > 0;
  - "No significant street flooding modelled" (Barcelona, dry);
  - "No street-flooding model outside Barcelona" (AMB).

## Limitations

- Barcelona municipality only; AMB cells get no street-flooding penalty.
- Model from ~2019–2021; storm tanks / SUDS built since are not reflected.
- Flooded sunken roads (Rondas, rail cuttings) count like streets; weight is capped at 1 per m², but
  neighbouring cells are penalised.
- Hazard on the street, not water in a specific flat (floor unknown).

## Files

- `scripts/climate_risk.py`, `scripts/test_climate_risk.py` — full run ~6 min
  (`arch -x86_64 python3 scripts/climate_risk.py`)
- `frontend/public/data/street-flooding.pmtiles`
- `frontend/src/services/climateRisk/climateRisk.ts`
- `frontend/src/components/StreetFloodingLayer/` (layer + legend)
- Changes: `compositeScore.ts`, `compositeData.ts`, `store/index.ts`, `CompositeControls.tsx`,
  `CompositeLayer.tsx`, `HexDetailCard.tsx`, `ClimateLayerControls.tsx`, `FloodZonesLegend.tsx`,
  `layerOrder.ts`, `Map.tsx`, env files

## Definition of Done

1. Unit tests for new logic (≥ 80%): pipeline functions, `streetFloodRisk`, three-factor penalties.
2. Integration test: cell with street-flooding fields → reduced score in `CompositeLayer`.
3. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` — green.
4. Manual check in `npm run dev`: slider (0 → unchanged), layer T10/T100, card in Raval and in an AMB cell.
5. Docs updated: this file (calibration), `022-composite-livability-index.md`, `ARCHITECTURE.md`.
