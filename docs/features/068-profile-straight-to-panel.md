# TODO-068 — A profile goes straight to the main panel; only "Build your own" opens the sentence screen

**Status:** Implemented 2026-11-14, checked in the browser at 375 px and 1440 px. Changes the flow of 031.

## Problem

Picking one of the four profiles on the start screen leads to the sentence screen with a "Show me the map" button.
The person already chose a ready-made answer, so the extra confirmation is a lost step in the funnel.

## Decision

- **Profile card** → the profile is applied and the onboarding is completed: the person lands in the main
  panel (conditions rows from 052, Map layers, Best areas, Advanced) with the map coloured.
- **Build your own** → unchanged: the intermediate sentence screen with the three default conditions and the
  "Show me the map" button at the bottom.
- "Just show me the map" and the "Change" chip in the panel are unchanged ("Change" returns to the start screen).

## Checks

- Tests: a profile closes the onboarding and applies its settings in one store update; "Build your own" opens the
  sentence screen and keeps the onboarding open.
- Browser: 375 px (the map must stay visible with the panel as a bottom sheet) and 1440 px.
