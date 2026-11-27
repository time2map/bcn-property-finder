# TODO-072 — Redesign: building card (1b), onboarding, settings panel

**Status:** Implemented 2026-11-16. Branch `feature/card-and-panels-redesign` (from `dev`).
Design handoff: `docs/design/handoff_card_and_panels/` (README.md, CLAUDE_CODE_STEPS.md, `design/House Card.dc.html`).

## Problem

The card, the onboarding and the settings panel carry a lot of text and small, dense rows. The handoff redesigns
three parts: less text, scannable condition rows, the score first. No facts are removed.

## Decisions

- Risk strength (README open decision 1): **keep the 1–10 slider with the checkbox**. No 5-step meter.
- Word picker (2): **opens in place** under the sentence, as in the mock (replaces the popover and the phone drawer).
- Selected states (3): **ink** (switches on, selected chips, active tab, selected radio). Coral stays for primary
  actions and editable things: CTA, slider fill, editable-word underline.
- The mock loses to the code where they disagree (which sections show depends on the enabled conditions).

## Scope (one commit per step, on request)

1. **Card header (1b)** — `BuildingCard/MatchHeader.tsx`, `RankLines.tsx`, `BuildingCard.tsx`, `SaveImageButton.tsx`,
   `ShareLinkButton.tsx`: score ring, band label, "Meets N of M", condition rows with status icons, 0/1/2 rank tiles,
   grey Save/Share, details toggle row; phone peek with a small ring.
2. **Details (2a/2b)** — `BuildingCard.tsx` (details block, probably split out), `cardParts.tsx`: photo + 4-column strip,
   one collapsible row per section with a small ring and verdict (Noise and Climate risk open by default),
   "Facade by facade" sub-toggle, barri-level header row. No service emoji or per-service bars.
3. **Onboarding (3a/3b)** — `Onboarding/OnboardingPanel.tsx`, `PresetCards.tsx`, `Conditions/ConditionsEditor.tsx`,
   `SentenceRow.tsx`, `AddConditionChips.tsx`, `MatchBar.tsx`: profiles as one bordered list, short name above each
   sentence, editable-word style, add chips, match bar, coral CTA with ink text.
4. **Settings panel (3c)** — `FilterPanel/FilterPanel.tsx`, `YourConditionsRow.tsx`, `MatchColoursSwitch.tsx`,
   `MapLayersControl.tsx` (single-select chips), `BestZones/BestAreasControls.tsx`, `AdvancedSettings.tsx`,
   `StrengthRow.tsx` (restyle only), `Conditions/WordPicker.tsx`, `OptionList.tsx`, `CheckList.tsx` (in-place picker,
   one open at a time, Escape closes, "Custom…" slider from `CONDITION_RANGES`).
5. **Phone and accessibility pass** at 375 px: tap targets ≥ 44 px, contrast ≥ 4.5:1 (links ink + underline),
   no horizontal overflow, the whole condition row opens its picker.

CSS in `frontend/src/index.css`; shared tokens (hairline, field grey, ink) as variables next to `--ink`.

## i18n

Reuse existing keys. New: two rank-tile sentences, climate verdict "{{names}}" (the points are only in the amber circle), short strip labels,
`conditions:short.*` if missing. Keep en, ca, es in sync (`locales.test.ts`).

## As built

- The risk row of the card shows the points and names; the card has no heading over the rank tiles (it stays on the
  share picture).
- `DetailsView.tsx` holds the details; `matchText.ts` has `*Parts` for the value/limit split of the rows.
- Word picker: `pickerContext.ts` (one open per editor, a slot under each sentence); the popover and the phone
  drawer are gone.
- Not done: the 150 ms expand animation (optional in the handoff); the map-credit buttons are below 44 px on a phone
  (older, not part of this redesign).

## Review round (2026-11-16)

- All details sections are collapsed when the card opens; the photo and Catastro facts sit below the score sections,
  above the barri row.
- Price: an overshoot that rounds to 0% counts as met (score 100, no "+0%"); up to `ALMOST_FITS_PCT` (3%) the text says
  "almost fits" instead of the percentage. The sale-price body adds where the score reaches 0 and how many areas fit.
- Noise bar: the marker stands out of the bar with a white edge; the level pill no longer stretches.
- The outline of a picked area (search or click) goes away when a building is picked or an empty spot of the map is
  clicked (`SearchLayer`).

- Card layout (2026-11-16, second pass): the per-condition rows and the risk line under the score are gone (they repeated
  the sections). The header is the ring, the band, "Meets N of M" and the rank tiles (best in barri / city). The sections
  follow at once, with no outer "Details" toggle (`cardDetailsOpen` removed from the store). The photo and Catastro facts
  are the last section, "Details about this building", folded; opening it shows them.

## Docs to update when done

`docs/DESIGN.md` (card, panels, tokens), this file (drop `TODO-`).

## Definition of Done

Per CLAUDE.md: unit tests for new logic, one integration happy path, `npm test`, `npm run lint`,
`npm run typecheck`, manual check on desktop and phone width, Playwright on the affected components only.
