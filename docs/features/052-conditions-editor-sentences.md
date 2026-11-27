# 052 — Conditions editor as sentences; one expert layer at a time

**Status:** Implemented 2026-11-12, checked in the browser at 375 px and 1440 px; on in production with the
onboarding flag (`VITE_FEATURE_ONBOARDING`). Depends on 031 and 050 (bands). Part of the mass-market UX track.
See "As built" at the end for where the build differs from the spec below.

**Note (2026-11-12):** the sentence rows and word pickers (`SentenceRow`, `WordPicker`, option sets,
`riskPreset`) are now built in **031**, where the onboarding uses the same component. 052 moves them into the
panel for good and adds what is left: the old controls are removed, the **Map layers** segmented control,
**Best areas** (More / Fewer) and an **Advanced** section (risk strengths, full lists, contrast boost, search
URL). The mock-up ("Mad-libs Onboarding", screen 3) shows the target layout.

Open copy issue found in 031: `noiseAnchor` (`services/buildings/conditions.ts`; 47 / 57 / 67 dB → courtyard / calm /
busy / main road) does not match the picker words (50 / 58 / 65 dB → a courtyard / a calm street / normal city
noise). Decide one set of words when the card and the panel are aligned.

## Problem

The panel is a settings form: six rows of checkbox + slider + gear + sentence, three risk rows with 1–10
sliders labelled "Matters / Important", four map-layer switches each with its own legend, and a floating
best-zones bar with "top 15 %" and an Idealista URL field. The sentences introduced in 049 are the best part
of it, but they sit *under* the sliders instead of *being* the control. The expert layers (noise, three
climate layers) compete with the main controls for the same space.

## Decision

- **The sentence is the control.** Each condition is one line of plain English with tappable words that
  open a small picker: *"No louder than [a busy street · 65 dB] outside my window"*, *"[Everyday services] within
  [10 min] on foot"*, *"[My places] within [30 min] on foot"*, *"A [70 m²] flat costs up to [€280,000] on average"*,
  *"Residents rate the barri at least [7.5]"*, *"Built in [any era]"*.
- Pickers offer **verbal steps**, not continuous sliders: the same option sets as the quiz (031) plus
  "Custom…" which reveals the existing slider for power users.
- **Risks** become one line: *"Avoid [flood and wildfire risk]"* with a picker: Avoid (strength 5) · Strongly
  avoid (8) · Don't care (0) · Custom (three sliders).
- **Expert layers** move under a "Map layers" segmented control: None · Noise · River floods · Street
  flooding · Wildfire. One at a time, one legend. "None" by default.
- **Best zones**: the bar says "Show my best areas" → zones appear; controls are "More areas / Fewer areas"
  (steps of `TOP_PCT_STEPS`) instead of "top X %". The Idealista URL field moves into a "Search filters"
  popover with one sentence of help; unchanged otherwise.
- Nothing changes in the model or the store values; this is a new face on `CompositeControls`,
  `ClimateLayerControls`, the noise switch and `BestZones`.

## Spec

**Sentence rows** (`SentenceRow`): off = greyed sentence with a leading checkbox; on = full colour, words in
brand colour with a dotted underline; tapping a word opens a Mantine `Popover` with 3–4 options + "Custom…".
Picker options per condition: see 031 (same ENV `VITE_QUIZ_*`). The current value is highlighted even when
it is not one of the steps (then "Custom" is highlighted with the value).

**Services / places / eras** pickers: the existing modals, opened from the bracketed word ("Everyday
services" → "My 3 services" once edited).

**Risk line**: `conditionStatus`-style mapping both ways: strengths all equal to 5 → "Avoid"; all 8 →
"Strongly avoid"; all 0 → "Don't care"; anything else → "Custom". Choosing an option sets all three.

**Map layers**: `SegmentedControl`, full width, under the conditions; legend of the chosen layer only; the
info buttons stay. Store keeps the four booleans; the control sets exactly one true.

**Order in the panel** (desktop and the phone's bottom sheet, 062): Your conditions (chip row from 031 + "Change") →
sentence rows → risk line → legend (050) → Map layers → attribution.

## Implementation

- `components/FilterPanel/SentenceRow.tsx`, `WordPicker.tsx` (options, custom slider slot).
- `services/conditionOptions.ts` (pure): option sets per condition from ENV; `nearestOption(value)`;
  `riskPreset(strengths)` / `strengthsFor(preset)`.
- `CompositeControls.tsx`: rewrite around `SentenceRow`; keep the gear modals and the info modal.
- `components/FilterPanel/MapLayersControl.tsx`: replaces the noise switch + `ClimateLayerControls`.
- `BestZones.tsx`: copy and the More / Fewer buttons; `BaseUrlInput` into a popover titled "Search filters".
- `FilterPanel.tsx`: new order.
- ENV: reuses `VITE_QUIZ_*` from 031; `VITE_RISK_PRESET_AVOID=5`, `VITE_RISK_PRESET_STRONG=8`.
- Docs: `049-conditions-real-units.md` gets a note that the sliders are now behind "Custom…".

## Tests

- `conditionOptions.test.ts`: options from ENV, nearest option, risk preset round trips.
- `SentenceRow.test.tsx`: off / on states; picking an option updates the store once; "Custom…" shows the
  slider with the current value.
- `MapLayersControl.test.tsx`: exactly one layer visible; "None" clears all; legend follows the choice.
- `BestZones.test.tsx`: More / Fewer step through `TOP_PCT_STEPS`; labels.
- Existing `CompositeControls.test.tsx` updated, not deleted: the same store effects through the new UI.

## Definition of Done

Per `CLAUDE.md`. Manual: on a 375 px phone every sentence fits on two lines; a new user can change the noise
limit without seeing a number in dB unless they open "Custom…".

## Open questions

- Keep the checkboxes at all, or make "Don't care" an option of every picker (= off)? Proposed: checkbox
  stays; it is the fastest way to switch a condition off.

## As built (2026-11-12)

Decisions taken with the product owner before the build: the panel is **372 px** wide; **Best areas** is a block in
the panel (the floating bar is gone when the flag is on); the Livability switch stays as **"Show match colours"**
beside the legend; the areas list has **two sections** (Barcelona, Metro area).

- **Behind the onboarding flag.** With `VITE_FEATURE_ONBOARDING` on, `FilterPanel` shows the new panel; with it off
  the old controls (`CompositeControls`, noise switch, `ClimateLayerControls`) stay, so a release never breaks
  production before the flag is switched. Remove the old code when the flag goes (see `docs/FEATURE_FLAGS.md`).
- **Order in the panel:** "Your conditions … Start from a profile" → (flagged: commute, Idealista prices,
  exclusions) → sentence rows with "+ add" chips and the match bar (031's `ConditionsEditor`) → "Show match colours"
  with (i) → **Map layers** → **Best areas** → **Advanced** → attribution.
- **Map layers** (`MapLayersControl`): None · Noise · River floods · Street flooding · Wildfire; one at a time, with
  the legend of the chosen one. The store keeps the four flags; `setMapLayer(layer)` sets exactly one;
  `mapLayerOf(state)` reads it (noise > river > street > wildfire when several are on). With the new panel on, of
  several saved layers only the first stays on at load.
- **Best areas** (`BestAreasControls`, in the panel): "Show my best areas" → "N best areas in view", "Top 15 % of
  homes, numbered on the map", **Fewer areas / More areas** (steps `TOP_PCT_STEPS`, now in `services/bestZones.ts`),
  Hide, a "Search filters" popover (the Idealista URL) and the commute-zone checkbox while a commute or exclusion
  feature is on. `BestZones` on the map keeps drawing the zones and reports their count in the store
  (`bestZonesCount`); its floating bar is rendered only with `withBar` (off when the flag is on). The panel reaches
  the map through `store/mapStore.ts` (set by `Map.tsx`) for `visibleBounds`.
- **Advanced** (`AdvancedSettings`, closed at first): how much each climate risk counts (the three strength rows,
  moved to `StrengthRow.tsx`) and "Boost contrast for this view". The risk word in the sentence reads "Custom" when
  the three strengths differ. The services / places / eras lists are the checklists of the sentence pickers, so they
  are not repeated here; the Idealista URL is in the Best areas popover.
- **Phone:** sentences are 14 px with tighter pills; every sentence fits two lines at 375 px.
- **Your areas** (`AreasList`): Barcelona (top 10, "Show all") and Metro area (top 5, "Show all"), each ranked and
  numbered from 1; the kind chip is hidden inside the sections.
- Still open: the noise words of the picker (50 / 58 / 65 dB: a courtyard / a calm street / normal city noise) and
  `noiseAnchor` (47 / 57 / 67) do not match; the card says "like a busy street" at 65 dB.

