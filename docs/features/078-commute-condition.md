# 078 — Daily trip as a condition

**Status:** Done 2026-11-27.

## Problem

The commute isochrone (`VITE_FEATURE_ISOCHRONE`) lives apart from "Your conditions": a "Commute from work" slider
block at the top of the panel, a workplace set by the first click on the map (any click, even on a building), and
no way to remove it. The other criteria are sentences with tappable words, added with "+ …" chips and removed with ×.

User story: *As someone who travels to the same place every day (work, university, a school), I want "how far from
that place" to be one of my conditions, set and removed like the others, starting from the centre.*

The place isn't always work, so the UI says neither "work" nor "workplace" (the code keeps `workplace`).

## Decision

- A **Daily trip** row in the conditions editor: "**the centre** within **30 min** by public transport".
  - Not on at first: added with **+ Daily trip**, with the default place (`VITE_COMMUTE_DEFAULT_PLACE`, `placa_cat`)
    and the default time (`VITE_COMMUTE_DEFAULT_MINUTES`, 30; it was 60).
  - The time word: 15 / 30 / 45 / 60 min (`VITE_QUIZ_COMMUTE_OPTIONS`) and Custom… (15–120, step 5).
  - The place word: "the centre (Plaça de Catalunya)" or **Pick on the map**. Picking: crosshair cursor, the next
    click on the map sets the place, Esc cancels. The marker can be dragged as before. A place that is not a
    landmark reads "your spot"; the map marker shows the same name instead of "Work".
  - × removes it: no workplace, no isochrone, the whole city again.
- It is a filter, not a score: not in `CompositeWeights`, the match score and the area ranks don't change; it only
  sets the commute zone of 077. On = a workplace is set. Numbered like the other rows (the number is the order).
- The old "Commute from work" block, its info modal and the first-click-sets-workplace are removed.
- Not in the shareable link (the workplace never was: a home or work address shouldn't travel in a URL).

## Implementation

- `services/conditionOptions.ts` — `ConditionKey` gets `commute` (not a weight); `isOn` / `activeConditions` take
  `commute: boolean`; `COMMUTE_OPTIONS`.
- `store` — `setWorkplace(null)` also clears `resultPolygon`; `commutePicking` + setter; default minutes from env.
- `components/Conditions/ConditionsEditor.tsx`, `SentenceRow.tsx` — the row and its two words.
- `components/Map/useCommutePick.ts` — the pick-on-the-map click, cursor and Esc.
- `services/urlConfig.ts` — `commute` is never written to `on:`.
- Locales: `conditions:short.commute`, `conditions:add.commute`, `editor:sentence.commute*` (en, es, ca).

## Not doing

- Address search for the place. Add if picking on the map turns out too fiddly on a phone.
- Commute in the shareable link.

## Definition of Done

- [x] Unit tests: `activeConditions` with commute; the editor row (add with defaults, words, ×); picking on the map
  (`useCommutePick`; buildings and areas ignore that click); `setWorkplace(null)`; the link never carries commute;
  the phone header names it. Coverage: `useCommutePick` 100 % statements, `ConditionsEditor` 98, `SentenceRow` 96,
  `conditionOptions` 99.
- [x] Integration test (`dailyTrip.integration.test.tsx`): + Daily trip → isochrone of the centre, 30 min (OTP mocked)
  → zone set; × → zone gone.
- [x] `npm test` (1473), `npm run lint`, `npm run typecheck` — green.
- [x] Manual (`npm run dev`, headless Chrome, OTP on): no "Commute from work" block; + Daily trip → "The centre within
  30 min by public transport", marker "Plaça de Catalunya", areas stretched red → green, legend "Worse → Better";
  15 min → the zone shrinks; Pick on the map → crosshair, a click sets "Your spot" (no building card); × → the chip
  is back, no marker.

## Known gaps

- On a phone the sheet covers the map while picking: the person has to lower it first.
- The Daily trip marker sits on the Plaça de Catalunya landmark label at the default place.
