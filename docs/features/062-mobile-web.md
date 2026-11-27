# 062 — Mobile web: the map on a phone

**Status:** Done (2026-11-13). Checked on a real iPhone in Safari over the local network (HTTP, so without "Where am I",
which needs HTTPS).

Target: iPhone 14 and newer in Safari (390 × 664 px visible with the browser bars, 390 × 844 from the Home
Screen). Phone layout = `max-width: 768px`, as today. The desktop layout does not change.

## Problem

After the onboarding, the phone gets the desktop panels made smaller (audit of 2026-11-13):

1. The building card is the 300 px desktop card at the top. It covers the brand bar and about 85 % of the
   screen, including the building that was tapped.
2. Filters open as an opaque full-height drawer. The user changes a condition and cannot see the map recolour.
3. "Your areas": a tap on an area shows nothing, because the list stays over the map.
4. There is no colour legend on the map.
5. Touch targets are smaller than 44 pt: zoom 29, search and share 32, word pills 33, remove 36, info 20,
   tabs 36.
6. The search field is 14 px, so iOS Safari zooms the page on focus.
7. The word picker is a popover that runs off the right edge and covers the next sentences.
8. Zoom buttons and the compass take the top-right corner; there is no "where am I" button.
9. No `viewport-fit=cover`; safe areas are used only in the onboarding sheet; the card uses `100vh`; there is
   no web manifest; the map attribution is at the bottom of the filters.

## Decision

The map is always visible. Everything else lives in **one bottom sheet with three positions**.

```
┌───────────────────────┐
│ ◉ Search Barcelona… ⤴ │  search pill (brand mark, share)
│                   [◎] │  locate me
│         MAP           │
│ [Great Good Part Poor]│  compact legend above the sheet
├───────── ▬ ───────────┤
│ Quiet · On foot · €   │  sheet, peek
└───────────────────────┘
```

### 1. Bottom sheet

- Positions: **peek** (92 px + bottom safe area), **half** (~50 % of the height), **full** (the height minus 72 px
  and the top safe area: it stops below the search pill, not under it).
- A **tap** on the small sheet (not on a button inside it) opens it halfway, as if it had been pulled up. On the
  building view this makes the address and the match line the way in to the details.
- Dragged by the handle and the header. The content scrolls only in the full position; in half, a drag up on
  the content takes the sheet to full first.
- Own component on pointer events and CSS transforms, no new dependency (bundle budget, TODO-058).
- Three views in the same sheet:
  - **Conditions** (default): peek shows the names of the conditions that are on; half and full show the
    current panel (editor, match bar, map layers, best areas, advanced).
  - **Your areas**: the ranked list. A tap on an area flies the map to it and drops the sheet to peek with the
    area name and its share; "Back to the list" returns to the same scroll position.
  - **Building**: peek = address, "Good match · 73", "Meets 2 of 3"; half = the condition lines; full = the
    rest of the card. A tap on another building replaces the content and keeps the position. Closing returns
    to the previous view.
- The map padding follows the sheet (peek and half; at full it keeps the half value), so the selected building,
  a searched place and an area are centred in the visible part. A building opens at peek, so it is never under
  the sheet; no extra pan is needed. The visible-area logic for the colour scale and best zones (`visibleBounds`)
  uses the same inset.
- Drag listeners are native DOM listeners, not React ones: the building card fills the header and body through
  portals, and React events follow the React tree, so a drag that starts on the address would never reach the sheet.
- The onboarding sheet keeps its own component (`.onboarding-sheet`): it has no peek and no drag.

### 2. Top bar and the product name

- **First visit, onboarding open:** the bar shows the mark and the full name "Barcelona livability map", as today.
- **After the onboarding:** the bar becomes a full-width search pill: brand mark on the left, placeholder
  **"Search Barcelona livability map"**, share button on the right. The name stays on screen until the user
  types. Fallback if it does not fit on a real device: "Search the livability map".
- Search field at 16 px. With the field focused, the results take the whole screen above the keyboard.
- Other places that carry the name: the manifest (`name` "Barcelona livability map", `short_name`
  "Livability"), the share sheet title (already there), and a new **About** sheet behind an "ⓘ" button on the
  map and behind the mark in the pill: mark, full name, one line about the product, a link to time2map, the data
  credit line and the map attribution. (The mark in the pill no longer links to time2map.com: a tap there opens
  About, which has the link.) The page heading stays as a visually hidden `<h1>`.

### 3. Map

- No zoom buttons on a phone. The compass shows only when the map is rotated.
- Rotation by two fingers and pitch are off on touch screens.
- **Locate me** button (MapLibre `GeolocateControl`, asked only on tap). When the position is inside the
  covered area, the map flies there and the nearest residential building within
  `VITE_LOCATE_NEAREST_BUILDING_M` (default 40 m) opens in the sheet at peek. Outside the area: a short note
  "You are outside the map area". Permission denied: a short note, nothing else.
- A tap on the map looks for a building within ±8 px (`VITE_TAP_TOLERANCE_PX`), nearest first.
- On a touch screen a tap on a building opens its card after `VITE_DOUBLE_TAP_GRACE_MS` (280 ms), and a second
  touch, or the map starting to move or zoom, cancels it: one-finger zoom (double tap, then drag) must not open a
  card with its first tap. Mouse clicks are not delayed.
- Compact legend (the four bands) above the sheet; hidden when the map is neutral (061) or match colours are
  off.

### 4. Conditions editor

- The word picker opens as a bottom sheet (Mantine `Drawer`, as tall as its content) with 52 px rows. "Custom…"
  keeps its slider (not a numeric field), with a 28 px thumb.
- All touch targets are at least 44 × 44 px, except the word pills (36 px, with the hit area grown by 4 px around
  them: sentences would grow too tall otherwise). Inputs are 16 px.
- Card and panel text is at least 12 px on a phone.

### 5. iOS layer

- `viewport-fit=cover`; `env(safe-area-inset-*)` on every fixed element. The initial layout is chosen at the first
  render (`useMediaQuery` without the effect delay), so a phone never starts with the desktop panel.
- The mark in the search pill is the bare logo: no frame, no shadow.
- `dvh` instead of `vh`; `overscroll-behavior: none` on the body; `touch-action` on the sheet and the handle.
- `prefers-reduced-motion`: the sheet and the map move without animation.
- `manifest.webmanifest` (`display: standalone`, existing icons), `apple-mobile-web-app-*` meta tags.

## Out of scope

- The personal comparison mode (pins, compare pane, isochrone, exclusions) on a phone: behind flags, off in
  production. It keeps working as today.
- Offline mode and a service worker.
- Android-specific tuning (it gets the same layout).
- Landscape: must not break, not tuned.

## Order of work (one branch, `feat/062-mobile-web`)

1. **Hygiene:** touch targets, 16 px fields, safe areas, `dvh`, manifest, map gestures, no zoom buttons.
2. **Sheet:** the component, then conditions, areas and the building card in it; map padding; legend.
3. **Search and editor:** search pill with the name, full-screen results, word picker as a sheet, About sheet.
4. **Locate me** and the nearest building.

## Affects existing docs

- `docs/DESIGN.md` — Layout, mobile.
- `031-onboarding-quiz-presets.md`, `044-territory-search.md`, `046-building-level-index.md`,
  `051-ranked-areas-list.md`, `052-conditions-editor-sentences.md` — phone behaviour.
- `docs/FEATURE_FLAGS.md` — only if the work goes behind a flag (not planned).
- `frontend/.env.local.example` and `.env.production` — `VITE_LOCATE_NEAREST_BUILDING_M`, `VITE_TAP_TOLERANCE_PX`,
  `VITE_DOUBLE_TAP_GRACE_MS`.

## Definition of Done

- [x] Unit tests: sheet positions and snapping; the view shown for a building / area / conditions; map padding
      from the sheet position; nearest building within the limit; tap pick (`sheetSnap`, `locate`, `sheetStore`,
      `useSheetFlow`, `useSheetMapPadding`, `conditionNames`, `ConditionsSheetHeader`, `LocateButton`)
- [x] Integration test: tap a building → sheet at peek with the match line → drag to full → close
      (`MobileBuilding.test.tsx`), and the phone layout of `App.test.tsx`
- [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` + `check:bundle` (490 of 500 KB)
- [x] Playwright (Chrome, iPhone 14 profile): first visit, conditions with the map visible, word picker, areas,
      search, "Where am I", building at peek / half / full, About; desktop layout unchanged
- [x] Checked on a real iPhone in Safari (over HTTP on the local network). Not checked: the Home Screen mode and
      "Where am I", which need HTTPS. Check them after the release, on the live site.
- [x] No input under 16 px on the phone layout; touch targets: measured, one left under 44 px by design (word
      pills, see above) and the About sheet's mark in the pill (34 × 44, in the pill's left slot)

## Follow-up: first real-device pass (2026-11-14)

- **Language on the phone.** The pill's right slot is the same `BrandMenu` as on the desktop (Share, About and data
  sources, language list) instead of a bare Share button.
- **Map credit** folds into a «©» button on the phone (see 066).
- **Open sheet is more compact.** At half and full the header is one row: «Your conditions» and the «Start from a
  profile» link (moved up from the body, where its label repeated the title). On the areas tab only the one-line
  ranking hint remains: the tabs already name the view. At peek nothing changed.

## Follow-up: 070 (2026-11-15)

The building sheet's peek reads "83 of 100 · Good match · Meets 3 of 4" with the first address and "+N" for more;
the technical sections are folded under "Details about this building". See `070-building-rank-in-barri-and-city.md`.
