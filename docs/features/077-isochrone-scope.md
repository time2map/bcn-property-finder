# 077 — The isochrone sets the area; Boost contrast removed

**Changed 2026-11-27:** with an isochrone the colours are stretched red → green over what is inside it (the
buildings over their scores, the areas over their means), the legend reads "Worse → Better", "Colours stretched over
your commute zone" (in the panel under "Show match colours" and on the phone map). Without an isochrone: 0–100 and
the bands, as below. The isochrone is set by the Daily trip condition (078).

**Status:** Done 2026-11-27. Port of `backup/050-isochrone-scope` (commit dc4df92, never merged: the code around it was
rewritten by 050-match-score, 051 areas and 058 the score worker; the number 050 is taken by the match score).

## Problem

With an isochrone drawn the user only cares about the commute zone, but buildings, area colours, the "Your areas"
list and best zones still cover the whole city. Buildings outside the isochrone make the map confusing.

User story: *As someone who commutes, once I set my workplace I want the map to rank only the homes I can reach.*

**Boost contrast** (032, kept as an option by 050) is removed: the colours are always on the fixed 0–100 scale, so
a green means the same anywhere, with or without an isochrone.

## Decision

**Isochrone on** = `features.isochrone` and an isochrone is drawn (`resultPolygon`). Without one nothing changes.

**Area** = the isochrone minus the exclusion zones (`useEffectiveArea`): the same area the isochrone mask shows.

| | No isochrone (unchanged) | Isochrone |
|---|---|---|
| Buildings (z13+) | all | only those whose centroid is inside the area; the others are transparent and ignore hover, click and tap |
| Areas (below z13) and "Your areas" | from all buildings | from the buildings inside only; an area with none inside is transparent, with no tooltip or click |
| Colours | fixed 0–100, four bands | stretched over the buildings inside (`fitScoreRange`, 2 % trim, at least 20 points) and, for the areas, over their means; not refitted on pan; legend "Worse → Better" |
| Best zones | visible area, follow the map | the whole isochrone; pan / zoom don't change them; a new isochrone or exclusion zone recomputes them fresh |
| "Inside commute zone, outside exclusion zones" | as before | hidden: the restriction is always on |
| Nothing fits | `No zones fit this view — zoom out` / `best.none` | `No zones fit — the commute zone is too small` / `best.noneCommute` |
| Building card | — | closes when its building ends up outside |

The start ranks of the area view (`area-start.json`, 058) are city-wide, so they are skipped when an isochrone is
already there at start (from the isochrone cache).

## Implementation

- `services/buildings/inArea.ts` — `inArea(lng, lat, area)`: `Uint8Array`, 1 = centroid inside. Each polygon part
  gets its outer-ring bbox, so `booleanPointInPolygon` skips far-away parts; holes (exclusions inside the isochrone)
  count as outside.
- `hooks/useEffectiveArea.ts` — null while `features.isochrone` is off.
- `BuildingsLayer`:
  - with an area, the building positions load (`loadBuildings`, 058), then the mask is computed;
  - feature state `out` on buildings outside the area (only changed ones are set); dot and fill opacity 0 and no
    hatch when `out`;
  - hover, tooltip, click and the near tap skip `out` buildings (MapLibre hit-tests them at opacity 0 too);
  - `rankAreas` runs on the scores and the mask: the area column is NaN for buildings outside;
  - the card closes when its building is outside.
- `AreasLayer` — an area missing from the ranks gets `score: null` (transparent); hover and click skip it.
- `useBestZones` — with an isochrone, the view is the whole world and `allowedCells(isochrone, exclusions)` is
  always applied. `bestZonesBounds` stays the on/off flag.
- `BestZones`, `BestAreasControls` — `moveend` doesn't move the zones; the checkbox is hidden; the empty-state text
  depends on the mode.
- Boost contrast removed: `contrastBoost`, `compositeColorRange`, the `cb` URL key, `fitScoreRange`, the switch in
  Advanced settings and the old panel, the gradient legend, `VITE_SCORE_SCALE_TRIM_PCT` / `_MIN_SPAN`.
  032 is deprecated.

No new environment variables.

## Not doing

- Fit the map to the isochrone. Add if the zones end up off screen and it gets in the way.
- A switch to turn the isochrone off: the app has none today.

## Definition of Done

- [x] Unit tests: `inArea`; `BuildingsLayer` (`out` state, hover / click / tap ignored, card closes, ranks from the
  buildings inside); `AreasLayer` (an area without a rank is cleared and inert); `useBestZones` (world view and
  restriction with an isochrone); `BestZones` / `BestAreasControls` (no checkbox, empty-state text);
  `useStartAreaRanks` (skipped with an isochrone). Coverage of the touched files: `BuildingsLayer` 97% statements /
  88% branches, `AreasLayer` 97 / 90, `BestZones` 100 / 94, `BestAreasControls` 100 / 95, `useBestZones` 98 / 95,
  `inArea` 100.
- [x] Integration test: `BuildingsLayer` + `AreasList` with an isochrone list only the areas with homes inside.
- [x] `npm test` (1452), `npm run lint`, `npm run typecheck` — green.
- [x] Manual (`npm run dev`, headless Chrome, Work at Plaça Catalunya, 15 min): z12 colours only the areas with
  homes inside and "Your areas" lists 11 barris and no metro area; z15 draws only the buildings inside, a building
  outside gets no pointer and no card, one inside opens its card; the mask takes 15–110 ms; Advanced has no Boost
  contrast.

## Known gaps

- "Homes by match" (panel) and the rank awards of the card ("Top 10% of homes in Barcelona", 070) are still
  city-wide. Scope them to the commute zone if they read as contradicting the map.
