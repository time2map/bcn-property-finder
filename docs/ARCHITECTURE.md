# Architecture

Synced with the code on 2026-11-11. If code and this file disagree, the code wins: fix this file.

## Overview

The app is a static single-page app. Everything the public site needs is precomputed offline by the Python
pipeline and served as static files (PMTiles, a binary score blob, JSON). Scores are computed in the browser
from those files, so changing a setting recolours ~174k buildings without any server call.

The personal comparison mode (isochrone, pins, screenshots) is behind feature flags. It is the only part that
needs a backend: OpenTripPlanner 2 in Docker, plus Geoapify / Overpass / Anthropic for pins.

```
                 OFFLINE (scripts/, Python)                         RUNTIME (browser)
 ┌──────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
 │ Catastro INSPIRE ─► prepare_buildings.py      │   │ React SPA (Vite)                              │
 │ noise rasters / SICA ─► building_exposure.py  │   │  BuildingsLayer: scoreAll() over every        │
 │ climate-risk sources ─┘    │                  │   │  building → MapLibre feature state            │
 │ OSM PBF ─► building_access.py (pandana)       │   │  BuildingCard: buildings-detail.pmtiles       │
 │ INCASOL prices ─► bcn_prices.gpkg             │   │  + Catastro DNPRC + facade photo              │
 │            ▼                                  │   │  BestZones: building scores → H3 cells        │
 │ build_building_tiles.py ──────────────────────┼──►│  → zones → Idealista links                    │
 │ build_neighbourhood_vibe.py ──────────────────┼──►│                                               │
 │ climate_risk.py (view layers) ────────────────┼──►│  Flagged: isochrone (OTP2), pins (OTP2,       │
 │ prepare-noise-data.sh, extract_poi.py ────────┼──►│  Geoapify, Overpass, Anthropic Vision)        │
 └──────────────────────────────────────────────┘   └───────────────────────────────────────────────┘
                frontend/public/data/*  (committed, ~88 MB)  +  frontend/public/barcelona_poi.pmtiles
```

## Repository layout

```
bcn-livability/
├── frontend/                React SPA (see below)
├── backend/                 OTP2 via Docker Compose: personal mode only, not deployed
│   ├── docker-compose.yml   opentripplanner 2.5.0, port 8080, -Xmx2g, --load --serve
│   └── otp/
│       ├── download-gtfs.sh GTFS feeds (TMB credentials from backend/.env)
│       └── data/            otp-config.json, router-config.json (committed); GTFS zips, OSM PBF, graph (gitignored)
├── scripts/                 offline data pipeline (Python, plus two shell scripts and one Node script); tests: scripts/test_*.py
├── data/                    raw and intermediate datasets (gitignored as a whole)
├── docs/                    product brief, architecture, design, flags, features/, RAW_IDEAS.md, MS1-Plan.md
├── seo/keywords.md          SEO keyword research
├── local-docs/              personal notes and drafts (gitignored)
└── .github/workflows/deploy.yml   GitHub Pages deploy on every push to main
```

## Deployment

- **Production:** https://livability.time2map.com, on GitHub Pages (`frontend/public/CNAME`). Every push to `main`
  runs `npm ci && npm run build` in `frontend/` and publishes `frontend/dist`. There is no staging.
- **Build config:** `frontend/.env.production` (committed, public values only). The TMB keys are injected from
  repo secrets `VITE_TMB_APP_ID` / `VITE_TMB_APP_KEY`; without them the metro layer just doesn't load.
- **Not deployed:** OTP2, so the isochrone and pin travel times cannot work in production; their flags are off
  there. The Idealista price-dot file is gitignored, so that layer is local-only.
- **Planned (scale track, TODO-054…058):** our own server as origin behind a CDN cache, data under versioned
  immutable paths, own basemap, static metro, CI gate and branch previews. Until then the above is what runs.
- **Bundle:** with `VITE_FEATURE_SCREENSHOT` off, the dynamic import of the Anthropic provider is
  dead-code-eliminated, so the SDK and the key never ship (`services/vision/visionService.ts`).

## Frontend (`frontend/src/`)

Stack: React 19, Vite 8, TypeScript 5.6, MapLibre GL 6 (ESM-only; the worker URL is set explicitly in
`Map.tsx`), Mantine 9, Zustand 5, `pmtiles`, `h3-js`, Turf, `terra-draw`. Tests: Vitest + Testing Library +
jsdom (`src/test/setup.ts`, `src/test/fakeVectorMap.ts`). `.env.test` turns every feature flag on so the
suite covers the flagged code.

```
src/
├── main.tsx                 registers the pmtiles:// protocol; Mantine theme (brand colour #F06965, IBM Plex Sans)
├── App.tsx                  layout: desktop = top-left panel (BrandBar + FilterPanel) over the map, ComparePane
│                            on the left when pins are on; mobile = map + bottom sheet (MobileSheet), search pill,
│                            map buttons (TODO-062), Map/Compare toggle
├── i18n/                    i18next setup (TODO-065): languages.ts (ENV list, resolveLanguage), index.ts (init, setLanguage, tIn),
│                            namespaces.ts; texts in src/locales/<lang>/<ns>.json, see docs/TRANSLATING.md
├── features.ts              feature flags from VITE_FEATURE_* (see docs/FEATURE_FLAGS.md)
├── components/
│   ├── Map/
│   │   ├── Map.tsx                basemap (services/mapStyle.ts), click handling, Daily trip marker (078),
│   │   │                          mounts every layer component (those that are off at start: when first shown)
│   │   ├── MapContext.ts          React context with the MapLibre map instance (useMap)
│   │   ├── MapContextMenu.tsx     right-click → "Open in Google Maps" popup
│   │   ├── useCommutePick.ts      "Pick on the map" for the Daily trip place: crosshair, next click, Esc (078)
│   │   ├── googleMapsUrl.ts       Google Maps URL for a coordinate
│   │   ├── layerOrder.ts          canonical bottom-to-top z-order; addLayerOrdered()
│   │   └── visibleBounds.ts       viewport minus the left panel, the right building card and the bottom onboarding sheet
│   ├── BrandBar/                  time2map mark (link to time2map.com) + the page <h1> + language menu (LanguageSwitcher/) + Share (copy / share sheet) + search button
│   ├── Conditions/                the sentence editor (TODO-031; 052 moves it into the panel for good)
│   │   ├── ConditionsEditor.tsx   numbered sentence rows in priority order, "+ add" chips, match bar; adds / removes a
│   │   │                          condition with one `applySettings`
│   │   ├── SentenceRow.tsx        one condition as a sentence; its highlighted words are the controls
│   │   ├── WordPicker.tsx / OptionList.tsx / CheckList.tsx   a tappable word → popover with verbal steps and
│   │   │                          "Custom…" (slider, ranges from `CONDITION_RANGES`), or a checklist (services, places, eras)
│   │   ├── AddConditionChips.tsx, MatchBar.tsx   conditions not on yet; share of homes per match band
│   ├── AreasLayer/                area view below z13 (TODO-051): barris and municipalities coloured by mean score, hover, click
│   ├── AreaCard/                  card of a clicked area (TODO-064): description, shares, Save image, Share (lazy-loaded)
│   ├── AreasList/                 "Your areas": ranked list (top 10, show all), click flies to the area
│   ├── Onboarding/                OnboardingPanel (profiles → sentence → "Show me the map"), PresetCards
│   ├── FilterPanel/
│   │   ├── YourConditionsRow.tsx  "Your conditions … Start from a profile" at the top of the panel (flag)
│   │   ├── MapLayersControl.tsx   None · Noise · River floods · Street flooding · Wildfire, one at a time, with its legend (052)
│   │   ├── MatchColoursSwitch.tsx "Show match colours" + (i) → LivabilityInfoModal; AdvancedSettings.tsx: risk strengths
│   │   ├── StrengthRow.tsx, LivabilityInfoModal.tsx   moved out of CompositeControls (shared by both panels)
│   │   ├── FilterPanel.tsx        commute slider (flag), Idealista price controls (flag), exclusion controls (flag),
│   │   │                          noise switch + legend, climate layers, Livability controls, map attribution
│   │   ├── CompositeControls.tsx  Livability Index switch + info modal; one row per condition (checkbox, slider in
│   │   │                          real units, sentence); gear modals for services, landmarks, building eras;
│   │   │                          risk-penalty strengths (1–10, shown in words); colour legend
│   │   ├── ClimateLayerControls.tsx  River flood zones / Street flooding / Wildfire hazard switches + legends
│   │   └── ExclusionControls.tsx  exclusion zones: show/hide, area picker, draw polygon / freehand, list
│   ├── BuildingsLayer/
│   │   ├── BuildingsLayer.tsx     Livability Index on buildings: dots at z≤13, footprints from z14, colour from
│   │   │                          feature state; gap outline (missing data), hover/selected outline; click → card
│   │   ├── FacadeNoiseLayer.tsx   noise circles at the facades of the selected building (z≥15)
│   │   ├── CompositeLegend.tsx    legend: four match bands (050)
│   │   └── scoreRamp.ts           RdYlGn ramp on the fixed 0–100 (`FIXED_RANGE`, 050)
│   ├── MobileSheet/               phone bottom sheet (TODO-062): MobileSheet.tsx (peek / half / full, native pointer
│   │                              drag, slots for the card), ConditionsSheetHeader.tsx, sheetSlots.ts
│   ├── MobileTop/                 MobileTopBar.tsx (search pill), AboutSheet.tsx
│   ├── MobileMap/                 MapOverlay.tsx, LocateButton.tsx ("Where am I"), MobileLegend.tsx
│   ├── BuildingCard/              card of the clicked building (`embedded` = inside the sheet): address, facade photo (flag), Catastro link, facts,
│   │                              below-ground uses, per-condition scores, noise by facade side, climate risk,
│   │                              Barri-level / Municipality-level block (price, "What locals say");
│   │                              MatchHeader.tsx on top: band, a row per condition, risk line (050)
│   ├── SearchBox/
│   │   ├── SearchBox.tsx          "Search a neighbourhood or address": areas (areaSearch) + Geoapify address suggestions
│   │   │                          (debounced); writes the pick to searchStore. Top-left panel, under the brand bar
│   │   └── SearchLayer.tsx        map side: area → fitBounds + blue outline; address → flyTo + temporary marker; Esc clears
│   ├── BestZones/
│   │   ├── BestZones.tsx          map side: draws the zones, follows the map, Esc clears, reports their count to the store;
│   │   │                          the floating bar (Draw / Clear, strictness slider, ⚙ Idealista filters, commute-zone
│   │   │                          checkbox) only with `withBar`, i.e. while the onboarding flag is off
│   │   ├── BestAreasControls.tsx  the same controls inside the filter panel (052): Show my best areas, Fewer / More areas
│   │   ├── BestZonesLayer.tsx     dashed outline + number; click → "Open zone N in Idealista" popup
│   │   ├── BaseUrlInput.tsx       saved Idealista search URL (its filters are reused by zone links)
│   │   └── inBestZone.ts          a click inside a zone belongs to the zone, not to the building under it
│   ├── NoiseLayer/                noise.pmtiles (Barcelona 2022 Lden isophones), off by default; legend + info
│   ├── FloodZonesLayer/           flood-zones.pmtiles, ACA T10/T100/T500; legend + info
│   ├── StreetFloodingLayer/       street-flooding.pmtiles, RESCCUE depth classes, T10/T100 switch; legend + info
│   ├── WildfireLayer/             wildfire.pmtiles, hazard classes 1–10 + WUI outline; legend + info
│   ├── LandmarksLayer/            markers of the chosen City Core places (only while that condition is on)
│   ├── MetroLayer/                TMB API: metro lines + stations (needs TMB keys)
│   ├── FgcLayer/                  FGC lines + stations from static GeoJSON
│   ├── PoiLayer/                  barcelona_poi.pmtiles with Maki icons (essentials from z14, cafés/restaurants z16)
│   ├── IsochroneLayer/            (flag isochrone) mask outside the commute zone, outline, "N min from work" label
│   ├── ExclusionLayer/            (flag exclusions) grey fill + outline of no-go zones
│   ├── ExclusionDraw/             (flag exclusions) terra-draw polygon / freehand drawing
│   ├── IdealistaPricesLayer/      (flag idealistaPrices) scraped price dots, price window slider, colour ramp
│   ├── WalkabilityLayer/          (flag pins) walking-time markers of the selected pin's nearest services
│   └── PropertyPins/              (flag pins) PinLayer, PinAccuracyLayer (geocode accuracy area), ComparePane
│                                  (resizable), CompareGrid (sortable table, editable fields, rating, "In excluded
│                                  area" badge), AddPinButton, ScreenshotDropZone, PhotoLightbox, compareHighlight
├── hooks/
│   ├── useUrlState.ts        store → URL: minutes, zoom, cx, cy at once, `c` (all settings) 300 ms after a change (replaceState). Read once at startup by the store
│   ├── useIsochrone.ts       (flag) workplace + minutes → OTP isochrone, 300 ms debounce, localStorage cache
│   ├── useEffectiveArea.ts   isochrone minus exclusion zones (the mask, the commute zone of 077); null with the flag off
│   ├── usePinAnalytics.ts    per pin: OTP walk / bike / car / transit times, noise Lden, nearby services
│   ├── useScreenshotDrop.ts  drop an image (Claude Vision) or a saved Idealista .html page (HTML parser) → pin
│   ├── useSplitPane.ts       compare-pane width + collapse
│   └── useBestZones.ts       building scores → mean per res-9 H3 cell → findZoneCells → outlines + Idealista URLs
├── store/
│   ├── mapStore.ts            the map instance, for UI outside the map context (Best areas needs visibleBounds)
│   ├── searchStore.ts         the search pick (area outline + bounds, or address point); read by SearchLayer
│   ├── index.ts              main Zustand store (see "State and persistence")
│   ├── pinsStore.ts          pins, add-pin mode; localStorage
│   ├── exclusionsStore.ts    no-go zones, drawing mode, visibility; localStorage
│   └── idealistaBaseUrlStore.ts  saved Idealista search URL; localStorage
├── services/
│   ├── urlConfig.ts           `c` in the address (053): decodeConfig / encodeConfig / withConfig / shareUrl, pure, defaults injected
│   ├── conditionOptions.ts    sentence-editor words (TODO-031): verbal steps from VITE_QUIZ_*, risk levels, which conditions are
│   │                          on and in what order, profileToPatch(), budget shares ("≈ N % of homes")
│   ├── areas/                 areaRank.ts (per-area aggregation of the building scores), areaJoin.ts (area → polygon by position),
│   │                          areaJoinLoader.ts, areaStart.ts (precomputed join and first-visit ranks, area-start.json),
│   │                          areaSelect.ts (fly to + outline through the search store)
│   ├── buildings/scoreClient.ts  scoring in the worker (hand-over of the raw blob, newest request wins, main-thread fallback);
│   │                          scoreProtocol.ts: the messages. The worker itself: src/workers/score.worker.ts
│   ├── shareImage/            share pictures (TODO-063): shareImageModel.ts (what a picture says, pure), shareImageDraw.ts (Canvas 2D,
│   │                          browser and Node), captureMap.ts + shareImageBrowser.ts ("Save image": live-map snapshot, share sheet /
│   │                          download), shareImageAreaMap.ts + shareImageRender.ts + shareImageBuild.ts (build-time pictures and pages)
│   ├── buildingLink.ts        the link to one building (`b=lng,lat`, TODO-064); areas/areaLink.ts: the link of an area card;
│   │                          areas/areaDescriptions.ts: loads the barri texts of `locales/<lang>/areas.json`; areas/areaCardText.ts: the numbers line
│   ├── presets.ts             the four profiles (Family, Remote worker, City life, Retiree) + JSON overrides from ENV
│   ├── buildings/
│   │   ├── buildingData.ts    loads buildings-meta.json, the scores file, then the positions file → decoded Float32 columns
│   │   ├── firstVisit.ts      the settings of a first visit (store defaults, area-start.json) and settingsKey()
│   │   ├── buildingScore.ts   columns → condition scores + risks for one building; scoreAll(); H3 cell means
│   │   ├── inArea.ts          building centroids inside the commute zone → Uint8Array mask (077)
│   │   ├── conditions.ts      conditions in real units (049): defaults, slider ranges, atMost / atLeast, minutesShare
│   │   ├── buildingAge.ts     eras from VITE_AGE_ERA_BOUNDS, ageScore() (047)
│   │   ├── buildingDetail.ts  one building's card fields + facade noise points from buildings-detail.pmtiles (z14)
│   │   ├── address.ts         Catastro address → readable; Catastro page and facade photo URLs
│   │   └── catastroUnits.ts   Catastro DNPRC (open, CORS, one call per card): uses of the floors below ground
│   ├── composite/compositeScore.ts  computeComposite(): mean over the conditions that are on, then risk penalties
│   ├── match/                 matchSummary.ts: bands, conditionStatus(), matchSummary(), riskLine(), tooltip text;
│   │                          matchText.ts: short row texts of the card header (050)
│   ├── climateRisk/climateRisk.ts   floodRisk / fireRisk / streetFloodRisk (0–1), applyRiskPenalties()
│   ├── localsOpinion/localsOpinion.ts  barri-vibe.json loader, topProblems() (042)
│   ├── cityCore/landmarks.ts  the 13 City Core places (ids match the cc_<id> columns)
│   ├── walkability/           pins only: live POI lookup in barcelona_poi.pmtiles, decay + saturation score,
│   │                          service categories (the 10 categories also name the min_<id> building columns)
│   ├── noise/                 noiseData (pin Lden from noise.pmtiles z14), noiseScore (pins), noisePalette
│   │                          (official colours), pmtilesProtocol
│   ├── bestZones.ts           smoothing, strictness threshold, components, growZone, zone outline ≤ 20 vertices
│   ├── idealista.ts           polygon → encoded polyline → Idealista `shape` URL; base URL parsing
│   ├── otp.ts                 OTP2 REST: plan (durations, all modes) + traveltime/isochrone (WALK,TRANSIT)
│   ├── analytics.ts           pins: travel index + pin composite score
│   ├── geocoding.ts           Geoapify search inside the metro bbox; for street-level hits, the whole street
│   │                          from Overpass buffered by 80 m as the accuracy area
│   │                          searchAddresses: Geoapify autocomplete for the search box (no key → no suggestions)
│   ├── areaSearch.ts          searchAreas (accent/article-insensitive ranking over areas + colloquial aliases), areaIdsBounds
│   ├── areaAliases.ts         colloquial names (El Born, Poblenou, …) → official barri ids
│   ├── searchConfig.ts        search ENV settings (min chars, debounce, max results, address zoom)
│   ├── phoneConfig.ts         phone ENV settings (nearest-home radius for "Where am I", tap tolerance)
│   ├── sheetSnap.ts           sheet heights and where a released drag settles
│   ├── locate.ts              nearest home to a point, coverage box, nearest of the homes under a tap
│   ├── exclusions.ts          subtractExclusions (Turf union + difference), isPointInExclusions
│   ├── areas.ts               areas.geojson (districts, barris, AMB municipalities) for the exclusion picker
│   ├── idealista/idealistaRawData.ts  loads data/idealista_prices.geojson (local only)
│   ├── parser/IdealistaHTMLParser.ts  saved Idealista listing page → price, area, rooms, floor, photos, …
│   ├── vision/                visionService (flag gate, dynamic import), anthropicProvider (Claude Vision), types
│   └── imageUtils.ts          image compression, base64
└── types/                     pins.ts (PropertyPin, PinAnalytics), exclusions.ts, IdealistaProperty.ts
```

Map layers are stacked by `layerOrder.ts`, from the bottom: buildings → noise → climate view layers → facade
circles → exclusions → best zones → Idealista prices → isochrone → transit → POI → walkability markers → pins.

## Match score on buildings (public core; features 022, 046, 047, 049, 036, 037, 042, 073)

The score was called the Livability Index until 073; the code keeps the old names (`composite*`, `poiAccess`).

### Data the browser loads

| File (`frontend/public/data/`) | Size | Content | Built by |
|---|---|---|---|
| `buildings.pmtiles` | 26 MB | layer `b`, feature id = row: centroid points z10–13, footprints z14–16 (`ref`, `floors`, `h`) | `build_building_tiles.py` |
| `buildings-scores.bin.gz` | 1.2 MB | one typed array per score column, 173,634 rows; multi-byte columns as byte planes (`scripts/building_blob.py`) | `build_building_tiles.py` |
| `buildings-positions.bin.gz` | 0.5 MB | `lng`, `lat` (f32, byte planes) | `build_building_tiles.py` |
| `buildings-meta.json` | 12 KB | format 2: columns (type, scale, offset, sentinel, file, layout), 113 areas (barri / municipality, name, INCASOL €/m²), categories, landmarks, `minutes_cap` (how far the minutes columns reach, 073) | `build_building_tiles.py` (`building_blob.py --repack` converts format 1 without the pipeline) |
| `buildings-detail.pmtiles` | 18 MB | z14 only: layer `d` card fields per building, layer `f` facade noise points | `build_building_tiles.py` |
| `barri-vibe.json` | 21 KB | ESM residents' survey per barri (042) | `build_neighbourhood_vibe.py` |

**Versioned addresses** (073, `src/services/dataUrl.ts`): the building files above, `areas.geojson` and
`area-start.json` are fetched as `data/<name>?v=<hash>`. The hash is the SHA-1 of their contents
(`scripts/dataVersion.mjs`, computed by `vite.config.ts` and set as `VITE_DATA_VERSION`; the `index.html` preloads get
the same address). A deploy with new data is a new address, so a browser never mixes a cached old file (GitHub Pages
caches for 10 min) with new ones read by the same building row.

Score columns: `lng`, `lat`, `lden_avg`, `lden_street` (073), `river_zone`, `street_t10_cm`, `street_t100_cm`,
`fire_hazard`, `fire_wui`, `area`, `year_built`, `dwellings` (≥ 1, 073), `min_<category>` (10 walking-minute
columns), `cc_<landmark>` (13 walking-minute columns). The shipped files got `lden_street`, `dwellings` and
`minutes_cap` from `scripts/add_073_columns.py` (read from the card tiles); the next full run writes them directly.

### Score of one building

`BuildingsLayer` loads the data the first time the index is shown and calls `scoreAll()` (about 0.4 s). Only
buildings whose score changed get a new feature state. Changes to the settings are debounced by 150 ms.

1. **Conditions** (`services/buildings/conditions.ts`). Each is 100 when the building meets it and falls linearly
   to 0 over the fall-off:

   | Condition | Input | Default limit | Score 0 at | On by default |
   |---|---|---|---|---|
   | `poiAccess` (Services on foot) | `min_<category>` of the services the user keeps (default: all but the beach) | 10 min | 2× the limit, or the reach of the data (`minutes_cap`) if sooner (per service; score = mean over services) | yes |
   | `noise` (Noise on the street side) | `lden_street`, else `lden_avg` (no street side) | 65 dB | +10 dB | yes |
   | `cityCore` (City Core Access) | `cc_<landmark>` of the places the user keeps (default: Plaça Catalunya, Barri Gòtic, Passeig de Gràcia) | 30 min | 2× the limit, or the reach of the data if sooner (per place) | yes |
   | `openPrice` (Market Price) | INCASOL €/m² of the barri / municipality | €4,000/m² | +25 % | yes |
   | `localsOpinion` (flag) | satisfaction 0–10, shrunk to the gran barri for small samples | 7.5 | 1 point below | no |
   | `age` (Building age) | `year_built` against the liked eras | eras 1900/1940/1980/2007 | outside a liked era, fading over 5 years | no |

   A service or place out of reach (null) counts 0. Catastro's `1900` (unknown old year) counts for both
   neighbouring eras.
2. **Mean** over the conditions that are on, all with equal weight (`compositeWeights` is 1 / 0 since 049; old
   stored weights of 1–10 are read as "on"). A condition that is on but has no data makes the score a range (060):
   it counts 0 for `scoreMin` and 100 for `score` (073), sets `hasGap` and draws the hatch. A small Locals'
   opinion sample also sets `hasGap`.
3. **Climate-risk penalties** (`services/climateRisk`):
   `score = base × (1 − sFlood/10·flood) × (1 − sFire/10·fire) × (1 − sStreet/10·street)`. Strengths are 0–10
   (default 5, the panel slider is 1–10, unchecked = 0).
   - River flood: the ACA zone the footprint touches; band penalties T10 = 1, T100 = 0.27, T500 = 0.06 (the chance
     of a flood within 30 years, 073).
   - Wildfire: WUI × distance-decayed forest hazard.
   - Street flooding: water depth at the door (Barcelona only), 0 at ≤ 10 cm and 1 at ≥ 50 cm, banded like the
     river zones (T10 fully, the extra part of T100 at 0.27).
   - **Budget ceiling** (073, `VITE_BUDGET_HARD`): with the budget on and priced, the final score is at most
     `64 + 36 × p / 100` (p = the budget score; 64 = the top of "Partial"), so a home over the budget is at most a
     partial match. `budgetCap` is the points it took.
4. **Colour** (050): the RdYlGn ramp is fixed on 0–100, so a building is the same colour anywhere on the map.
   The legend names four bands (Great ≥ 85, Good ≥ 65, Partial ≥ 40, Poor; `VITE_MATCH_BANDS`). It never follows
   the visible area (032 deprecated, Boost contrast removed in 077); with an isochrone it is stretched over the
   commute zone (`fitScoreRange`: buildings inside → `compositeColorRange`, areas over their means), and the legend
   is a "Worse → Better" gradient (`CompositeLegend` under "Show match colours", `MobileLegend`).
   **Commute zone** (077, `VITE_FEATURE_ISOCHRONE`): with an isochrone drawn, the area is `useEffectiveArea()` (the
   isochrone minus exclusion zones). `inArea()` (`services/buildings/inArea.ts`) marks the buildings whose centroid
   is inside (positions from `loadBuildings()`); the others get feature state `out` (opacity 0, no hatch, no hover,
   click or tap), `rankAreas` gets a NaN area for them, so the area view and "Your areas" cover the commute zone
   only (`AreasLayer` clears an area without a rank), and best zones search the whole isochrone and stay put.
   **Daily trip** (078): the isochrone is a condition row of the editor (`ConditionKey` `commute`, not a weight; on =
   `workplace` set). "+ Daily trip" starts at `VITE_COMMUTE_DEFAULT_PLACE` in `VITE_COMMUTE_DEFAULT_MINUTES`; the place
   word offers "Pick on the map" (`commutePicking`, `components/Map/useCommutePick.ts`); × = `setWorkplace(null)`,
   which drops `resultPolygon` too. Never in the shareable link.
5. **Hover tooltip** (z14+, not on touch screens): "Good match · 78" (no "meets N of M" count), a MapLibre popup after
   60 ms of rest on a building.

### Building card

Click a building to open `BuildingCard`. It reads one z14 tile of `buildings-detail.pmtiles` and calls Catastro
DNPRC for the uses of the floors below ground. The Catastro facade photo is shown only with
`VITE_FEATURE_FACADE_PHOTO`. Area-only data is labelled **Barri-level** (Barcelona) or **Municipality-level**.
The card opens with `MatchHeader` (050): the band and score (no "Meets N of M" count, removed 2026-11-16) and one row per
condition that is on (✓ met = component 100, ◐ partly = 1–99, ✗ not met = 0, – no data), then the risk line.

### Best zones (038, public)

"Draw best zones" captures the visible area. `useBestZones` averages building scores per res-9 H3 cell
(~0.1 km²). `findZoneCells` then:

1. Smooths each cell with its six neighbours.
2. Keeps the cells in the top X % (strictness).
3. Builds connected components, grows small cores to 5 cells, and keeps a one-cell gap between zones.
4. Returns up to 3 zones, plus near-ties up to 5.

Zones stay in place when only the strictness changes. Each zone is simplified to ≤ 20 vertices so its Idealista
`shape=` URL fits 900 characters. The URL reuses the filters of the saved Idealista search URL. When the isochrone
or exclusions flag is on, zones can be limited to the commute zone and kept outside the no-go zones.

## Personal comparison mode (flagged; features 002–016, 019)

- **Isochrone** (`VITE_FEATURE_ISOCHRONE`). Clicking the map (when no workplace is set) places a draggable
  workplace marker. `fetchOtpIsochrone` calls `GET /otp/traveltime/isochrone` with `modes=WALK,TRANSIT` and a
  15–120 min cutoff (slider, step 5, default 60). Departure is next Monday at `VITE_OTP_DEPARTURE_TIME` in
  Madrid time. Results are cached in localStorage per workplace + minutes. The mask darkens everything outside
  the zone, minus exclusion zones.
- **Pins** (`VITE_FEATURE_PINS`). The ➕ menu offers "Place on map" (next map click; Esc cancels), "Upload photo"
  and "Import Idealista HTML"; files can also be dropped on the map. With the screenshot flag off, an uploaded
  photo is not parsed: the pin keeps the photo at the fallback position.
  Pins are scored with a **different, older model** than the buildings (`services/analytics.ts`):
  - Travel index: for each mode, `max(0, 1 − minutes / 60)^0.7`, weighted walk 4, transit 3, bike 2, car 1, over
    the modes OTP answered.
  - Noise: Lden of the noise isophone at the pin, `clamp(0, 100, (75 − Lden) / 30 × 100)`.
  - Walkability: live from `barcelona_poi.pmtiles`, straight-line distance × 1.3 detour.
    `access = Σ exp(−d / 400 m)` within 1,500 m, `sub = 1 − exp(−access / S_category)`, then a weighted mean.
  - Composite = weighted mean of travel 5, noise 2, walkability 3 over the factors that have data (missing ones
    are skipped, unlike the building index).

  The composite is computed in `CompareGrid`. Pins inside an exclusion zone get a badge and a dimmed marker.
- **Screenshot / HTML drop** (`VITE_FEATURE_SCREENSHOT` gates the drop zone and the Vision call).
  - Image: Claude Vision (`VITE_ANTHROPIC_MODEL`, default `claude-haiku-4-5`, key in the browser) returns
    `{price, area, address, addressIsApproximate, url}`. The address is geocoded; if that fails, the pin stays at
    the workplace or the city centre and a banner says the location is approximate.
  - Saved Idealista `.html` page: `IdealistaHTMLParser` extracts the listing fields, then the address is geocoded.
- **Exclusion zones** (`VITE_FEATURE_EXCLUSIONS`). Zones are drawn (terra-draw) or picked from `areas.geojson`
  (districts, barris, AMB municipalities). They persist in localStorage.
- **Idealista price dots** (`VITE_FEATURE_IDEALISTA_PRICES`). Reads `data/idealista_prices.geojson`, built locally
  from a HAR capture by `scripts/har_to_geojson.py`. Both files are gitignored (private scrape).

## Always-on reference layers

Noise isophones, the three climate view layers, metro (TMB), FGC, POI icons and City Core landmark markers.
None of them affects the score. The score comes from the precomputed building columns.

## State and persistence

`store/index.ts` holds the map view (`zoom`, `mapCenter`), commute (`workplace`, `minutes`, `resultPolygon`),
the index settings, layer visibility, best-zones state, `selectedBuilding` and `buildingScores` (written by
`BuildingsLayer`, read by best zones).

The index settings are `compositeVisible`, `compositeWeights` (on/off), `conditions`, `enabledWalkCategories`,
`enabledLandmarkIds`, `ageEras` and `compositeRiskStrengths`.

`areaRanks` (TODO-051, flag `VITE_FEATURE_AREAS`) holds the per-area aggregation of `buildingScores`, set by
`BuildingsLayer` after each rescoring.

Onboarding (TODO-031, flag `VITE_FEATURE_ONBOARDING`): `conditionOrder` (the order conditions were added =
their priority), `onboarded`, `onboardingOpen`, and `applySettings(patch)`, which sets all index settings and the
order with one store update, so the map rescores once. The panel opens only on a first visit: no `bcn_onboarded`
flag and no saved settings (`hasSavedSettings()`); "Change" in the panel reopens it. On a phone it is a bottom sheet
(`.onboarding-sheet`) and the map above it stays live.

- **URL:** `minutes`, `zoom`, `cx`, `cy` and `c`, the whole configuration of the map (conditions, limits, services,
  places, eras, risk strengths, order, flat size, contrast; 053). Read at startup (`c` wins over localStorage and is
  saved), written on change; `c` only when it differs from the defaults. Format and rules: `services/urlConfig.ts`,
  `docs/features/053-shareable-state-url.md`.
- **localStorage** (`bcn_*` keys): workplace, isochrone cache, layer visibility, index on/off, conditions, weights,
  walk categories, landmarks, eras, risk strengths, condition order (`bcn_condition_order`), onboarding done
  (`bcn_onboarded`), flat size of the budget word (`bcn_flat_area_m2`), best-zones strictness and restriction, pins, exclusion zones,
  Idealista base URL. Not persisted: the Idealista price window, the street-flooding return period, the selected
  building.

## Performance (TODO-058)

- **Scoring runs in a Web Worker** (`workers/score.worker.ts`, client `services/buildings/scoreClient.ts`). The
  worker gets a copy of the raw score blob once and the settings per change; without a worker the same `scoreAll`
  runs on the main thread. Scoring does not wait for the map: at start it runs while the base map is loading, and
  `BuildingsLayer` sets the feature states when both are ready.
- **The building data comes in two files** (format 2, `scripts/building_blob.py`): `buildings-scores.bin.gz` (1.0 MB,
  what the scoring reads) and `buildings-positions.bin.gz` (0.5 MB, `lng` / `lat`). `loadScores()` brings the first;
  `loadBuildings()` adds the second to the same object, and only the card, the isochrone (077), best zones and the
  fallback area join ask for it (`useBuildingData` for components). Multi-byte columns are stored as byte planes
  (-15 % gzipped). `main.tsx` starts `loadScores()` right after the first paint, not when the map code is in.
- **The page decodes only the columns it reads** (`lazyColumns` in `buildingData.ts`: area, the values of one
  building for its card). All score columns are decoded in the worker only.
- **The area view of a first visit is precomputed** (`services/areas/areaStart.ts`). `npm run build` ends with
  `scripts/build-area-start.mjs`, which runs the app's own scoring on the data files and writes
  `dist/data/area-start.json` (6 KB gzipped): area → polygon id, and the area ranks for the first-visit settings
  (`services/buildings/firstVisit.ts`, which the store starts from as well). The join always comes from it (no
  positions needed); the ranks are used while nothing is scored and the settings key matches
  (`useStartAreaRanks`). The file checks `generated` and `count` against `buildings-meta.json`; the dev server has
  none and falls back to computing both.
- **Share pictures and pages are made at build time** (TODO-063). `npm run build` ends with `scripts/build-share-images.mjs`:
  the app's own scoring for the first-visit settings and for each profile, then `dist/og-image.jpg` and, per ranked barri
  and profile, `dist/share/<profile>/<barri>/index.html` (own Open Graph tags + redirect to the map) and `.jpg`
  (`@napi-rs/canvas`, the same drawing code the browser uses). `VITE_SITE_URL` sets the public address in them. "Save image"
  on the building card draws the 4:5 picture in the browser from the live map (code loaded on the first click).
- **Initial JavaScript is budgeted** (`bundleBudget.initialJsGzipKB` in `frontend/package.json`, 535 KB gzip, now
  ~530.5; raised from 500 for i18next, TODO-065, and from 530 for the building card awards and the retiree profile, 070 and 069): `npm run check:bundle` runs in the deploy workflow after the build. Code that most visitors never run is
  loaded on demand: Best zones (h3-js, turf), the isochrone / exclusion / pin / Idealista layers, terra-draw.
  Keep h3-js and turf's union / difference / buffer out of modules that load at start (`bestZonesConfig.ts`,
  `exclusionsGeometry.ts`, `bestZoneGrid.ts` exist for that).
- **The map code is in its own chunks.** `App.tsx` imports `Map.tsx` (and with it MapLibre) dynamically;
  `index.html` still preloads those chunks (the `preloadMapChunks` plugin in `vite.config.ts`), so they download
  from the start and count in the budget. Nothing outside the `Map` tree may import `maplibre-gl` at run time
  (types only), or MapLibre is back in the entry chunk.
- **The base map style is our own copy** of ICGC's (`public/basemap/icgc-standard.json`, `services/mapStyle.ts`).
  ICGC serves the 760 KB style uncompressed and the app used to download it twice; the copy is ~55 KB gzipped.
  Tiles, fonts and icons still come from ICGC. A HEAD request checks that ICGC answers (3 s), otherwise the map
  uses OpenFreeMap. Refresh the copy with `npm run update:basemap` when ICGC changes its style.
- **`index.html` preloads** the base map style, `buildings-meta.json` and (production build) `area-start.json`, and
  preconnects to ICGC. The addresses and `crossorigin` must match the `fetch()` calls. The scores (1 MB) are not
  preloaded on purpose: they would share the connection with the JavaScript and hold back the first paint
  (measured with the old 1.8 MB file: +220 ms with the CPU slowed 4×).
- **Heavy start-up work waits for the first paint** (`afterFirstPaint` in `services/firstPaint.ts`): starting the
  map, parsing the base map style, loading and unpacking the scores. Use it for anything heavy that runs at start.
- **MapLibre's validation is off in the production build** for our copy of the style (`validateStyle`) and for our
  own layers (`addLayerOrdered` in `Map/layerOrder.ts`): to validate one layer MapLibre serialises the whole
  style, 900 layers. Development and the tests validate everything. Add layers through `addLayerOrdered`.
- **Layers that are off at start are set up when first shown** (`useEver` in `Map.tsx`): noise, river floods,
  street flooding, wildfire, and POI below zoom 13. Each would otherwise fetch the header of its tile archive at
  start. With the area view on, the building layers start at its zoom limit, so no building tiles are fetched below.
- **Labels of our layers use one font**, `MAP_TEXT_FONT` (`Map/mapFont.ts`). A list of fonts is answered with 404
  by both glyph servers, and MapLibre then draws every letter itself.
- **Marks for measuring:** `performance.mark('map-style-loaded')`, `'areas-colored'` and `'buildings-colored'`. Numbers and how to
  measure: `local-docs/architecture/07-perf-baseline.md`.

## Offline data pipeline (`scripts/`)

Python scripts run in `.venv-livability` (x86_64 wheels: `arch -x86_64 .venv-livability/bin/python …`); some run
with `uv run --with …` (see each docstring). Raw inputs and intermediate files live in `data/` (gitignored).
Outputs in `frontend/public/` are committed.

**Building index, in order:**

| Step | Script | Output |
|---|---|---|
| 1 | `prepare_buildings.py`: Catastro INSPIRE buildings + addresses, province 08; buildings with ≥ N dwellings + student residences | `data/buildings/buildings.gpkg` (buildings, entrances) |
| 2a | `fetch_exposure_sources.py`: BCN noise rasters 2022 + 2017 facade map, SICA 2022 agglomeration maps, Catastro parcels and blocks | `data/noise/`, `data/buildings/raw/`, `blocks.gpkg` |
| 2b | `fetch_climate_risk.py`: ACA flood, RESCCUE, wildfire hazard 2024, WUI, heat | `data/climate-risk/` |
| 2c | `building_exposure.py`: noise per facade (street / courtyard × 8 directions), river zone, water at the door, wildfire | `data/buildings/exposure.gpkg` |
| 3 | `building_access.py`: walking network from the OSM PBF (pandana), from the first entrance; parks and beaches at their edge; `min_*` to `WALK_MIN_RMAX_M` (2,400 m = 30 min), `cc_*` to `CITY_CORE_MAX_MIN` (120) since 073 | `data/buildings/access.gpkg` (`walk_*`, `min_*`, `cc_*`) |
| 4 | prices: `fetch_incasol_sale_prices.py`, `fetch_incasol_sale_catalonia.py` (+ rental / INE fetchers, not used by the app) → `build_price_geopackage.py` | `data/open-prices/bcn_prices.gpkg` |
| 5 | `build_neighbourhood_vibe.py`: ESM survey (+ Inside Airbnb, research only) | `public/data/barri-vibe.json`, `data/neighbourhood-vibe/` |
| 6 | `build_building_tiles.py`: non-residential filter, barri / municipality, tiles and columns | `buildings*.pmtiles`, `buildings-scores.bin.gz`, `buildings-positions.bin.gz`, `buildings-meta.json` |

**Other outputs:**

| Script | Output |
|---|---|
| `climate_risk.py` (helpers for step 2c + view tiles) | `flood-zones.pmtiles`, `wildfire.pmtiles`, `street-flooding.pmtiles` |
| `prepare-noise-data.sh` (BCN 2022 Total Lden isophones → tippecanoe z10–16) | `noise.pmtiles` |
| `extract_poi.py` (OSM PBF → POI) | `frontend/public/barcelona_poi.pmtiles` |
| `prepare-areas-data.sh` | `areas.geojson` |
| `fgc-gtfs-to-geojson.mjs` | `frontend/public/fgc-*.geojson` |
| `prepare-landmark-geometries.py` | `landmark-geometries.json`: not read by the app (see "Known leftovers") |
| `har_to_geojson.py` (gitignored, local only) | `idealista_prices.geojson` |

Pipeline tests: `scripts/test_*.py` (unittest).

**Score audit** (073): `cd frontend && npm run audit:score` runs the app's own scoring over the data files for the
first-visit settings and every profile and prints, for Barcelona homes, the share meeting each condition, the
bands, the best score and how much each condition moves the score. It exits with 1 when a setting has no building
meeting every condition or a condition met by fewer than 5% of homes. Run it after every data rebuild and after
changing a default; `-- --write` updates `src/services/audit/influence.json`, which the info modal quotes.

## Environment variables

Frontend variables live in `frontend/.env.local` (copy `.env.local.example`), `frontend/.env.production` (public
build, committed) and `frontend/.env.test` (all flags on). Every default below is also the fallback in code.

**Livability Index (public)**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_COND_NOISE_MAX_DB` | 65 | noise limit, dB |
| `VITE_COND_PRICE_MAX_EUR_M2` | 4000 | price budget, €/m² |
| `VITE_COND_CITY_CORE_MAX_MIN` | 30 | City Core limit, walking min |
| `VITE_COND_WALK_MAX_MIN` | 10 | services limit, walking min |
| `VITE_COND_LOCALS_MIN` | 7.5 | minimum residents' satisfaction /10 |
| `VITE_COND_NOISE_FALLOFF_DB` | 10 | noise scores 0 this many dB over |
| `VITE_COND_PRICE_FALLOFF_PCT` | 25 | price scores 0 this many % over |
| `VITE_COND_MINUTES_FALLOFF_FACTOR` | 2 | a place / service scores 0 at this × the limit |
| `VITE_COND_SATISF_FALLOFF` | 1 | satisfaction scores 0 this many points under |
| `VITE_AGE_ERA_BOUNDS` | 1900,1940,1980,2007 | era starts (era names are written for these) |
| `VITE_AGE_ERA_BLUR_YEARS` | 5 | fade at era edges |
| `VITE_AGE_UNCERTAIN_YEAR` | 1900 | Catastro's "unknown old" year, counts for both eras |
| `VITE_FLOOD_PENALTY_T10` / `_T100` / `_T500` | 1 / 0.27 / 0.06 | penalty per flood band (river and street), ∝ chance of a flood within 30 years (073) |
| `VITE_WALK_DEFAULT_CATEGORIES` | the 9 services but the beach | services on at a first visit (073) |
| `VITE_CITY_CORE_DEFAULT_LANDMARKS` | placa_cat,barri_gotic,pg_gracia | City Core places on at a first visit (073) |
| `VITE_BUDGET_HARD` | true | over the budget a home is at most a partial match (073) |
| `VITE_RISK_STRENGTH_FLOOD` / `_FIRE` / `_STREET` | 5 / 5 / 5 | default risk strengths 0–10 |
| `VITE_STREET_FLOOD_MIN_CM` / `_MAX_CM` | 10 / 50 | water at the door: counts from / fully at |
| `VITE_MATCH_BANDS` | 85,65,40 | lower edges of Great / Good / Partial match (050) |
| `VITE_SCORE_SCALE_TRIM_PCT` | 2 | commute zone colours (077): the scale ignores this % at each end |
| `VITE_SCORE_SCALE_MIN_SPAN` | 20 | commute zone colours (077): the scale spans at least this many points |
| `VITE_COMMUTE_DEFAULT_MINUTES` | 30 | Daily trip (078): minutes by public transport it starts with |
| `VITE_COMMUTE_DEFAULT_PLACE` | placa_cat | Daily trip (078): the landmark it starts at |
| `VITE_QUIZ_COMMUTE_OPTIONS` | 15,30,45,60 | Daily trip (078): the time steps of the sentence |
| `VITE_QUIZ_NOISE_OPTIONS` | 50,58,65 | steps of the noise word, dB (031; 052 reuses them) |
| `VITE_QUIZ_WALK_OPTIONS` / `_CENTRE_OPTIONS` | 5,10,15 / 25,30,45 | steps of the "within N min" words |
| `VITE_QUIZ_BUDGET_OPTIONS` | 150000,250000,350000,500000 | steps of the budget word, € for a flat (÷ its size = the price per m²; each shows "≈ N % of homes") |
| `VITE_QUIZ_FLAT_AREA_OPTIONS` / `VITE_FLAT_AREA_M2` | 50,70,90,120 / 70 | steps of the flat-size word, m² / the size to start with |
| `VITE_QUIZ_LOCALS_OPTIONS` | 7.0,7.5,8.0 | steps of the residents' satisfaction word |
| `VITE_RISK_PRESET_AVOID` / `_STRONG` | 5 / 8 | strength of each risk for "Avoid" / "Strongly avoid" |
| `VITE_AREA_MIN_BUILDINGS` | 50 | areas with fewer homes are listed after the ranked ones (051) |
| `VITE_AREA_VIEW_MAX_ZOOM` | 13 | below this zoom the map shows areas, from it the buildings (051) |
| `VITE_PRESET_FAMILY` / `_REMOTE` / `_CITY` / `_RETIREE` | (in code) | optional JSON overriding a profile's fields |
| `VITE_BEST_ZONES_TOP_PCT` | 15 | default strictness |
| `VITE_BEST_ZONES_MAX` / `_MAX_WITH_TIES` / `_TIE_RATIO` | 3 / 5 / 0.9 | zone count and near-ties |
| `VITE_BEST_ZONES_MIN_CELLS` | 5 | minimum zone size, res-9 cells |
| `VITE_BEST_ZONES_BUFFER_DEG` / `_SIMPLIFY_TOL` / `_MAX_VERTICES` | 0.0006 / 0.001 / 20 | zone outline smoothing |
| `VITE_IDEALISTA_MAX_URL_CHARS` | 900 | zone search URL budget |
| `VITE_TMB_APP_ID` / `VITE_TMB_APP_KEY` | — | metro layer (CI secrets in production) |
| `VITE_DEFAULT_LANG` / `VITE_ENABLED_LANGS` | en / en,es,ca | source language and fallback / languages in the menu (065) |
| `VITE_FEATURE_*` | false | see `docs/FEATURE_FLAGS.md` |

**Personal mode (pins, isochrone)**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_OTP_URL` | http://localhost:8080 | OTP2 base URL |
| `VITE_OTP_DEPARTURE_TIME` | 09:00:00 | departure, next Monday, Madrid time |
| `VITE_OTP_TRANSIT_MODES` | WALK,SUBWAY,BUS,TRAM,RAIL | transit modes for routing (OTP2 v1 `TRANSIT` is broken) |
| `VITE_OTP_TRANSIT_ITINERARIES` | 3 | transit alternatives; the fastest is used |
| `VITE_WEIGHT_WALK` / `_PT` / `_CYCLE` / `_CAR` | 4 / 3 / 2 / 1 | travel index weights |
| `VITE_TRAVEL_CAP_MINUTES` | 60 | a mode scores 0 from this many minutes |
| `VITE_COMPOSITE_WEIGHT_TRAVEL` / `_NOISE` / `_WALKABILITY` | 5 / 2 / 3 | pin composite weights |
| `VITE_WALK_DECAY_M` / `VITE_WALK_RMAX_M` | 400 / 1500 | pin walkability decay and cutoff (pipeline: `WALK_DECAY_M` / `WALK_RMAX_M`) |
| `VITE_GEOAPIFY_API_KEY` | — | geocoding of parsed listings |
| `VITE_ANTHROPIC_API_KEY` / `VITE_ANTHROPIC_MODEL` | — / claude-haiku-4-5 | screenshot parsing |

**Pipeline** (plain env vars; rerun the script after changing them): `WALK_DECAY_M`, `WALK_RMAX_M`,
`CLIMATE_RISK_DIR`, `FIRE_SEARCH_RADIUS_M` (500), `FIRE_DECAY_M` (150), `STREET_FLOOD_MIN_DEPTH_M` /
`_MAX_DEPTH_M` (0.10 / 0.50), `VIBE_ESM_YEARS` (2022-2026), `VIBE_ESM_MIN_N` (100), `VIBE_ESM_SHRINK_K` (100).
More constants are documented in each script's docstring.

**Backend:** `backend/.env` holds `TMB_APP_ID` / `TMB_APP_KEY` for `download-gtfs.sh`.

## External services

| Service | Used by | Mode | Notes |
|---|---|---|---|
| ICGC context map | basemap | public | tiles, fonts, icons; the style is our copy (`public/basemap/`, `npm run update:basemap`); HEAD check with a 3 s timeout, then fallback |
| OpenFreeMap (liberty) | basemap | public | fallback style, no key |
| TMB API (`api.tmb.cat`) | MetroLayer | public | keys required |
| Catastro OVC: DNPRC | BuildingCard, floors below ground | public | open, CORS, one call per card |
| Catastro OVC: facade photo | BuildingCard | flag `FACADE_PHOTO` | hotlinked, no stated terms |
| Catastro Sede (link) | BuildingCard, "Open in Catastro" | public | link only |
| Idealista | Best zones links | public | URL only (`shape=` search) |
| Google Maps (link) | right-click menu | public | link only |
| OpenTripPlanner 2 | isochrone, pin travel times | flags `ISOCHRONE`, `PINS` | self-hosted Docker, not deployed |
| Geoapify geocoding | parsed listings → coordinates | flags `SCREENSHOT` / `PINS` | key required |
| Overpass API | street geometry for the accuracy area | flags `SCREENSHOT` / `PINS` | public endpoint |
| Anthropic API | Claude Vision screenshot parsing | flag `SCREENSHOT` | key in the browser: local use only |

## Planned changes that touch this file

Mass-market UX (050, 031, 051, 052, 053) is done and on in production.
Infrastructure for the launch: TODO-054 (hosting), 055 (basemap, metro, Catastro offline), 056 (observability), 057 (CI,
data out of git), 058 (worker scoring, bundle budget), 059 (API for the personal mode, design only).
See `docs/ROADMAP.md`.

## Known leftovers (code still to clean up)

- `layerOrder.ts` still lists `barrio-boundaries-*` layers, but no component adds them.
- `SHAPE_LANDMARK_IDS` (`services/cityCore/landmarks.ts`) and `scripts/prepare-landmark-geometries.py` are not used by
  the app (the `landmark-geometries.json` they wrote was removed in TODO-066: it was OSM data served without an ODbL notice). City Core shapes now live in `scripts/building_access.py`.
- `BuildingsMeta.categories` in `buildingData.ts` says the columns are `walk_<id>`; the frontend actually reads
  `min_<id>`.
- The info modal of the commute zone (`FilterPanel.tsx`) hardcodes the pin weights instead of reading the ENV.
- The docstring of `scripts/fetch_climate_risk.py` says "Nothing here feeds the frontend yet". It now feeds
  `building_exposure.py` and `climate_risk.py`.

## Data sources and credits (TODO-066)

- `services/dataSources.ts` is the one registry of sources (publisher, licence, link, edition, `commercial` flag). The map credit (`components/About/MapCredit.tsx`), the dialog (`About/AboutDialog.tsx`, state in `store/aboutStore.ts`) and the cards read from it. Add a source there when the code adds one; `dataSources.test.ts` fails when a `*Layer.tsx` with an `attribution` has no entry.
- Texts of the dialog and the in-context credits: `locales/<lang>/legal.json`.
- Fetch dates: `buildings-meta.json` → `sources` (written by `build_building_tiles.py` from the dates of its input files); without it the dialog shows the build date.
- `VITE_COMMERCIAL_USE=true` turns off street flooding (layer, penalty) and FGC.
