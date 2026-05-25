# 009 · Noise level layer & score

## Goal

Add acoustic noise as a first-class factor in the property ranking:

1. **Visual overlay** — a toggleable vector tile layer showing Barcelona's Lden acoustic map.
2. **Noise sub-score** — a 0–100 score derived from EU strategic noise map data, factored into the composite `propertyScore` alongside travel accessibility.

---

## Data source

| Dataset | File | Year | Sources included |
|---|---|---|---|
| `isofones-mapa-estrategic-soroll` | `2022_Isofones_Total_Lden_BCN.gpkg` | 2022 | Road + railway + industry + leisure |

Layer `2022_Isofones_Total_Lden_Mapa_Estrategic_Soroll_BCN`: MultiPolygon features. Single field `Rang: String` with values like `"< 40 dB(A)"`, `"40 - 45 dB(A)"`, ..., `">= 80 dB(A)"`.

**Total** combines all strategic noise sources (road traffic, railways, industry, leisure/entertainment). This is the most relevant dataset for residential quality assessment.

Available source-specific datasets (not used): `Transit_Viari`, `Ferrocarrils`, `Industria`, `Oci_Lleure` — each available for Dia/Vespre/Nit/Lden.

---

## Noise metric: Lden

**Lden** (Level day-evening-night) is a 24-hour composite with penalties for evening/night sensitivity:

```
Lden = 10 × log10(
  (12/24) × 10^(Ld/10)
  + (4/24) × 10^((Le+5)/10)    ← evening +5 dB penalty
  + (8/24) × 10^((Ln+10)/10)   ← night +10 dB penalty
)
```

Unit: dB(A). The GPKG filename contains "Lden" confirming this metric.

### Standards

| Threshold | Source | Meaning |
|---|---|---|
| ≤ 53 dB | WHO (2018) | Recommended limit for road traffic noise |
| ≥ 55 dB | EU Directive 2002/49/EC | Triggers mandatory noise action plans |
| ≥ 65 dB | EU Directive | High noise exposure |
| ≥ 70 dB | EU Directive | Very high noise exposure |

---

## Score calculation

```
noiseScore(Lden_dB) = clamp(0, 100, round((75 − Lden_dB) / 30 × 100))
```

| Lden | Score |
|---|---|
| ≤ 45 dB | 100 |
| 55 dB | 67 |
| 60 dB | 50 |
| 65 dB | 33 |
| ≥ 75 dB | 0 |

If a pin falls outside all isophone polygons → `noiseScore = undefined`; excluded from composite.

---

## Composite score

```
compositeScore = round(
  (travelIndex × W_travel + noiseScore × W_noise) / (W_travel + W_noise)
)
```

Default weights from ENV: `VITE_COMPOSITE_WEIGHT_TRAVEL=5`, `VITE_COMPOSITE_WEIGHT_NOISE=2`. If `noiseScore` is undefined, composite falls back to `travelIndex` only.

---

## Data pipeline (build-time, one-off)

Script: `scripts/prepare-noise-data.sh`. Requires GDAL ≥ 3 and tippecanoe.

Steps:
1. Download `2022_Isofones_Total_Lden_BCN.gpkg` from Barcelona Open Data (cached in `data/noise/`).
2. `ogr2ogr` — GPKG → GeoJSON (EPSG:4326), parse `Rang` string → numeric `lden` midpoint.
3. `tippecanoe` — GeoJSON → `frontend/public/data/noise.pmtiles` (z10–z16).

Output committed to the repo:
- `frontend/public/data/noise.pmtiles` — vector tiles for rendering + scoring

The intermediate GeoJSON is kept in `data/noise/` (gitignored).

---

## Runtime (client-side)

### PMTiles protocol — `src/services/noise/pmtilesProtocol.ts`

Registers `pmtiles://` protocol with MapLibre once at app startup. Uses HTTP Range requests — only requested tiles are fetched, not the whole file. Compatible with any static file host (nginx, CDN, S3).

### Visual overlay — `src/components/NoiseLayer/NoiseLayer.tsx`

Vector fill layer from `pmtiles:///data/noise.pmtiles`, source-layer `noise`. Color scale matches the official Barcelona acoustic map (QGIS .qml palette):

| Lden | Color |
|---|---|
| < 40 | `#b3e0f2` |
| 40–45 | `#79c8e0` |
| 45–50 | `#a8d86e` |
| 50–55 | `#d4ed6a` |
| 55–60 | `#f5f500` |
| 60–65 | `#f5c800` |
| 65–70 | `#f57d00` |
| 70–75 | `#e02020` |
| 75–80 | `#d400d4` |
| ≥ 80 | `#0000c8` |

Layer hidden by default. Toggle persisted in `localStorage` under `bcn_noise_layer_visible`.

### Scoring — `src/services/noise/noiseData.ts`

```ts
getNoiseLden(lng, lat): Promise<number | undefined>
```

Reads the z=14 tile for the given coordinates from `noise.pmtiles` via the `pmtiles` JS library, decodes it with `@mapbox/vector-tile` + `pbf`, and runs point-in-polygon. Returns the `lden` midpoint or `undefined` if no polygon covers the point.

### Legend — `src/components/NoiseLayer/NoiseLegend.tsx`

Rendered inside FilterPanel directly below the "Noise map (Lden)" switch. Shows:
- Color scale with dB labels
- WHO/EU standards reference: "WHO rec.: ≤53 · EU action: ≥55 dB"
- Data source attribution
- Visible only when `noiseLayerVisible === true`

---

## UI

- Property table: "Noise, dB" column showing `noiseLden` as `"XX dB"`, placed before composite Score.
- Composite Score: weighted combination of travelIndex + noiseScore.
- Layer toggle: Switch in FilterPanel "Layers" section. Legend appears below it when active.

---

## Done when

1. `scripts/prepare-noise-data.sh` runs cleanly and produces `frontend/public/data/noise.pmtiles` from Total Lden dataset.
2. Noise vector layer toggles on/off on the map, renders identically to QGIS (smooth polygon fills).
3. Each property pin gets a `noiseLden` value (or `undefined` if no data).
4. `compositeScore` includes noise when `noiseScore !== undefined`.
5. Table shows "Noise, dB" column with actual dB value before Score column.
6. Legend appears in FilterPanel under the toggle with WHO/EU standards, only when layer is active.
7. Unit tests: `noiseScore()` formula, anchors at 45/75 dB, undefined passthrough.
8. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
