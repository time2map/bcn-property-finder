# Feature 014 — Compare panel as marketplace spec-sheet + split layout

## Goal

Rework the apartment comparison from a wide, hard-to-orient bottom table into a
**transposed marketplace spec-sheet** (apartments = columns, attributes = rows grouped
into Outdoor / Indoor sections) hosted in a **resizable split layout** — comparison panel
on the left, map on the right.

This addresses two problems with the old `PinCompareTable`:
- ~18 undifferentiated horizontal columns → no orientation ("what's going on?").
- Adding parameters made the horizontal scroll and overload worse; the panel also
  occluded the map.

Transposing turns "more parameters" into vertical scroll and makes the **Indoor / Outdoor**
split literal section dividers. Each apartment becomes a card-column with a cover photo and
a headline **Location** score.

## Product framing (three jobs)

1. **Zone of interest** — commute isochrone → "Search by area on Idealista". Already
   implemented (`FilterPanel` / `IsochroneLayer` / `ExportButton`). Not changed here.
2. **Outdoor** — location quality: routes (walk/transit/cycle/drive), noise, walkability →
   composite **Location** score (`computeCompositeScore`, unchanged; only relabeled from "Score").
3. **Indoor** — the flat itself: price, area, €/m², rooms, floor, year, photos, notes.
   Rich Idealista fields (orientation/condition/amenities/energy/lift) stay in `comment` as
   text for now. A subjective per-viewing rating is captured in `PropertyPin.rating` (1–10).

## Decisions

- **Layout:** desktop split — **Compare LEFT / Map RIGHT**, draggable resizer, collapsible panel.
- **Columns (v1):** every pin is a column; horizontal scroll with a sticky attribute-label
  column; sorted best → worst left → right by Location score. (Explicit compare-set selection = later.)
- **Mobile (≤768px):** no split — a full-screen **Map / Compare** toggle.
- **Indoor depth:** layout only — no data-model / parser changes.
- **Verdict:** outdoor-only; relabel "Score" → "Location".
- **Recorder:** inert **Visit** row reserved in the Indoor section.

## Layout

```
Desktop                                  Mobile (toggle)
┌──═────────────┬───────────────┐        ┌─────────────┐  ┌─────────────┐
│ Compare (N) ⇔ │               │        │ [Map|Compare]│  │[Map|Compare]│
│  #1  #2  #3   │      MAP       │        │             │  │  #1 #2 #3   │
│ ─OUTDOOR───── │  (FilterPanel  │        │    MAP       │  │ ─OUTDOOR──  │
│  🚶 ...        │   + AddPin     │        │   full       │  │  🚶 ...      │
│ ─INDOOR────── │   float over)  │        │             │  │ ─INDOOR──   │
│  Price ...    │               │        │             │  │  Price ...  │
└──═────────────┴───────────────┘        └─────────────┘  └─────────────┘
   drag divider ⇔ resizes; map.resize() keeps tiles correct
```

## Grid structure (`CompareGrid`)

- First (sticky-left) column: section headers + attribute labels.
- One column per pin, sorted best→left (reuse `sortPins` / `compositeScore`).
- **Header row (sticky-top)** per pin: a thin strip with rank `#i` (left) + delete `✕`
  (right, off the photo), then the cover photo, then the **Location** score badge + mini-bar
  (`indexColor`). The "Location" label appears **once** in the sticky corner cell
  (`Location score ↓`) — not repeated per column.
- **OUTDOOR section** rows: 🚶 Walk · 🚌 Transit · 🚲 Cycle · 🚗 Drive · 🔊 Noise · 🏙 Walkability.
- **INDOOR section** rows: ⭐ My rating · Price · Area · €/m² · Rooms (bd/ba) · Floor · Year ·
  Listing · Notes.
  - **⭐ My rating** — settable 1–10 dot scale persisted to `PropertyPin.rating` (replaces the
    earlier inert "Visit" stub).
  - **Price** — formatted with thousands separators (`€320,000`); edits in raw digits, reformats on blur.
  - **Photos** — no thumbnail strip; the cover opens the gallery lightbox, a `+` overlay adds photos.
  - **Listing** — compact URL control: `+ link` to add, then an open-link + `⋯` menu (Copy / Edit / Remove).
  - **Notes** — large textarea (min-height 110px) so listing details are visible at a glance.
- Editable cells (Rating/Price/Area/Rooms/Floor/Year/URL/Comment) → `updatePin` on blur/click.
- **Best-in-row highlight:** `computeBests(pins)` (`compareHighlight.ts`) → `--best` class
  on the winning cell (only when ≥2 pins have that metric).
- Reuses `PhotoLightbox`, `compressImage`, `WalkabilityTooltip`.

## Files

```
frontend/src/App.tsx                                — split layout + mobile toggle + float repositioning
frontend/src/index.css                              — split/divider, transposed grid, hero, --best, stub, mobile
frontend/src/hooks/useSplitPane.ts (+ .test.ts)     — width/collapsed state, drag, clamp, persistence
frontend/src/components/Map/Map.tsx                 — ResizeObserver → map.resize()
frontend/src/components/PropertyPins/
  CompareGrid.tsx                                   — transposed grid (new)
  ComparePane.tsx                                   — chrome/collapse/empty wrapper (new)
  compareHighlight.ts (+ .test.ts)                  — best-in-column logic (new)
  CompareGrid.test.tsx                              — replaces PinCompareTable.test.tsx
  PinCompareTable.tsx                               — removed
```

## Out of scope

Scoring logic, Idealista parser, store/types, structured indoor fields (stay in `comment`),
explicit compare-set selection, the isochrone/zone feature.

## Definition of Done

- [x] Transposed grid: apartments as columns, Outdoor/Indoor section rows, sticky label col + header row.
- [x] Location hero (badge + mini-bar); best-in-row highlight with ≥2 pins.
- [x] Editable cells persist via `updatePin` on blur; photos add/lightbox work; Visit stub inert.
- [x] Split layout Compare-left/Map-right with draggable, persisted, collapsible width; `map.resize()` on resize.
- [x] Mobile full-screen Map/Compare toggle.
- [x] `npm test` green (grid + `useSplitPane` + `compareHighlight`), `npm run lint` clean, `npm run typecheck` clean.
- [x] Manually verified via `npm run dev`; targeted Playwright pass on the compare panel + split.
