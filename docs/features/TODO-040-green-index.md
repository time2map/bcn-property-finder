# TODO-040 — Green index (tree canopy around home)

## Goal

Add a **Greenery** component to the Livability Index: the share of tree canopy within 300 m of a cell.

User story: *As someone relocating to Barcelona (often working from home), I want leafy areas to score
higher, so I can shortlist streets with shade and greenery around the flat, not just a park somewhere nearby.*

## Why

- ISGlobal 3-30-300 study in Barcelona (Environmental Research 215, 2022): **residential surrounding
  greenness (300 m)** was associated with better mental health and less medication use. Major-park
  access and tree window view were not.
- Summer heat: shade trees matter in Barcelona.
- Satellite data covers the whole grid (Barcelona + AMB) uniformly, unlike noise (Barcelona only).
- SEO: "greenest neighborhoods barcelona", similar to "quietest neighborhoods" in `seo/keywords.md`.
- Reference: [Green City Index](https://green-city-index.org/en/) (Sentinel-2, 10 m, CC BY 4.0, no
  documented download/API, so use it only as a visual sanity check).

## Pre-analysis (2026-10-22, ESA WorldCover 2021, 679 Barcelona cells with `lden`)

| Spearman | Value |
|---|---|
| `lden` × tree share 300 m | +0.19 |
| `lden` × any vegetation 300 m | +0.26 |
| `walk_park` × tree share 300 m | +0.16 |
| `walk` × any vegetation 300 m | −0.52 |

| Tree share 300 m quintile | Mean Lden | Cells > 65 dB |
|---|---|---|
| 1 (0–5%) | 51.5 | 1% |
| 2 (5–10%) | 53.1 | 2% |
| 3 (10–16%) | 55.9 | 9% |
| 4 (16–27%) | 57.0 | 13% |
| 5 (27–87%) | 53.8 | 4% |

Tree share 300 m: p10 3% · p50 12% · p90 37% · max 87%.

Conclusions:
- **Noise:** no double counting. Greener cells are slightly *louder*, because trees line the big avenues
  (Eixample, Diagonal, Gran Via, Rondas) while the old town is treeless but quiet. No decorrelation needed.
- **`walk_park`:** weak overlap (+0.16). Keep both: park access ≠ canopy around home.
- **Walkability (−0.52):** green areas are peripheral. This is a genuine trade-off that the index should show.
- **Wildfire penalty:** Collserola edge = high greenery + fire penalty. Explain this in the ℹ modal.
- **Heat (LST):** expected to correlate strongly with greenery (not measured). Don't add as a separate
  component, because that would double count.

## Data source

| Option | Notes |
|---|---|
| **ESA WorldCover 2021 v200, 10 m** (MVP) | CC BY 4.0. Class 10 = tree cover. One `gdal_translate -projwin` over the remote COG (`/vsicurl/…/ESA_WorldCover_10m_2021_v200_N39E000_Map.tif`), ~8 s. Static 2021; under-detects street trees in narrow streets. |
| Sentinel-2 NDVI, summer median composite | Later, if WorldCover under-scores Eixample / Gràcia. Captures all vegetation incl. courtyards. Needs STAC + cloud mask + compositing and new deps. |
| Open Data BCN `cobertura-vegetal-ndvi` (2014), `arbrat-viari` | Barcelona only, so it doesn't fit the AMB grid. |

## Formulas

### Pipeline (`prepare-livability-grid.py`)

| Field | Meaning |
|---|---|
| `tree_300m` | Share (0–1) of WorldCover class-10 pixels within `GREEN_RADIUS_M` of the cell centre |

### Frontend

```
greenScore = min(1, tree_300m / GREEN_TARGET_SHARE) × 100
```

`GREEN_TARGET_SHARE` = 0.30 (the "30% canopy" from 3-30-300). With it, p50 → 40, p90 → 100.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `GREEN_RADIUS_M` | 300 | pipeline |
| `VITE_GREEN_TARGET_SHARE` | 0.30 | frontend |
| `VITE_WEIGHT_GREEN` (default slider) | tbd | frontend |

## UI

- Livability Index panel: new row **Greenery** (slider 0–10).
- Hex detail card: "Tree canopy within 300 m: 18% (target 30%)".
- ℹ modal: what is measured, source + year, limitations (street trees under-detected; green ≠ quiet;
  forest edge also carries wildfire penalty).
- No separate map layer in MVP.

## Open questions

- WorldCover vs Sentinel-2 NDVI: validate WorldCover visually against Green City Index in Eixample / Gràcia first.
- Default weight.

## Files (expected)

- `scripts/prepare-livability-grid.py` + test
- `compositeScore.ts`, `compositeData.ts`, `livabilityData.ts`, `store/index.ts`, `CompositeControls.tsx`,
  `HexDetailCard.tsx`, info modal
- Docs: this file, `022-composite-livability-index.md`, `ARCHITECTURE.md`

## Definition of Done

Standard (see `CLAUDE.md`).
