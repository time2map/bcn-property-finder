# 025 — Hex Detail Card

## Goal

Clicking any H3 hexagon on the Livability Index layer opens a detail card on the right side
of the map with all raw and scored data for that cell. Hovering a hex highlights its border in white.

## User stories

- As a user I want to click a hexagon and see the actual values behind the scores, not just
  normalised indices.
- As a user I want to see per-category walkability breakdown (supermarket, pharmacy, etc.).
- As a user I want to understand noise levels relative to WHO/EU standards.
- As a user I want to quickly compare hexagons by opening one card, then clicking another hex.
- As a user I want to close the card by pressing Escape or clicking the close button.

## Data available per cell

All data comes from `CellBundle` (already loaded by `CompositeLayer`):

| Field | Type | Source |
|---|---|---|
| `score` | 0–100 | computed composite |
| `walk` | 0–100 | walkability index |
| `walkCategories` | Record<string, number> \| undefined | per-category sub-scores (pipeline v2+) |
| `lden` | number \| null | raw noise (dB) |
| `cityCoreProps` | object | walking minutes to each landmark |
| `saleEurM2` | number \| null | INCASOL raw price (€/m²) |
| `medianPrice` | number \| null | Idealista median price (€) |

## Card sections

1. **Livability** — large score number + colour bar (colour matches map scale)
2. **Walkability** — overall score (0–100) + per-category mini-bars (🏪 🏥 🌿 etc.) when pipeline v2+ data is available
3. **Noise** — score (0–100) + raw Lden dB value + contextual label (very quiet / near WHO limit / above EU action level / highly noisy) + reference line "WHO: < 53 dB · EU action: 55 dB · harmful: ≥ 65 dB"
4. **City Core Access** — score (0–100) + all enabled landmarks sorted by distance (walking minutes)
5. **Sale price** — raw `saleEurM2` €/m² + score (shown when `openPrice` weight > 0)
6. **Listing price** — median Idealista price € + score (shown when `price` weight > 0)

Sections with no data (null) are rendered in a muted/dimmed style with "—".

## Noise reference thresholds

- `< 45 dB` → "very quiet" (score 100)
- `< 53 dB` → "quiet" (score > 73)
- `< 55 dB` → "near WHO limit (53 dB)" (score ~67)
- `< 65 dB` → "above EU action level (55 dB)" (score ~33)
- `≥ 65 dB` → "highly noisy" (score ≤ 33)

Formula: `score = clamp((75 − lden) / 30 × 100, 0, 100)`

## Per-category walkability

Pipeline (`scripts/prepare-livability-grid.py`) outputs `walk_supermarket`, `walk_pharmacy`,
`walk_park`, `walk_school`, `walk_kindergarten`, `walk_clinic`, `walk_metro`, `walk_cafe`,
`walk_restaurant`, `walk_beach` per cell (0–100 each).

`compositeData.ts` loads these into `CellBundle.walkCategories: Record<string, number>`.
The card shows mini-bars for each category from `SERVICE_CATEGORIES` (with emoji).

## Hover highlight

A dedicated `composite-hover-outline` line layer sits above the fill layer.
Filter: `['==', ['get', 'h3'], hoveredH3]`.
Style: `line-color: #ffffff`, `line-width: 2`, `line-opacity: 0.9`.
The hovered h3 id is tracked in local React state inside `CompositeLayer`.

## Architecture — Variant B (shared data map)

`CompositeLayer` already holds all `CellBundle[]` in a ref. After loading, it populates a
module-level `Map<string, CellBundle>` (`hexBundleMap`) exported from `compositeData.ts`.
The `HexDetailCard` component reads from this map by h3 id — no extra fetching.

## Components

- `HexDetailCard` — `src/components/HexDetailCard/HexDetailCard.tsx`
- `CompositeLayer` — hover highlight + click handler
- Store — `selectedHexH3: string | null` + `setSelectedHexH3`

## Definition of Done ✅

1. Unit tests for `HexDetailCard` (renders all sections, null handling). ✅
2. `npm test` green. ✅
3. `npm run lint` clean. ✅
4. `npm run typecheck` clean. ✅
5. Manually verified: click hex → card opens with correct data; hover → white border; Escape → card closes. ✅
6. Pipeline extended for per-category POI scores (`walk_supermarket` etc.). ✅
7. Noise norms displayed with contextual labels. ✅
