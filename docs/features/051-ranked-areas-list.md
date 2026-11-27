# 051 — Ranked list of areas ("Your areas") and area view at low zoom

**Changed by 073 (2026-11-16):** shares and means count homes (dwellings); `n` is homes, `buildings` the count used for `VITE_AREA_MIN_BUILDINGS`.

**Status:** Implemented 2026-11-12, checked in the browser (list for the Family profile, click → zoom, area fill below
z13); on in production (flag `VITE_FEATURE_AREAS`). Since 052 the list has two sections, Barcelona and Metro area.
Depends on 050 (match bands). Part of the mass-market UX track.

## Problem

The only output of the public map is colour on buildings and up to five best zones. People who don't know
Barcelona cannot read 174k dots at zoom 12 and have no list to start from. Every comparable product (Teleport,
NYT quiz, Nomad List, Rightmove) answers with a **ranked list** next to the map. At the city zoom the dots
are also visually noisy: an area summary reads better there, and the building detail from z14 stays.

## Decision

- A **ranked list of areas** (73 barris + the AMB municipalities) computed from the building scores already in
  the store: for each area, the share of its buildings in the "Great" + "Good" bands and the mean score.
- At **zoom < 13** the map shows the areas (choropleth from the same aggregation) instead of the dots; from
  z13 the buildings as now. This is a display aggregation, not a scoring unit: an area has no score of its own
  in the card (DEPRECATED-027 stays deprecated).
- The list is a panel, not a page: top 10 by default, "Show all", click → fly to the area and outline it.

## User story

*As someone relocating, I want a short list of the areas that fit my answers, so I know where to start
looking, and then zoom in to see the buildings.*

## Spec

**Ranking** (`services/areas/areaRank.ts`, pure): for every building row, `area` column → area id. Per area:
`n`, `mean`, `shareGood` (score ≥ good band), `shareGreat`. Rank by `shareGood`, tie by `mean`. Areas with
fewer than `VITE_AREA_MIN_BUILDINGS` (default 50) are listed at the end as "too few homes to rank".

**List item**: rank, area name, kind (barri · district / municipality), `shareGood` as "62 % of homes are a
good match", a mini bar, and the three strongest conditions as chips ("quiet", "on foot", "budget") — the
conditions where the area's mean component is highest (needs per-component means: computed in the same pass).

**Area view (z < 13)**: `areas.geojson` (already in `public/data/`, used by the exclusion picker) as a fill layer coloured by the area's
mean score with the 050 bands; label = name. Hover shows "62 % good match · 1,240 homes". Click = same as the
list click. The building dots are hidden below z13; the fill is hidden from z13.

**Where the list lives**: a tab in the filter panel ("Settings" / "Your areas"), on desktop and inside the bottom
bottom sheet on a phone (062: a tap on an area drops the sheet to peek with the area's name and a "Back to the list"
button). The list updates with the settings (same debounce as rescoring).

## Implementation

- **Join key (as built).** `buildings-meta.json` areas use the city barri code and the INE municipality code;
  `areas.geojson` has neither (ids are `barri-<district><nn>` and `muni-<slug>`), and the raw sources of
  `scripts/prepare-areas-data.sh` are not in git. Names are not used. `services/areas/areaJoin.ts` joins by
  position instead: a sample of 15 building centroids of each area votes for the polygon (of the same kind) they
  stand in, with a bbox prefilter; cached by `areaJoinLoader.ts`. Areas with no polygon (the metro list has more
  municipalities than the polygon file) are ranked in the list but not coloured on the map and not clickable.
  If the script later carries `code` / `ine`, `joinAreas` can be replaced by a plain lookup.

- `services/areas/areaRank.ts`: `rankAreas(scores, areaCol, areas, components, active, bands, min) → AreaRank[]`.
  `scoreAll(..., withComponents)` returns a `Uint8Array` per condition (255 = no data); `BuildingsLayer` passes it
  when the flag is on.
- Incomplete data (060): the shares and means are over the max scores; an area with more than `VITE_INCOMPLETE_AREA_MIN_SHARE` of homes with a range (`gapShare`, `incomplete`) gets the wide hatch.
- Store: `areaRanks: AreaRank[] | null`, set by `BuildingsLayer` after each rescoring.
- `components/AreasList/AreasList.tsx`, `AreaRow.tsx`; `components/AreasLayer/AreasLayer.tsx` (geojson source
  with the area index as feature id; the mean score as feature state `score`, so it uses the same ramp and
  follows Boost contrast; fill, outline and label with `maxzoom` = `VITE_AREA_VIEW_MAX_ZOOM`; hover popup;
  click). `layerOrder.ts` has `areas-fill`, `areas-hatch` (060), `areas-line`, `areas-label`; the stale `barrio-boundaries-*` ids are
  gone. The dot layer of the buildings gets `minzoom` = the same value.
- `FilterPanel.tsx`: Mantine `Tabs` (Settings / Your areas) when the flag is on.
- Fly-to and outline: a click selects the area through the search store (`areaSelect.ts`), so `SearchLayer`
  draws the same blue outline as for a searched area; no extra layer.
- Flag `VITE_FEATURE_AREAS` (on in `.env.test`, off in production). ENV: `VITE_AREA_MIN_BUILDINGS=50`,
  `VITE_AREA_VIEW_MAX_ZOOM=13`.

## Tests

- `areaRank.test.ts`: aggregation, ranking order, ties, small areas last, chips = top 3 components.
- `buildingScore.test.ts`: `scoreAll(withComponents)` returns per-component arrays consistent with
  `scoreBuilding`.
- `AreasList.test.tsx`: renders top 10, "Show all", click calls the fly-to handler with the area id.
- `AreasLayer.test.tsx` (with `fakeVectorMap`): layer added with the band colours; visibility flips at z13.
- Performance: one aggregation pass over 174k rows ≤ 30 ms (assert in a test with a timing budget).

## Definition of Done

Per `CLAUDE.md`. Manual: with the "Family" preset the list shows plausible barris; clicking one zooms to it;
zooming out past z13 shows the area fill.

## Open questions

- Municipalities and barris in one list, or two sections? Proposed: one list, kind as a chip.
- Should the list respect the best-zones restriction (commute zone) when those flags are on? Proposed: yes. Not
  done in the first pass: the list ranks all areas.

- No condition on (061): the list shows "Add a condition to rank the areas." instead of a ranking of zeros.
