# 019 · Idealista Price Heatmap Layer

## Goal

Display a heatmap of Idealista property listings on the map, coloured by price. A dual-handle price range slider lets the user filter and recolour the layer in real time without reloading data.

## Status

Implemented.

## Data preparation workflow

### 1. Capture HAR

1. Open Idealista map with the desired filters applied.
2. Zoom to level 16–17 and slowly pan across the entire area.
   The browser calls `livesearchmapgrouped.ajax` on every pan — all responses are captured.
3. Open DevTools → Network → right-click any request → **Save all as HAR with content**.

### 2. Run extraction script

```bash
# From repo root — pass one or more HAR files as arguments:
python3 scripts/har_to_geojson.py path/to/capture.har

# Multiple files are merged and deduplicated:
python3 scripts/har_to_geojson.py file1.har file2.har
```

**Output:**
- `data/idealista-prices/idealista_pins_DDMMYYYY.geojson` — dated snapshot, never overwritten (counter appended if same-day run)
- `frontend/public/data/idealista_prices.geojson` — latest snapshot served by the app

### GeoJSON feature schema

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [lng, lat] },
  "properties": {
    "adId": 111411560,
    "price": 252000.0,
    "priceText": "252,000 €",
    "isAuction": false,
    "exactLocation": false
  }
}
```

`exactLocation: false` means the pin is placed at an approximate address (Idealista's default for most listings). `true` means exact coordinates were disclosed by the seller.

## UI

### Layer toggle

Switch in the filter panel: **Idealista prices**. Off by default.

### Price range slider (dual-handle)

Rendered below the toggle when the layer is active. Bounds are inferred from the loaded GeoJSON at runtime; default range 100k–1.5M€, step 25k.

- Drag handles → updates MapLibre paint expression + filter without re-loading the source.
- Points outside the range are hidden (MapLibre filter).
- Labels show `Xk€` / `X.XM€` format.

### Colour scale

7-step ramp (no transparency), cheap = teal, expensive = coral/red:

| Index | HEX | Meaning |
|---|---|---|
| 0 | `#1b7a8a` | cheapest |
| 1 | `#5aaab8` | |
| 2 | `#a3d4da` | |
| 3 | `#f0ebe3` | median |
| 4 | `#f2b09e` | |
| 5 | `#e67b6e` | |
| 6 | `#c9463b` | most expensive |

Breaks are equal-width within the selected range and recomputed on every slider change.

### Click popup

Click any dot → popup with formatted price + **"View on Idealista ↗"** link (`https://www.idealista.com/inmueble/{adId}/`).

## Files

| Path | Role |
|---|---|
| `scripts/har_to_geojson.py` | HAR → GeoJSON extraction script |
| `data/idealista-prices/` | Dated snapshots (git-ignored) |
| `frontend/public/data/idealista_prices.geojson` | Live data served by Vite |
| `frontend/src/components/IdealistaPricesLayer/IdealistaPricesLayer.tsx` | MapLibre source + circle layer |
| `frontend/src/components/IdealistaPricesLayer/IdealistaPricesControls.tsx` | Toggle + range slider UI |
| `frontend/src/components/IdealistaPricesLayer/priceColors.ts` | Colour expression builder |
| `frontend/src/components/IdealistaPricesLayer/priceColors.test.ts` | Unit tests |

## Definition of Done

- [x] Layer toggle in filter panel
- [x] Dual-handle price range slider
- [x] Real-time recolour via `setPaintProperty` + `setFilter`
- [x] Click popup with price + Idealista link
- [x] Script accepts CLI args, outputs dated snapshot, never overwrites
- [x] Unit tests for colour logic
- [x] `npm test`, `npm run lint`, `npm run typecheck` — all green
