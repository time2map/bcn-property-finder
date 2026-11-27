# 050 — Match score: "meets N of M of your conditions"

**Changed by 077 (2026-11-27):** "Boost contrast for this view" removed (store, URL key `cb`, switches, gradient legend);
the fixed 0–100 scale is the only one. 032 is deprecated.

**Changed 2026-11-16:** "Meets N of M" count removed everywhere (2026-11-16): card header, phone peek, hover tooltip. A condition counts as met only at 100, so a building at 92 read "Great match · Meets 1 of 3": the count argued with the band and repeated the rows below. No replacement.

**Changed by 073 (2026-11-16):** the budget caps the score (`budgetCeiling`, card line "Over your budget: at most a partial match"); the band shares count homes (dwellings).

**Status:** Done 2026-11-11. First step of the mass-market UX track (031, 051, 052, 053 follow).
Cheapest change with the largest effect: display only, on top of the existing `computeComposite`.

## Problem

The model (049) says: a home that meets every condition scores 100. The map says something else: the colour
scale is fitted to the visible area (032), so green means "best around here" and the same building changes
colour as you pan. For an expert that is useful contrast; for everyone else it breaks the one rule they expect:
green = fits me. The card then shows five 0–100 bars with no single answer to "is this a match?".

## Decision

- Incomplete data (060): the band, the colour and the tooltip use the max score; the tooltip reads `Good match · ~70`, the card shows the range `52–70` and "Incomplete data".
- The score keeps its definition (mean over the conditions that are on, then risk penalties). What changes is
  how it is **shown**.
- **Absolute colour scale by default**: 0–100 fixed, with four verbal bands. The fitted scale (032) stays as
  an option, **"Boost contrast for this view"**, off by default.
- Every building gets a **match summary**: how many of the user's conditions it meets. A condition is *met*
  when its component scores 100, *partly* when 1–99, *not met* at 0 or no data.
- The card opens with the summary, not with the Catastro facts.

## Spec

**Bands** (on the final score after penalties; ENV `VITE_MATCH_BANDS=85,65,40`):

| Score | Label | Ramp |
|---|---|---|
| ≥ 85 | Great match | `#1a9850` |
| 65–84 | Good match | `#91cf60` |
| 40–64 | Partial match | `#fee08b` |
| < 40 | Poor match | `#fc8d59` → `#d73027` |

**Legend** (panel): four swatches with the labels, instead of the min/max gradient. With "Boost contrast" on,
the current gradient + "relative to the visible area" line comes back.

**Card header** (replaces the first lines of `BuildingCard`):

```
Great match · 92
Meets 4 of 4 of your conditions
✓ Quiet (57 dB, under your 65)   ✓ Everyday services (all 10 within 10 min)
✓ Centre (12 of 13 places within 30 min)   ✓ Budget (€3,325/m², under your €4,000)
▼ Risk: −6 points, river flooding (100-year zone)
```

Partly-met rows use "◐" and the shortfall ("◐ Budget — €4,600/m², 15 % over your €4,000"); not met "✗";
no data "– no data". The existing per-condition blocks move below the header unchanged.

**Hover tooltip** on buildings (desktop): "Good match · 78 — meets 3 of 4". New, small, no card.

**Best zones** are unchanged (they rank by score, not by band).

## Implementation

- `services/match/matchSummary.ts` (pure): `matchBand(score, bands)`, `conditionStatus(component) →
  'met' | 'partly' | 'missed' | 'nodata'`, `matchSummary(result: CompositeResult, weightsOn) → { met, total,
  rows: { id, status, text }[] }`. Texts reuse the sentences already built for the card (049).
- `scoreRamp.ts`: `buildStateColorForRange(0, 100)` when contrast boost is off; `fitScoreRange` only when on.
- Store: `contrastBoost: boolean` (`bcn_contrast_boost`, default false). `compositeColorRange` is set to
  `[0, 100]` when off.
- `BuildingsLayer.recolor()`: skip the fit when boost is off.
- `CompositeLegend.tsx`: bands by default; gradient when boost is on.
- `CompositeControls.tsx`: switch "Boost contrast for this view" under the legend.
- `BuildingCard.tsx`: `MatchHeader` component at the top (`components/BuildingCard/MatchHeader.tsx`).
- `BuildingsLayer`: hover tooltip via a MapLibre popup on `mousemove`, debounced; hidden on touch devices.
- ENV: `VITE_MATCH_BANDS` (default `85,65,40`). Add to `.env.local.example`, `.env.production`,
  `ARCHITECTURE.md`.
- Docs: `032-viewport-color-scale.md` gets a status line: "default off since 050; available as Boost contrast".

## Tests

- `matchSummary.test.ts`: bands at the edges; met / partly / missed / nodata; counts only the conditions that
  are on; penalty line present only when > 0; texts for each condition.
- `scoreRamp.test.ts`: existing fit tests unchanged; new: range is `[0, 100]` with boost off.
- `CompositeLegend.test.tsx`: bands by default; gradient when boost is on.
- `BuildingCard.test.tsx`: header renders "Meets 3 of 4" for a prepared `CompositeResult`.
- Integration: toggle boost → `setPaintProperty` called with the fitted stops; toggle back → fixed stops.

## Definition of Done

Per `CLAUDE.md`. Manual check: pan across Eixample → Nou Barris with boost off, colours stay put; a building
with all conditions at 100 and no risk is `#1a9850` anywhere on the map.

## Decisions taken while building (2026-11-11)

- Band thresholds are not in the legend copy (labels only). The 0–100 number stays in the card header, next to
  the band label.
- The map stays a smooth 0–100 gradient; the four bands are named in the legend and the card, not drawn as steps.
- A condition that is on but has no data reads "– no data", counts as not met in "Meets N of M" and stays in M
  (consistent with the model: no data = 0).
- The hover tooltip works from zoom 14 (footprints), appears after 60 ms of rest and is off on `(hover: none)`.
- Header rows are compact single lines (`matchText.ts`); the full sentences stay in the per-condition blocks.
- The "before risk penalties" line is replaced by the risk line in the header.
- No condition on (061): the map is neutral — no fill, no hatch, no tooltip or card — and the editor says "No conditions yet. Add one below and the map will colour in."; see `061-no-conditions-neutral-map.md`.

## Follow-up: 070 (2026-11-15)

The score line now reads "83 of 100 · Good match" under the label "Match with your conditions", and an award line
("Top 10% / Top 20% of homes in the barri / the city") follows the risk line where the building stands out. See
`070-building-rank-in-barri-and-city.md`.
