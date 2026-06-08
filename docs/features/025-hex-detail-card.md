# 025 — Hex Detail Card

## Goal

Clicking any H3 hexagon on the Composite Livability layer opens a detail card on the right side
of the map with all raw and scored data for that cell. Hovering a hex highlights its border in white.

## User stories

- As a user I want to click a hexagon and see the actual values behind the scores, not just
  normalised indices.
- As a user I want to quickly compare hexagons by opening one card, then clicking another hex.
- As a user I want to close the card by pressing Escape or clicking outside the hex grid.

## Data available per cell

All data comes from `CellBundle` (already loaded by `CompositeLayer`):

| Field | Type | Source |
|---|---|---|
| `score` | 0–100 | computed composite |
| `poiScore` | 0–100 | walkability index |
| `noiseScore` | 0–100 \| null | derived from `lden` |
| `lden` | number \| null | raw noise (dB) |
| `cityScore` | 0–100 | city core access index |
| `cityCoreProps` | object | distances to each landmark (m) |
| `openPriceScore` | 0–100 \| null | INCASOL price score |
| `saleEurM2` | number \| null | INCASOL raw price (€/m²) |
| `priceScore` | 0–100 \| null | Idealista price score |
| `medianPrice` | number \| null | Idealista median price (€) |

## Card sections

1. **Composite** — large score number + colour bar
2. **POI Access** — score (0–100), labelled "Walkability"
3. **Noise** — score (0–100) + raw `lden` dB value (shown when available)
4. **City Core Access** — score (0–100) + top-3 nearest landmarks with distance in metres
5. **INCASOL price** — raw `saleEurM2` €/m² (shown when available)
6. **Idealista price** — median price € per listing (shown when available)

Sections with no data (null) are rendered in a muted/dimmed style with "—".

## Hover highlight

A dedicated `composite-hover-outline` line layer sits above the fill layer.
Filter: `['==', ['get', 'h3'], hoveredH3]`.
Style: `line-color: #ffffff`, `line-width: 2`, `line-opacity: 0.9`.
The hovered h3 id is tracked in local React state inside `CompositeLayer`.

## Architecture — Variant B (shared data map)

`CompositeLayer` already holds all `CellBundle[]` in a ref. After loading, it populates a
module-level `Map<string, CellBundle>` (`hexBundleMap`) exported from `compositeData.ts`.
The `HexDetailCard` component reads from this map by h3 id — no extra fetching.

The GeoJSON rendered to MapLibre does **not** need to carry the extra raw fields; the map only
needs `h3`, `score`, `hasGap` for rendering. Raw fields stay in the in-memory map.

## Components

- `HexDetailCard` — `src/components/HexDetailCard/HexDetailCard.tsx`
  - Props: `bundle: CellBundle | null`, `weights: CompositeWeights`, `onClose: () => void`
  - Slide-in from right, absolute-positioned over the map
  - Closes on Escape key or click outside the hex grid
- `CompositeLayer` — extend with:
  - hover highlight layer
  - `click` handler on `FILL_LAYER_ID` → sets `selectedH3` in store
- Store — add `selectedHexH3: string | null` + `setSelectedHexH3`

## Definition of Done

1. Unit tests for `HexDetailCard` (renders all sections, null handling).
2. `npm test` green.
3. `npm run lint` clean.
4. `npm run typecheck` clean.
5. Manually verified: click hex → card opens with correct data; hover → white border; Escape/outside click → card closes.
