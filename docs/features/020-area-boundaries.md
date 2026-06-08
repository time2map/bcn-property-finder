# Feature 020 — Area Boundaries Layer + Exclusion Zones UX refresh

## Goals

1. **Exclusion zones** rendered in dark grey (was red); controls styled consistently with other layers.
2. **ExclusionControls** becomes a collapsible section with a `Switch` (layer on/off) matching the Noise/Livability pattern.
3. **FilterPanel** becomes scrollable when taller than the viewport.
4. **BarrioBoundaries layer** — always-on by default; shows barri / district / municipality outlines as thin red lines with small text labels; toggled via Switch "Area boundaries".
5. **Right-click context menu** on any barri zone → "Open on Idealista ↗" — uses `buildIdealistaUrl` with the user's saved filter base URL from `idealistaBaseUrlStore`.

> **Note (panel redesign):** `BarrioBoundariesLayer` was **removed** in the panel redesign (feature 022 v2).
> The layer was visually cluttered and the same neighbourhood context is available via the map base tiles.
> The `BarrioBoundariesLayer` component and its store key (`barrioBoundariesVisible`) have been deleted.

---

## UX details

### Exclusion zones — restyled
- Fill: `#555555`, opacity 0.28; line: `#555555`, 1.5 px, opacity 0.8.
- Draw buttons: `color="dark"` (Mantine), same filled/light active state.
- `Switch "Exclusion zones"` toggles layer visibility (persisted in localStorage).
- Chevron `▾/▸` collapses/expands the draw controls section (session state only).

### FilterPanel — scrollable
- `Paper` gets `maxHeight: calc(100vh - 32px)` + `display: flex; flex-direction: column`.
- Inner content wrapped in Mantine `ScrollArea`.

### Area Boundaries layer
- Source: `areas.geojson` (118 features — 10 districts, 73 barris, 35 municipalities).
- Layers:
  - `barrio-boundaries-fill` — opacity 0, for right-click hit-testing.
  - `barrio-boundaries-line` — `#E03131`, 0.8 px, opacity 0.55.
  - `barrio-boundaries-label-district` — districts + municipalities, minzoom 10, size 10.
  - `barrio-boundaries-label-barri` — barris only, minzoom 13, size 9.
- Labels: `text-halo` white 1px for legibility; `text-allow-overlap: false`.
- Toggle: `Switch "Area boundaries"` in FilterPanel, default ON.
- State: `barrioBoundariesVisible` in main store, persisted in localStorage.

### Right-click → Open on Idealista
- `map.on('contextmenu', handler)` inside `BarrioBoundariesLayer`.
- `queryRenderedFeatures` on `barrio-boundaries-fill` at click point.
- If feature found: `preventDefault` on native event; show portal context menu at `(clientX, clientY)`.
- Menu: area name (small grey header) + "Open on Idealista ↗" button.
- On click: `buildIdealistaUrl(areaGeometry, baseUrl)` → `window.open(url, '_blank')`.
- `baseUrl` from `idealistaBaseUrlStore` — carries user's saved Idealista filter (price, type, etc.).
- Dismiss: click outside or `Escape`.
- No hover, no left-click interaction.

---

## Architecture

```
frontend/src/
  store/exclusionsStore.ts          — added exclusionsVisible + setExclusionsVisible
  store/index.ts                    — added barrioBoundariesVisible + setBarrioBoundariesVisible
  components/ExclusionLayer/        — grey colors + visibility toggle
  components/FilterPanel/
    ExclusionControls.tsx           — Switch + chevron collapse + dark buttons
    FilterPanel.tsx                 — ScrollArea + "Area boundaries" Switch
  components/BarrioBoundariesLayer/
    BarrioBoundariesLayer.tsx       — new: line layer + labels + contextmenu portal
    BarrioBoundariesLayer.test.tsx  — new: 8 tests
  components/Map/Map.tsx            — mounts BarrioBoundariesLayer
```

---

## Definition of Done

- [x] ExclusionLayer grey (fill + line `#555555`).
- [x] ExclusionControls: Switch (layer on/off) + chevron collapse + dark buttons.
- [x] FilterPanel scrollable with max-height.
- [x] BarrioBoundariesLayer: line + label layers, default ON.
- [x] Right-click context menu with "Open on Idealista"; uses saved filter baseUrl.
- [x] All 440 tests green.
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
- [ ] Manual: visually verify grey exclusion zones, boundaries layer, labels, right-click menu, panel scroll.
