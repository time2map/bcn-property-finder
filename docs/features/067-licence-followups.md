# 067 — Licence follow-ups (what needs no third party)

Status: implemented. Source: `docs/DATA_LICENSES.md` (sections 1, 7, 8). Follows 066.

## Scope

1. **`areas.geojson`: municipality outlines from ICGC** (item 6). Replaces Opendatasoft `georef-spain-municipio`
   (licence unconfirmed) with ICGC `divisions-administratives-municipis-100000` (CC BY 4.0), which
   `fetch_incasol_sale_catalonia.py` already uses. Same 35 AMB municipalities, same `id` / `name` / `kind`
   (ids are used by `areaAliases.ts` and share links); districts and barris are not touched. The areas join
   (`areaJoin.ts`) votes by building centroids, so slightly different outlines change nothing.
   Test: `frontend/src/services/areasData.test.ts`.
   Checked: same 35 ids and names, median overlap with the old outlines 0.98, area join and ranks identical.
2. **Not verified list** (section 8): ACA WFS (no per-layer licence) and INCASOL (gencat legal notice) settled. SICA 4th
   round (what we use): the XML metadata of the five zips names the Generalitat (Departament de Territori, Habitatge i
   Transició Ecològica) as the competent authority and states no licence; MITECO only publishes. Card, dialog and
   registry credit the Generalitat with the delivery dates and the Generalitat default licence (no more "CC BY 4.0"
   or "© MITECO"). Asking the Generalitat to confirm is a step for a commercial launch.
3. **FGC GTFS licence** (item 5): FGC's open-data portal publishes the same feed we use as dataset `gtfs_zip` under
   CC BY 4.0. The registry says so, the layer is no longer switched off by `VITE_COMMERCIAL_USE`, and the dialog row
   says "drawn from the GTFS feed".
4. **Document**: remove the stale and contradictory parts of `DATA_LICENSES.md` (open items, action plan numbering).

## Research note: RESCCUE street flooding (2026-11-14, no code change)

No licence found. Leads for the letter to the Ajuntament (copy BCASA, CETAQUA): the Avís legal (general reuse with
source credit, otherwise rights reserved) and the RESCCUE Data Management Plan D8.6 (open publication of the Barcelona
urban-drainage simulations planned, "widest re-use possible"). No Barcelona dataset on Zenodo; none of the 23 Atles datasets on Open Data BCN (all CC BY 4.0) is about flooding. Open: RESCCUE Maps,
the bcnroc record of PDISBA'19, INSPIRE catalogues. Details: `DATA_LICENSES.md` 5.2.

Out of scope: letters to Catastro / Ajuntament; FGC lines from OSM (no longer needed).
