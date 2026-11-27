# 061 — No conditions: a neutral map with a hint

## Problem

With no condition on, the score has nothing to average and comes out as 0, so every home and area is painted red
("Poor match"). By everyday logic, with no requirements every place fits, and nothing should be judged.

## Decision

When no condition is on (all weights 0), the map is **neutral**:

- No fill on buildings and areas, no hatch (the incomplete-data hatch of 060 has nothing to say either).
- Buildings cannot be hovered or clicked (no tooltip, no card; an open card closes) — the same as with
  "Show match colours" off.
- A hint says what to do.
  - Conditions editor: it already says "No conditions yet. Add one below and the map will colour in."; the
    "Homes by match" bar is simply not shown.
  - "Your areas" list: "Add a condition to rank the areas."
  - The "Hatched = incomplete data" legend note is not shown either.
- "Avoid flood and wildfire risk" is a condition: on its own it colours the map by risk (every home starts at 100
  and loses points to flood / wildfire risk). The map is neutral only when the risks are off too.

Not chosen: all green ("everything fits" — reads like a verdict, and the ranking turns into noise) and a mid colour
(reads like a score of 50).

## Implementation

- `hasConditions(weights, riskStrengths)` in `services/composite/compositeScore.ts`.
- `BuildingsLayer`, `AreasLayer`: layers visible = "Show match colours" on **and** a condition on.
- `MatchBar`, `AreasList`, `MatchColoursSwitch`: no bar / the hint / no hatch note.

## Affects existing docs

- `050-match-score.md` — "No conditions are on".
- `051-ranked-areas-list.md` — empty state.

## Definition of Done

- [x] Unit tests: `hasConditions`; layers hidden / shown; hints in `MatchBar` and `AreasList`
- [x] `npm test`, `npm run lint`, `npm run typecheck`
- [x] Manual check via `npm run dev`
- [x] 050 and 051 updated
