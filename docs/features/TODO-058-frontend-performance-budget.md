# TODO-058 — Frontend performance budget: scoring in a worker, code splitting, lazy data, cache headers

**Status:** Partly done. 2026-11-12: scoring in a worker, code splitting, the bundle budget. 2026-11-13: the
start of the page (own copy of the base map style, heavy work after the first paint, lazy columns, no validation
in production, layers set up when first shown); then the score data in two files and the area view of a first visit
precomputed ("As built, part 3"). Still open: cache headers (need 054), Lighthouse ≥ 80 (not reached, see
"As built, part 2"), a real low-end phone, `manualChunks` tuning below 450 KB.
Scale track.

## Problem

Press traffic is mostly mobile. Today `scoreAll` runs 174k buildings on the main thread (~0.2–0.4 s on a
laptop, likely 1–2 s on a cheap phone), on load and after each settings change; the UI freezes meanwhile.
The bundle includes MapLibre, Mantine, turf (buffer, simplify, union, difference), h3-js and the pins/
screenshot code paths (dead-code eliminated only partly). `buildings-scores.bin.gz` (1.8 MB) is fetched before
anything is coloured. No measurement exists: no bundle report, no Lighthouse run.

## Decision

- **Measure first**: `rollup-plugin-visualizer` report and Lighthouse (mobile, slow 4G) recorded in
  `local-docs/architecture/07-perf-baseline.md`. Budgets after that, proposed: JS ≤ 450 KB gzip initial,
  first map paint ≤ 2.5 s on slow 4G, rescoring off the main thread.
- **Scoring in a Web Worker**: `scoreAll` moves to `workers/score.worker.ts`; the worker owns the decoded
  columns; the main thread sends settings and receives `{ score, gap }` as transferable `Uint8Array`s. 051's
  per-component arrays and area ranking run in the same worker.
- **Code splitting**: dynamic `import()` for best zones (h3 + turf), the exclusion drawing (terra-draw), pins
  and the building card; flagged-off features must not be in the public chunk graph (check the report).
- **Data**: `buildings-scores.bin.gz` fetched with `fetchpriority=high` right at startup (not on first
  layer show); `buildings-meta.json` inlined into the HTML at build or preloaded; the PMTiles header
  prefetched.
- **Cache headers** (054): hashed asset names already from Vite → `immutable`; `index.html` `no-cache`;
  data under versioned paths `immutable`.
- **Low-end check**: one real cheap Android phone (or Chrome CPU 4× throttle) in the DoD.

## Spec

- `frontend/src/workers/score.worker.ts` + `services/buildings/scoreClient.ts` (`init(data)`,
  `score(settings) → Promise<{score, gap, components?}>`), Vite worker import (`?worker`). Fallback to the
  main thread when `Worker` is unavailable (tests, jsdom).
- `BuildingsLayer`: uses `scoreClient`; the 150 ms debounce stays; `useBestZones` reads the result as today
  from the store.
- `vite.config.ts`: `build.rollupOptions.output.manualChunks` for `maplibre-gl`, `@mantine/*`, `h3-js` +
  turf, `terra-draw`; the visualizer plugin under `ANALYZE=1`.
- `index.html`: `<link rel="preload" as="fetch" href="…/buildings-scores.bin.gz" crossorigin>` via a tiny
  Vite plugin that reads the manifest (054).
- `ARCHITECTURE.md`: a "Performance" section with the budgets.

## Tests

- `scoreClient.test.ts`: fallback path gives the same arrays as `scoreAll`; worker path mocked with the
  same contract.
- `buildingScore.test.ts` unchanged (pure).
- CI: `npm run build` + a size check script failing when the initial JS exceeds the budget
  (`scripts/check_bundle_size.mjs`, budget in `package.json`).

## Definition of Done

Per `CLAUDE.md`, plus: Lighthouse mobile performance ≥ 80 on the public map; moving a condition picker does
not drop frames (DevTools performance trace attached in `local-docs/architecture/07-perf-baseline.md`).

## As built (2026-11-12)

Measured on a laptop, `npm run build` + the dev server; numbers in `local-docs/architecture/07-perf-baseline.md`.

- **Scoring in a worker.** `workers/score.worker.ts` (5 KB: only the pure scoring code, no h3-js) owns its own copy of
  the score columns; `services/buildings/scoreClient.ts` hands it the raw blob once (transferred, not copied:
  `buildingData.takeRawScores()`) and then sends only the settings. The score of every building (and the score of
  each condition for the area ranking) comes back as transferable `Uint8Array`s. Where there is no worker (jsdom, an
  old browser, a worker that fails or crashes) the same `scoreAll` runs on the main thread. Of several settings
  changes while one scoring runs, only the newest is computed (the ones in between resolve with `null`), and
  `BuildingsLayer` drops a result that arrives after a newer change. A condition change took a **330 ms** long task
  on the main thread; with the worker it is **50 ms** (applying the changed feature states). The area ranking
  (051) stays on the main thread (a few ms).
- **Initial JavaScript: 647 → 482 KB gzip** (budget 500 KB; the target of 450 is not reached: maplibre 270, mantine
  82, react 54, our code 60, tiles 14). Done by loading later what most visitors never run:
  `Map.tsx` lazy-loads Best zones (h3-js 64 KB, turf), the isochrone, exclusion and pin layers and the Idealista
  layer; `terra-draw` (23 KB) is only loaded with the exclusions flag; `@turf/buffer` is imported where a street is
  buffered; `services/bestZonesConfig.ts` (strictness steps, `Bounds`) and `services/exclusionsGeometry.ts` (turf
  union / difference) are split from the code that needs only a constant or a point test; `bestZoneGrid.ts` (h3)
  is split from `buildingScore.ts`. With the new panel Best zones is mounted when the zones are asked for.
- **Budget check:** `npm run check:bundle` (after `npm run build`) sums the gzip size of the scripts and modulepreload
  links of `dist/index.html` against `bundleBudget.initialJsGzipKB` in `package.json`; the deploy workflow runs it
  after the build and fails when the budget is exceeded.
- Not done: `rollup-plugin-visualizer` (the sizes come from the vendor groups in `vite.config.ts`, `build.rolldownOptions
  .output.codeSplitting`); the `fetchpriority=high` preload of the score blob and the inlined `buildings-meta.json`;
  cache headers; Lighthouse; a low-end phone.

## As built, part 2 (2026-11-13): the start of the page

Measured on the production build (`vite preview`), Chrome with the CPU slowed 4 times, the old and the new build
side by side; numbers in `local-docs/architecture/07-perf-baseline.md`.

| CPU 4× slower, fast network | Before | After |
|---|---|---|
| First paint (median of 7) | 144 ms | 168 ms |
| Largest paint (median of 7) | 244 ms | 168 ms |
| Base map ready | 1.3–3.6 s | 0.6–0.7 s |
| Buildings coloured | 2.4–4.7 s | 1.4 s |
| Main thread blocked in the first 3.5 s (long tasks over 50 ms, median of 7) | 870 ms | 360 ms |
| Longest task (median of 7) | 520 ms | 245 ms |
| Downloaded for the first view (mobile) | 8.3 MB | 7.3 MB |

| CPU 4× slower, slow 4G | Before | After |
|---|---|---|
| First paint | 3.2 s | 2.2 s |
| Base map ready | 6.8 s | 5.6 s |
| Buildings coloured | 19.6 s | 20–24 s |

What was found and changed:

- **The base map style was 760 KB, uncompressed, and downloaded twice** (once to check that ICGC is up, once by
  MapLibre). Now the app has its own copy (`public/basemap/icgc-standard.json`, ~55 KB gzipped,
  `npm run update:basemap`), preloaded by `index.html`; ICGC is checked with a HEAD request; the OpenFreeMap
  fallback is unchanged. `services/mapStyle.ts`.
- **MapLibre validated 900 layers at start, and again for each of our ~20 layers.** Off in the production build
  for our copy of the style and in `addLayerOrdered`; on in development and tests.
- **Scoring no longer waits for the map**, and the building source is added before the scores arrive.
- **The page no longer decodes all 33 columns** on the main thread (it did, and the worker did it again):
  `lazyColumns`. The worker gets a copy of the blob (8 MB) in place of the transferred original.
- **MapLibre is in its own chunks** (dynamic import of `Map.tsx`; preloaded and counted in the budget), and **heavy
  start-up work waits for the first paint** (`services/firstPaint.ts`): the map, the style, the scores.
- **Layers that are off at start are set up when first shown** (noise, river floods, street flooding, wildfire, POI),
  and no building tiles are fetched while the area view is shown. Metro and FGC are set up 300 ms after the map.
- **Labels of our layers asked for a font list that both glyph servers answer with 404**, so MapLibre drew every
  letter itself on the main thread. Now one font (`MAP_TEXT_FONT`): the labels are real Noto Sans.

Tried and dropped:

- **Preloading the score blob from `index.html`.** On slow 4G the buildings were coloured at 17.6–24 s (no clear
  gain: everything shares the connection), and with a fast network and a slow CPU the first paint moved from 160
  to 384 ms. Only the small files are preloaded (style, meta).
- **Applying the new scores in portions, one per frame.** No measurable difference: after a change of a condition
  our code takes ~25 ms, the rest is MapLibre repainting the changed buildings.

Not reached, with the reason:

- **Lighthouse mobile ≥ 80.** With real throttling (slow 4G, CPU 4×) the page does not come to rest within
  Lighthouse's limit, before and after; the one complete run of the old build scored 42. Lighthouse's default
  simulated mode is of no use here (it reports a largest paint of 15 s where the browser measured 0.2–1 s).
- **On a slow network the time to coloured buildings is not better** (20–24 s, before 19.6 s; the runs differ by
  several seconds): it is set by the bytes, not by the code. The first mobile view downloads 7.3 MB: ICGC vector
  tiles 2.7 MB, the score blob 1.8 MB, ICGC fonts 0.8 MB, terrain tiles 0.6 MB, JavaScript 0.5 MB. The base map
  now starts a second earlier, so its tiles compete with the scores sooner.

Proposed next, each needs a decision (1 and 2 done in part 3):

1. **A smaller score blob** (data pipeline, `build_building_tiles.py`). `lng` and `lat` are 40% of it (729 of
   1803 KB) and scoring does not read them: in a file of their own the map is coloured after ~1.07 MB. Storing
   each column byte by byte (bytes of the same weight together) before gzip takes another 15%, without loss.
2. **Area colours for the default settings, precomputed** (a few KB): the first view (areas, zoom 12) is then
   coloured without the blob.
3. **No terrain shading in the base map** (two hillshade layers in our copy of the style): 0.6 MB and the decoding
   of the elevation tiles. Changes how the hills look.
   **Decided 2026-11-13: keep the terrain shading**, the relief should stay visible. Don't propose it again.
4. **Cache headers** (054). GitHub Pages serves everything with 10 minutes; the data files need a host that can
   say `immutable`.

## As built, part 3 (2026-11-13): smaller score data, the area view precomputed

**The score data in two files** (`scripts/building_blob.py`, format 2 of `buildings-meta.json`):
`buildings-scores.bin.gz` holds what the scoring reads (998 KB), `buildings-positions.bin.gz` the positions (532 KB).
Columns of more than one byte are stored as byte planes, so gzip packs them better. 1807 KB → 998 + 532 KB; the map
is coloured after 998 KB. The files in git were converted with `python3 scripts/building_blob.py --repack` (no
pipeline run; every column reads back bit for bit). `build_building_tiles.py` writes format 2 from now on. The app
still reads format 1.

- `loadScores()` (scoring, budget shares) and `loadBuildings()` (adds the positions to the same object: the card,
  the facade points, Boost contrast, best zones). The positions are asked for after the scores, and only when one of
  these needs them: a first view never downloads them.
- `main.tsx` starts `loadScores()` right after the first paint. It used to start when `BuildingsLayer` mounted, that
  is after MapLibre (270 KB) had arrived: 4.7 s on slow 4G.
- The worker gets the scores file only and no longer decodes the positions.

**The area view of a first visit, precomputed.** `npm run build` ends with `scripts/build-area-start.mjs`: it runs
the app's own code (`services/areas/areaStart.ts`, through Vite's `runnerImport`) on the data files and writes
`dist/data/area-start.json`, 6 KB gzipped: which polygon of `areas.geojson` each area is (108 of 113), and the area
ranks for the settings of a first visit. `index.html` preloads it.

- The join always comes from the file: the area view needs neither the positions nor the scores.
- The ranks are used while nothing is scored yet and the settings are those of a first visit (`settingsKey()` of
  `services/buildings/firstVisit.ts`, the defaults the store starts from too; a test checks that they agree).
  The scoring replaces them a moment later with the same values. With other settings, Boost contrast, or a stale
  file (`generated` / `count` differ from `buildings-meta.json`) the file's ranks are not used.
- Generated at build time, not committed: it cannot go stale with a code change. The dev server has no file and
  computes as before.

Measured (production build, CPU 4× slower; a first visit at zoom 12, the area view):

| | Part 2 | Part 3 |
|---|---|---|
| Areas coloured, fast network | 1.4–1.5 s (with the buildings) | 0.66–0.97 s |
| Areas coloured, slow 4G | 20–24 s (with the buildings) | **6.2 s** (0.1 s after the base map) |
| Buildings coloured, fast network | 1.4 s | 1.2–1.3 s |
| Buildings coloured, slow 4G | 20–24 s | 19.8 s (the scores share the connection with ICGC's tiles) |
| Main thread blocked (long tasks over 50 ms) | 720–760 ms | 280–330 ms |
| Score data downloaded for the first view | 1.8 MB | 1.0 MB |

Checked in the browser: the area view of a first visit from the file without the positions; with other settings
(`?c=p:…`) the areas wait for the scoring and the positions are still not loaded; a click on a building loads the
positions and opens the card; Boost contrast loads them and fits the scale.

Licences: `docs/DATA_LICENSES.md` lists the copy of the ICGC style, `buildings-positions.bin.gz` and
`area-start.json`.

