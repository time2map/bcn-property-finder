# Feature 038 — Best zones (Livability Index → Idealista)

## Goal

A floating bar at the bottom of the map with one button, **Draw best zones**. It finds compact zones
of the best-scoring hexes **in the visible part of the map** — 1–3 separate good areas, plus near-ties
(up to 5) — draws them numbered, and **clicking a zone opens a popup with its Idealista search link**
(with the user's saved filters). Once on, zones follow the map as it is panned/zoomed. A global
**Strictness** slider narrows or widens the zones in place.

Replaces the isochrone-based Idealista export (003, export part of 015): the isochrone geometry is
too complex for Idealista's `shape` parameter, so those links never worked reliably.

## User story

> As a property hunter, I tune the Livability Index weights, pan the map to the part of the city I
> care about, click **Draw best zones**, and get a few simple areas I can open in Idealista with my
> saved filters — instead of drawing them by hand. Moving the strictness slider makes each area
> tighter or looser without the zones jumping around.

---

## Algorithm — `services/bestZones.ts` (pure)

`findZoneCells(input) → string[][]` (hexes per zone, best first); `zoneOutline(cells, baseUrl)` turns
one zone into an Idealista-ready polygon; `findBestZones(input)` = both together.

Input: final composite score per H3 cell (res 9, after risk penalties), visible bounds
`[west, south, east, north]`, current score range `[min, max]`, `topPct`, Idealista base URL, and
optionally `sticky` (zones to keep, see step 6).

1. **Smooth.** `s̄(c)` = mean score over `gridDisk(c, 1)` (cell + 6 neighbours, known cells only).
   Removes salt-and-pepper: a lone dark-green hex is not a zone, a lone yellow hex does not punch a
   hole in a green block.
2. **Candidates.** Hexes lying **entirely** inside the visible area whose raw score is inside the
   score range (= the cells the user actually sees). Whole hexes, not centres — so a zone sits inside
   the view (only the ~55 m buffer can stick out) instead of grazing its edge. The visible area is the
   map viewport minus the left filter panel and the right hex detail card when it is open.
   With **Inside commute zone, outside exclusion zones** ticked (default), a candidate must also lie
   entirely inside the isochrone (when one is drawn) and not touch any exclusion zone (015) —
   `allowedCells(isochrone, exclusions)` via H3 `polygonToCellsExperimental` (full containment for
   the isochrone, overlap for exclusions).
3. **Threshold (strictness).** `T` = the `(1 − topPct/100)` quantile of `s̄` over candidates — the
   top `topPct`% of visible hexes. Percentile, not an absolute score, so it works for any weights.
4. **Cores.** Hexes with `s̄ ≥ T` are grouped into connected components (H3 adjacency) and ranked by
   **mass** = `Σ (s̄ − T)` — balances size and quality (area alone favours big mediocre blobs, mean
   favours tiny islands).
5. **Zones: 1–3 + near-ties, never 0.**
   - One zone per separate good area (core), most mass first, up to `MAX_ZONES` — no quota filling,
     so one uniformly good area stays one zone. Looser strictness merges neighbouring areas into
     fewer, bigger zones; stricter splits them into peaks.
   - **Near-ties:** further cores with mass ≥ `TIE_RATIO` × the last zone's are shown too, up to
     `MAX_WITH_TIES` — an equally good area isn't hidden behind an arbitrary cut-off.
   - **Growth:** a core smaller than `MIN_CELLS` (e.g. zoomed in: 40 visible hexes → top 5% = 2
     hexes) is grown (`growZone`) by adding the free neighbour touching the most zone hexes (compact
     blob, not a strip along a good street), ties by score. If it cannot reach `MIN_CELLS`, it is
     skipped.
   - **Gap:** zones keep a one-hex gap so they never touch.
   - **Never 0:** if no core fits (all boxed in), the best remaining hexes seed one zone. Only a view
     smaller than one zone gives none (`No zones fit this view — zoom out`).
6. **Sticky zones** (`sticky` input). When only strictness changes (same view, weights, risks,
   landmarks, score range), the hook passes back the zones of the last **fresh** computation (the
   anchor — set on Draw, pan/zoom or a weight change). They are placed first: each becomes the best
   core inside it — narrower when stricter, wider when looser. It disappears once nothing in it
   passes the threshold, and merges away when an earlier zone took its core. Free slots then go to
   the best other areas (step 5). Anchoring to the fresh result, not the previous slider step, means
   no drift: 15% → 7% → 15% gives exactly the 15% zones again.
   Why: recomputed from scratch, a contested 3rd slot jumped between areas (broad, mediocre Cornellà
   at 15% → small, strong Molins de Rei at 10%). Now Cornellà narrows and the other area is added as
   a near-tie.
7. **Geometry** (`zoneOutline`). `cellsToMultiPolygon` → outer ring (holes filled — Idealista does
   not support them) → `buffer(+BUFFER_DEG)` → `simplify(SIMPLIFY_TOL, highQuality)`. While the ring
   has more than `MAX_VERTICES` points or the search URL is over `MAX_URL_CHARS`, the tolerance grows
   ×1.5 (bounded steps); last resort — bbox.

### Zone numbers — `hooks/useBestZones.ts`

A zone keeps its anchor's number (one zone per number — if an anchor zone splits, only the first piece
keeps it); a vanished zone leaves a gap; newcomers get the next numbers (e.g. `1 2 4 5 6` after zone 3
disappears). A fresh computation numbers zones `1…n` again.

### Initial prototype (default weights, before the vertex cap and the later rules)

| Viewport | Top % | Components (raw → smoothed) | Top-3 zones (smoothed) |
|---|---|---|---|
| Barcelona city (880 cells) | 10 % | 19 → 7 | 4.6 / 1.3 / 1.1 km², URL ≤ 237 chars |
| Barcelona city | 15 % | 17 → 9 | 5.9 / 1.6 / 3.1 km², URL ≤ 263 chars |
| Barcelona city | 30 % | 11 → 6 | 17.6 / 6.2 / 2.5 km², URL ≤ 541 chars |

Smoothing halves fragmentation. With the 20-vertex cap, zones measured in the app have ≤ 20 vertices,
URLs of 145–500 chars and recompute in 13–30 ms; no self-intersections.

---

## UI

A floating bar at the bottom of the map (rendered inside the map context, so it can read the
viewport), shown only while the Livability Index is on:

```
┌────────────────────────────────┐
│ [Draw best zones]          [⚙] │   ← zones off
│ [× Clear zones]            [⚙] │   ← zones on
│ Strictness ────●──── top 15%   │
│ ☑ Inside commute zone, outside │
│   exclusion zones              │
└────────────────────────────────┘
```

- **Draw best zones** — turns zones on for the visible area. From then on zones **follow the map**:
  every pan/zoom (`moveend`) redraws them for the new view (fresh computation, numbers from 1).
  Weight, risk, landmark and score-range changes recompute them fresh; strictness changes keep them
  sticky (algorithm step 6).
- **Clear zones** (also **Esc**) — turns zones off; panning draws nothing until the next **Draw**.
- **⚙** — popover with the saved Idealista filter URL (`BaseUrlInput`, feature 016).
- **Strictness** — steps `top 25 / 20 / 15 / 10 / 7 / 5 %` (right = stricter), persisted. Above ~25%
  the good areas merge into one city-wide blob.
- **Inside commute zone, outside exclusion zones** — checkbox, on by default, persisted
  (`bestZonesRestrict`). Shown when the isochrone or exclusions feature is on. Toggling it, or a
  change of the isochrone / exclusion zones, recomputes the zones fresh (not sticky). The exclusion
  zones are drawn in the left panel (015, `VITE_FEATURE_EXCLUSIONS`).
- No zone fits (view smaller than one zone): `No zones fit this view — zoom out`.
- Mobile: bar sits at the bottom, right of the filters button.

Zones are **derived state**: the store keeps only the captured view (`bestZonesBounds`, null = off)
the strictness (`bestZonesTopPct`) and the restriction checkbox (`bestZonesRestrict`).

On the map (`BestZonesLayer`): dashed violet outline + light fill + zone number; hover highlights the
zone; **click a zone → popup `Open zone N in Idealista ↗`** (uses the saved filters).

### Changes to the Livability Index layer (`CompositeLayer`)

- The hover tooltip with the score breakdown is removed (too noisy) — the breakdown lives in the
  click card (025). Hovering a hex still shows its white outline and a pointer cursor.
- **Inside a drawn zone the zone owns hover and click:** no hex outline, and a click opens the zone
  popup instead of the hex detail card (`queryRenderedFeatures` on `best-zones-fill`). Outside zones
  hexes behave as before.

Gated by `VITE_FEATURE_BEST_ZONES` (off in production, see `docs/FEATURE_FLAGS.md`). The
`CompositeLayer` changes above are not gated: without zones, hexes behave as before minus the tooltip.

---

## Polyline encoding fix

`services/idealista.ts` rounded each coordinate *delta* to 1e-5, so rounding error accumulated along
the ring and the decoded last point drifted from the first (e.g. `41.41323` vs `41.41321`). Idealista
rejects such unclosed shapes, so links failed at random (more vertices → more likely). Coordinates are
now rounded to integers first and the integer differences are encoded — the ring always closes.

## Removed

- `services/idealistaAreas.ts` (+ test) — barri/geometric decomposition of the isochrone
- `hooks/useIdealistaAreas.ts` (+ test)
- `components/ExportButton/ExportButton.tsx` (+ test) — "Make zones for Idealista"; with it the
  `isLoading` prop of `FilterPanel` (the isochrone loading indicator lived in that button)
- `components/ExportAreasLayer/` — became `BestZonesLayer`
- Store: `idealistaAreas`, `idealistaUrls`, `idealistaZonesVisible`, `hoveredAreaIndex` and setters
- Env: `VITE_IDEALISTA_MAX_AREAS`, `_MIN_AREA_KM2`, `_AREA_RATIO`, `_HOLE_MIN_KM2`,
  `_SIMPLIFY_TOL`, `_MERGE_GAP_DEG`, `_MIN_BBOX_DIM_DEG`
- Deps: `@turf/area`, `@turf/intersect` (only the old decomposition used them)

Kept: `services/idealista.ts` (`buildIdealistaUrl`, `parseIdealistaBaseUrl`),
`store/idealistaBaseUrlStore.ts`, `BaseUrlInput`.

## Architecture

```
frontend/src/
  services/bestZones.ts            — findZoneCells (smoothing, percentile, cores, ties, sticky, growth),
                                     growZone, zoneOutline, findBestZones, allowedCells
  services/idealista.ts            — polyline encoding fix
  hooks/useBestZones.ts            — composite scores (loadBundles + computeComposite) → zones, URLs,
                                     stable numbers; sticky anchor for strictness-only changes
  components/BestZones/
    BestZones.tsx                  — floating bar: Draw ↔ Clear (Esc), auto-redraw on moveend,
                                     visible-area bounds (minus side panels), ⚙ filters, strictness
    BestZonesLayer.tsx             — outlines + numbers, hover highlight, click → Idealista popup
    BaseUrlInput.tsx               — moved from ExportButton/
  components/CompositeLayer/       — hover tooltip removed; zone has priority for hover/click
  components/Map/Map.tsx           — renders <BestZones /> inside MapContext (behind features.bestZones)
  components/Map/layerOrder.ts     — best-zones-* layers replace export-areas-*
  components/FilterPanel/          — ExportButton removed
  store/index.ts                   — bestZonesBounds, bestZonesTopPct, bestZonesRestrict (persisted)
  index.css                        — .best-zones-bar (desktop + mobile)
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_BEST_ZONES_TOP_PCT` | `15` | Default strictness — top X% of visible hexes |
| `VITE_BEST_ZONES_MAX` | `3` | Max number of zones before near-ties |
| `VITE_BEST_ZONES_TIE_RATIO` | `0.9` | Also show areas with mass ≥ this × the last zone's |
| `VITE_BEST_ZONES_MAX_WITH_TIES` | `5` | Hard cap including near-ties |
| `VITE_BEST_ZONES_MIN_CELLS` | `5` | Minimum zone size in hexes (~0.5 km²); smaller cores are grown to it |
| `VITE_BEST_ZONES_BUFFER_DEG` | `0.0006` | Outward buffer before simplifying (~55 m) — smooths hex jaggies |
| `VITE_BEST_ZONES_SIMPLIFY_TOL` | `0.001` | Starting simplification tolerance (~100 m) |
| `VITE_BEST_ZONES_MAX_VERTICES` | `20` | Hard cap on zone vertices — keeps big zones visibly simple |
| `VITE_IDEALISTA_MAX_URL_CHARS` | `900` | Search URL budget (kept from 015) |

---

## Definition of Done

- [x] Unit tests — `bestZones`: smoothing, lone spike ignored, mass ranking, near-ties (up to 5, weak
      4th hidden), viewport + whole-hex rule, score range, stricter = smaller, compact growth,
      never 0 (tiny core grown, boxed-in fallback), uniform area = one zone, zones never touch,
      sticky (keeps place, adds tie, disappears), hole-free closed rings ≤ 20 vertices, URL budget,
      `allowedCells` (isochrone + exclusions, exclusions only) and no zone on a disallowed hex.
      `idealista`: polyline round-trip keeps the ring closed. `useBestZones`: anchor stickiness, new
      view starts fresh, stable numbers (gap, split), isochrone/exclusion restriction on ↔ off.
      `BestZones`: restriction checkbox (on by default), toggle + Esc, auto-redraw on pan,
      side panels excluded, strictness slider, empty state, hover, cleanup. `CompositeLayer`: hover
      outline without tooltip, zone priority for hover and click.
- [x] Integration test: **Draw best zones** → zone on the map → click → popup link with `shape=` and
      the zone's number.
- [x] `npm test` (560), `npm run lint`, `npm run typecheck` — green.
- [x] Manual (`npm run dev` + Playwright): zones over the city and zoomed in, auto-redraw on pan,
      Draw ↔ Clear, Esc, strictness 15 → 10 → 7 → 15 (sticky, numbers keep gaps, no drift), zone
      popup, hex hover/click priority, mobile layout. 17 zone URLs decoded: all rings closed.
- [x] Manual: open zone links in a real browser — Idealista loads the search with the drawn area
      (confirmed by the user; the automated browser gets 403 from Idealista's bot protection).
