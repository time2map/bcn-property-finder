# Feature 039 — Residential mask for the H3 grid

## Goal

Show Livability hexes only where people actually live. Today the grid covers every cell of
`areas.geojson` (6244 cells), including Collserola, Montjuïc, Zona Franca / the port, the airport,
the Llobregat delta farmland and the Garraf forest — places nobody can rent or buy a flat.

## Why not `landuse=residential`

OSM residential landuse is badly mapped in Barcelona: Gràcia, Sants, Sarrià, Barceloneta,
L'Hospitalet and Badalona have **0%** residential coverage, Eixample 31%. Keeping only residential
cells would drop real neighbourhoods. Buildings in the extract are incomplete too (18.6k for all of
AMB).

## Approach — inverse mask

Drop a cell when more than `NONRES_MAX_SHARE` (default 0.7) of its **land** area is covered by
**clearly non-residential** OSM polygons. Untagged dense city stays in.

The share is measured against the part of the hex inside `areas.geojson` (municipal boundaries follow
the coastline): the sea is no OSM polygon, so a half-sea port cell would otherwise look half
residential and survive.

Non-residential = `landuse` forest, farmland, meadow, industrial, port, railway, cemetery, military,
quarry, vineyard, orchard, allotments, greenhouse_horticulture, landfill, brownfield, greenfield,
farmyard, reservoir, basin, salt_pond, plant_nursery, construction; `natural` wood, scrub, heath,
grassland, water, wetland, beach, bare_rock, sand; `leisure` park, nature_reserve, golf_course,
stadium, marina; `aeroway=aerodrome`.

Measured on the real grid: residential neighbourhoods 0–0.09 non-residential share; Zona Franca,
port, Montjuïc, airport, delta 0.94–1.0. **2635 of 6244 cells remain** (livability grid 4.8 → 2.0 MB,
city-core grid 3.7 → 1.6 MB). Values of the kept cells are unchanged.

Done offline in `scripts/prepare-livability-grid.py` (`residential_cells`) right after the coverage
cells are built, so every consumer (composite layer, hex card, best zones, city-core grid) gets the
masked grid. No frontend change. INCASOL price p5/p95 bounds are now computed over residential cells
only (p95 5816 → 6224 €/m²; p5 unchanged at 2088).

Known limit: empty land with no OSM polygon at all stays visible. Upgrade path if needed: Catastro
INSPIRE buildings (`currentUse = residential`).

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `NONRES_MAX_SHARE` | 0.7 | pipeline |

## Regenerate

```
arch -x86_64 .venv-livability/bin/python scripts/prepare-livability-grid.py
python3 scripts/prepare-city-core-access.py
```

## Definition of Done

- `scripts/test_residential_mask.py` green — unit tests for `nonres_share` + a check on the generated
  grid (known neighbourhoods kept, known non-residential land dropped).
- Grid regenerated; Montjuïc, Collserola, Zona Franca, airport have no hexes; Gràcia, Sants,
  Eixample, Barceloneta, L'Hospitalet do.
- `npm test`, `npm run lint`, `npm run typecheck` green; checked in `npm run dev`.
