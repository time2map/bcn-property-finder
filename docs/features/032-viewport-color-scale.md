# 032 — Colour scale fitted to the visible area

**Superseded by TODO-046 (2026-11-04):** computed per residential building; the H3 hex version described below was removed.

**Status:** Done 2026-10-27. Default off since 050 (2026-11-11); available as "Boost contrast for this view".

## Problem

The Livability colour ramp spans the Score range slider, 0–100 by default. Real scores cluster in a much
narrower band, so the map looks flat: there is little contrast between neighbouring areas.

## Decision

- **Fit to the view.** The ramp is stretched over the composite scores of the hexes in the visible part of the
  map: the viewport minus the left filter panel and the hex detail card, the same area best zones use (038).
  It is recomputed when the map stops moving (`moveend`) and when the scores change (weights, landmarks,
  risks). Colours don't change while the map moves. With no hex in view the previous scale stays.
- **Linear.** The lowest score in view is red and the highest is green, linear in between.
  - **Trim:** the extreme `VITE_SCORE_SCALE_TRIM_PCT` (2%) of visible hexes on each side don't stretch the
    scale, so one outlier hex can't take the whole green end. Trimmed hexes get the end colours.
  - **Minimum span:** if the trimmed range is narrower than `VITE_SCORE_SCALE_MIN_SPAN` (20 points), it is
    widened around its middle (kept inside 0–100). Otherwise a 2-point difference in a zoomed-in area would
    read as "bad" vs "great".
- **Smooth recolouring when the map moves** (zoom, pan), like wikibarrio.es: a crossfade of about 1 s.
  Changing a weight or switching a criterion on/off refits the scale at once, without animation: the
  colours change immediately anyway. A second fill layer keeps the old
  colours and fades out while the main layer with the new colours fades in. The ramp itself is not animated:
  MapLibre doesn't transition data-driven paint, and changing the expression on every frame would re-tile
  the GeoJSON source each time.
- **Score range slider removed**, with its filter and saved value. All hexes are shown; best zones pick from
  all visible hexes.
- **Legend:** the real range of the current view (e.g. `58 … 84`) and the line *Colours relative to the
  visible area*.
- **Hex card:** the composite score is coloured on the same scale as the map; the number stays absolute.
  Sub-scores keep their fixed 0–100 colours.

User story: *As someone comparing neighbourhoods, I want the colours to show differences between the places I
am looking at, not a city-wide average, so I can tell the better areas apart at any zoom.*

## Not doing

- A switch to a fixed scale (wikibarrio has *Auto / Spain*). Add it if users ask.
- Colouring by rank (quantiles). wikibarrio's stops look quantile-based around the local median; try it if
  the linear scale still looks flat.

## Implementation

- `components/CompositeLayer/scoreRamp.ts` — `fitScoreRange(scores, trimPct, minSpan)`: whole-number
  `[min, max]` after trimming, widened to `minSpan` inside 0–100; `null` for no hexes.
- `components/Map/visibleBounds.ts` — the visible part of the map (moved from `BestZones.tsx`).
- `components/CompositeLayer/CompositeLayer.tsx`
  - two fill layers on the source, `composite-fill` and `composite-fill-b`, both with
    `fill-opacity-transition` of 1 s;
  - `recolor()`: hexes whose centre is in view → `fitScoreRange` → the hidden layer gets the new colours
    and fades in, the shown one fades out, they swap roles. The crossfade runs only on `moveend`;
    after a score rebuild (weights, criteria on/off, landmarks, risks) and on first load the scale is
    refitted instantly. An unchanged or empty range does nothing;
  - hover and click stay on `composite-fill`: MapLibre hit-tests it at opacity 0 too.
- Store: `compositeColorRange` (not persisted) replaces `compositeScoreRange`.
- `CompositeLegend` reads it and adds *Colours relative to the visible area*. `CompositeControls` lost the
  slider.
- `HexDetailCard`: the composite score is coloured on the same scale; its bar is now absolute (score / 100).
- Best zones: `scoreRange` removed from `findZoneCells` and `useBestZones`.

Checked in the app: the whole city goes from 0–100 to about 22–68. Zooming in on Poblenou gives
32–54, and a deep zoom on the Eixample 36–56 (minimum span). The crossfade shows the old colours right
after the map stops, a mix at ~0.5 s and the new ones by ~1.3 s, with no flash of stale colours.

## Definition of Done

- [x] Unit tests:
  - `fitScoreRange`: min–max, outlier trim, minimum span, 0–100 clamp, empty;
  - `CompositeLayer`:
    - fit on load;
    - crossfade on `moveend` and role swap back;
    - a weight change refits at once, without a crossfade;
    - empty view keeps the scale;
    - no score filter;
    - both layers hidden on toggle;
  - `CompositeControls`: legend range and caption, no slider;
  - `HexDetailCard`: score colour on the store scale;
  - best zones tests without the score range.

  Coverage of the touched files is 94% statements and 87% branches.
- [x] Integration test: `CompositeLayer` and `CompositeLegend`; a pan updates the legend range.
- [x] `npm test` (572), `npm run lint`, `npm run typecheck` — green.
- [x] Manual (`npm run dev` + Playwright):
  - city, zoomed in and deep zoom;
  - crossfade;
  - legend values;
  - card colour;
  - hex hover and click with either layer in front;
  - best zones.
