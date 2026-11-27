# 046 — Building-level Livability Index

**Changed by 073 (2026-11-16):** new score columns `lden_street` and `dwellings` and the meta field `minutes_cap`; `min_*` reach 2,400 m (30 min) and `cc_*` 120 min in the pipeline (shipped files: still 1,500 m / 90 min until the next full run).

**Status:** Done 2026-11-04. Stages 1–4 and step 6 (hexes removed) are done; 3b (slope) is not needed for now;
stage 5 moved to 047 (building age) and TODO-048 (energy certificates, ground-floor premises). Direction
agreed 2026-10-28; each stage went through plan mode before code.

## Problem

An H3 res-9 cell (~0.1 km²) averages things that change street by street, and the averages are biased.

Measured on central Eixample (1.1 km², 1,544 OSM footprints, 2022 Total Lden isophones):

- **58%** of the `lden_avg` sample points (026) fall inside building footprints. The isophones cover the whole
  city (107.6 km²), so points inside buildings get values the model doesn't really predict: mean **44 dB**
  inside vs **68.6 dB** outside. Result: cell Lden ≈ 54 dB (noise score ≈ 70), while the street facades are at
  70–80 dB (score ≈ 0–20).
- **One building has no single noise value either.** Loudest vs quietest facade of the same building (3 m ring
  outside the footprint): median spread **25 dB**: street vs courtyard.
- River-flood and street-flooding shares (036, 037) are divided by the whole cell area, buildings included.
- Walkability (010) and City Core (021) use straight-line distance (City Core × 1.35 tortuosity), so rail
  cuttings, Rondas, Montjuïc, the port and slopes don't show up.

## Goal

The **residential building** is the unit. Every score is computed per building, and the map colours buildings.
Hexes are removed.

- The card shows per-building values, building facts (year, floors, dwellings) and, under an explicit
  **Barri-level** label, stats that only exist per area (INCASOL sale price, Locals' opinion 042).
- Model limits go into the card: noise is modelled at 4 m height; street flooding matters for ground floors,
  basements and parking.

User story: *As someone choosing a flat in Barcelona, I want to see the noise, flood exposure, walkability and
age of the specific building, not an average over the area around it, and to know which numbers describe the
building and which describe the whole barri.*

## Stages

1. **Building base.** Residential buildings and their entrances from Catastro INSPIRE for Barcelona + AMB.
   The dwellings filter replaces the inverse mask from 039. Details in
   [Stage 1 — building base](#stage-1--building-base).
2. **Noise by facade, flooding and wildfire per building.** Noise per side of the building (street /
   courtyard) and per direction the facade faces, for Barcelona and 14 AMB municipalities; river zone, water
   depth at the door, wildfire. Details in [Stage 2](#stage-2--noise-by-facade-flooding-wildfire).
3. **Walkability and City Core per building on the walking network** (OSM) instead of straight lines,
   from the building's entrance. Details in [Stage 3](#stage-3--walkability-and-city-core-on-the-walking-network).
   - 3b. **Slope** — not needed for now (product owner, 2026-11-03). Tobler walking speed from a DEM, up and
     down different, if the hills ever turn out to matter.
4. **Frontend switch** — done 2026-11-04. Split into 4a data, 4b map layer and scoring, 4c building card and
   4d best zones. Details in [Stage 4](#stage-4--the-index-on-buildings-frontend).
   - Building layer from PMTiles; scores computed in JS (same `computeComposite` as the hexes) and set as
     feature state.
   - Viewport colour scale (032) from the centroids in view.
   - **Building card** (click a building) replaces `HexDetailCard`:
     - address, facade photo, link "Open in Catastro" (both built from the cadastral ref);
     - use, dwellings / other premises (`units − dwellings`: shops, offices, parking, storage);
     - floors (+ below ground), year built / renovated, built area, condition (only when not `functional`);
     - the scores with model notes (see [card texts](#card-texts-stage-4));
     - a **Barri-level** block for area-only data (INCASOL price, Locals' opinion).
   - Noise circles next to the facades of the selected building, from the `facades` layer (colour = level).
   - **User's own set of categories and landmarks.**
     - A gear modal next to Walkability switches categories on and off; someone may not need schools or clinics.
       Formula: `walk = 100 · Σ_enabled w_c·sub_c / Σ_enabled w_c` from the stored `walk_<category>`.
     - City Core keeps its landmark gear (`enabledLandmarkIds`), now over the stored `cc_<landmark>` minutes.
     - The user's own points (a child's school) can't be precomputed; they would need routing on the fly.
   - Street names prettified (`CL ARAGO` → `Carrer d'Aragó`). Each building gets the barri / municipality id
     as the key for barri-level data.
   - Best zones (038) on building centroids, binned internally into fine H3 cells so the existing algorithm
     and Idealista outline are reused.
   - A pin picks its building — later: pins are off in production.
   - Was behind `VITE_FEATURE_BUILDINGS` until step 6; the flag is gone, buildings are the only version.
5. **Building attributes as weights** — moved out on 2026-11-04: building age (weight or filter) and plain-word
   weight labels to 047; energy certificates and ground-floor premises to TODO-048 (draft).
6. **Remove hexes** — done 2026-11-04, after the product owner checked the building UI by hand. Details in
   [Step 6](#step-6--hexes-removed).

## Stage 1 — building base

### Source: Catastro INSPIRE, not OSM

Dirección General del Catastro, INSPIRE ATOM download services, province 08: **Buildings**
(`building.gml` + `buildingpart.gml`) and **Addresses**, one zip per municipality. Metadata: "No conditions
apply". Attribution: "© Dirección General del Catastro".

| Attribute | OSM (local extract, 260,912 buildings) | Catastro INSPIRE |
|---|---|---|
| Floors | 49% (`building:levels`) | every building (BuildingPart) |
| Year built | **0.3%** (840, `start_date`) | almost every building |
| Dwellings | never | every building |
| Use | ~52% (from `building=*`) | every building (`currentUse`) |
| Footprint | mixed: whole blocks or single buildings | one per cadastral parcel, 0.1 m accuracy |
| Entrances, addresses | partial | entrance points with house numbers |

Other Spanish cities: see TODO-033.

Catastro municipality codes differ from INE (Barcelona = `08900`), and names in the feed are mangled
(`SANT VICEN DELS HORTS`), so the 36 municipalities of `areas.geojson` are matched **by code only**
(`MUNICIPALITIES` in the script).

### Fields

`data/buildings/buildings.gpkg` (gitignored), EPSG:25831.

Layer `buildings`: buildings with `numberOfDwellings ≥ BUILDINGS_MIN_DWELLINGS` (people live there,
mixed-use buildings included).

| Field | Catastro source | Used in |
|---|---|---|
| `id` | BU `localId` (cadastral ref, 14 chars) | key everywhere; card: "Open in Catastro" link and facade photo URL |
| `muni` | Catastro municipality code | summary |
| `use` | BU `currentUse` (`1_residential`, `2_agriculture`, `3_industrial`, `4_1_office`, `4_2_retail`, `4_3_publicServices`) | card |
| `dwellings` | BU `numberOfDwellings` | filter; card |
| `units` | BU `numberOfBuildingUnits` | card: other premises = `units − dwellings` |
| `year_built` | BU `dateOfConstruction/beginning` (oldest part) | card; age weight (stage 5) |
| `year_renov` | BU `dateOfConstruction/end`, only when later than `year_built` | card: "renovated / extended" |
| `floors` | max BuildingPart `numberOfFloorsAboveGround` | card |
| `floors_below` | max BuildingPart `numberOfFloorsBelowGround` | card; street flooding (stage 2) |
| `area_m2` | BU `value` (official built area) | card |
| `condition` | BU `conditionOfConstruction` | card, only when not `functional` |
| `address` | AD: "STREET NUMBER" of every address point, entrances first, `; `-separated. Raw Catastro form (`CL ARAGO 255`, `S-N` = no number) | card; pins |
| geometry | BU footprint | building layer (stage 4); facade ring for noise (stage 2) |

AD has two kinds of address points: `Entrance` (a mapped door) and `Parcel` (a parcel point, used where no
door is mapped). Both feed `address`.

Layer `entrances`: only the `Entrance` points of the buildings above (`id`, `address`). Used for water depth
at the door (stage 2) and for snapping to the walk graph (stage 3). A building without one falls back to its
footprint.

The address `localId` is `<prov>.<muni>.<street id>.<number>.<ref>`. The street id leads to
`ThoroughfareName` and the last 14 characters are the building ref, so no xlink resolving is needed.

Not taken: `otherconstruction.gml` (pools, sheds), `heightBelowGround`, bookkeeping fields, AD
`PostalDescriptor` / `AdminUnitName`.

### Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `BUILDINGS_MIN_DWELLINGS` | 1 | pipeline — a building counts as residential from this many dwellings |

### Run

```
arch -x86_64 .venv-livability/bin/python scripts/prepare_buildings.py [--force]
arch -x86_64 .venv-livability/bin/python -m unittest scripts/test_buildings.py
```

Zips are cached in `data/buildings/raw/` (154 MB); `--force` downloads them again.

### Results (2026-11-02)

**Stage 1 — done 2026-11-02.**

- 36 municipalities, **175,236** residential buildings, **1,381,378** dwellings, `buildings.gpkg` 126 MB.
- Barcelona: 61,734 buildings, 708,813 dwellings. That is every dwelling Catastro INSPIRE records in the city;
  the filter drops none.
- Missing values: year 26 buildings, floors 0, address 74, `use` 4,646 (2.7%).
- 82% of buildings have at least one mapped entrance (Barcelona 74%); the rest have only a parcel point.
- `year_built` p10 / p50 / p90 = 1910 / 1967 / 2001. 14% have a later `year_renov`.
- `floors` p10 / p50 / p90 / p99 = 2 / 3 / 8 / 12. 25% have floors below ground.
- 36% have premises besides dwellings.
- `condition`: functional 173,893, declined 1,265, ruin 78.
- **Left out on purpose**, as they have 0 dwellings:
  - 775 Barcelona buildings with residential `use` but no dwellings (33k units): student residences,
    co-living, storage, parking. Example: Pallars 409, 525 units of ~16 m².
  - Around Passeig de Gràcia, 108 of 449 buildings are left out: 102 offices, shops and public services,
    and 6 residential-use buildings without dwellings.
- Visual check (matplotlib render; the QGIS plugin was not connected):
  - Eixample blocks show perimeter buildings around courtyards; Ciutat Vella is the oldest;
  - entrances sit on street facades;
  - the port, Zona Franca, airport, Collserola and Montjuïc are empty.

## Stage 2 — noise by facade, flooding, wildfire

### Sources

| What | Source | Format | Coverage |
|---|---|---|---|
| Noise, Barcelona | Open Data BCN `rasters-mapa-estrategic-soroll`, 2022, Total Lden / Dia / Vespre / Nit (CC-BY-4.0) | float32 raster, 2 m, 0 / nodata under buildings | Barcelona |
| Noise, AMB | SICA (MITECO) 4th round, 2022: original END agglomeration deliveries, `NoiseContours_allSourcesInAgglomeration_{Lden,Lday,Levening,Lnight}` | 5 dB band polygons, EPSG:3035 | 14 municipalities (below) |
| Noise, Barcelona 2017 | Open Data BCN `facanes-mapa-estrategic-soroll`: Ld / Le / Ln / Lden per facade and source, keyed by cadastral ref | lines | Barcelona; card extra + validation |
| Street / courtyard | Catastro INSPIRE CadastralParcels → `CadastralZoning` `MANZANA` (city blocks), `data/buildings/blocks.gpkg` | polygons | the 15 municipalities with noise |
| Walls shared with neighbours | all Catastro buildings (every use) from the stage 1 zips | polygons | — |
| River zones, WUI, forest hazard, RESCCUE depths | `data/climate-risk/` (features 036, 037) | — | as before |

SICA agglomerations used (Catastro codes): l'Hospitalet (08100); Baix Llobregat I (Cornellà 08072, Esplugues 08076,
Sant Feliu 08210, Sant Joan Despí 08216, Sant Just 08219); Baix Llobregat II (Gavà 08088, Sant Boi 08199,
Viladecans 08302); Barcelonès (Badalona 08015, Sant Adrià 08193, Santa Coloma 08245); Vallès Occidental I
(Barberà 08252, Badia 08312). Together with Barcelona: **84% of the dwellings**. The other 21 municipalities have
only corridor maps (major roads, railways, El Prat airport): levels along the corridor, while the town's own
streets are a uniform "< 40 dB" (Sant Cugat). They get no noise; see TODO-043.

Fetch: `scripts/fetch_exposure_sources.py`. The SICA servers leave out their intermediate certificate, so the script
builds a CA bundle from certifi plus the FNMT intermediate named in the certificate's AIA field (still verified
against the FNMT root). QGIS project with every source: `data/buildings/build_qgis_project.py` (run inside QGIS)
→ `data/buildings/exposure_sources.qgz`.

### Method

`scripts/building_exposure.py` → `data/buildings/exposure.gpkg` (EPSG:25831, separate from `buildings.gpkg`).
Re-run it after stage 1.

1. Samples every `NOISE_SAMPLE_SPACING_M` on a ring `NOISE_RING_M` outside each footprint (mitred buffer; the
   building's own courtyards included).
2. Samples inside any building are dropped: walls shared with neighbours (41% of samples).
3. Side: a sample inside a city block is **inner** (courtyard), otherwise **street**.
4. Direction: azimuth from the nearest footprint point to the sample → 8 sectors (N, NE, …).
5. Levels Lden / Ld / Le / Ln: the raster pixel (Barcelona) or the band midpoint (SICA: `Lden5559` → 57.5,
   `…GreaterThan75` → 77.5, `…LowerThan40` → 37.5).
   - SICA deliveries are partly invalid geometry. They are repaired with `make_valid(method="structure")`;
     a plain `make_valid` hid multipolygons and lost 95% of Barcelonès.
   - SICA maps leave out levels below their lowest band, and that band differs by period. A quiet courtyard can
     be in the Lden 40–44 band with no night band at all. A SICA sample with Lden ≤ `SICA_QUIET_LDEN_MAX` and
     no band for another period gets "< 40 dB" (37.5). 99.7–99.9% of such gaps are at quiet samples.
6. Facade groups = building × side × direction. Groups shorter than `NOISE_MIN_FACADE_M` (ring corners) are not
   kept as facades, but their samples still count in the building averages.

Street flooding is read at the door: a circle of `STREET_FLOOD_DOOR_RADIUS_M` around each entrance, or the
footprint buffered by that radius when the building has no mapped entrance. Only RESCCUE elements in public
space count. Elements inside city blocks are dropped: 46% of the mesh, and 60% of the elements deeper than
1 m are closed hollows in courtyards and sunken patios.

### Fields

Layer `facades` (Point): one point per building × side × direction. The point is the sample closest to the
group's centre, so it sits next to the facade; stage 4 draws a circle there.

| Field | Meaning |
|---|---|
| `id` | building (cadastral ref) |
| `side` | `street` / `inner` |
| `dir` | N, NE, E, SE, S, SW, W, NW — the direction the facade faces |
| `length_m` | facade length (samples × spacing) |
| `lden`, `ld`, `le`, `ln` | mean level along the facade, dB |

Table `exposure`: one row per residential building, all 36 municipalities.

| Field | Meaning |
|---|---|
| `noise_src` | `bcn_raster_2022` / `sica_2022` / null (no full noise map) |
| `lden_avg`, `ln_avg` | mean over every exposed facade sample = weighted by facade length: the "typical window". **Value for the index** |
| `lden_street`, `ln_street` / `lden_inner`, `ln_inner` | mean on the street / courtyard side; null when the building has no such side |
| `lden_max`, `ln_max` / `lden_min`, `ln_min` | loudest / quietest facade group |
| `f17_lden_max`, `f17_ln_max` | loudest facade in the 2017 per-facade map (Barcelona) |
| `f17_leisure_ln_max` | loudest night leisure noise (bars, terraces) on a facade, 2017 map; 0 = none |
| `river_zone` | 10 / 100 / 500: the most frequent ACA zone the footprint touches; null = outside every zone |
| `street_t10_cm`, `street_t100_cm` | deepest RESCCUE water at the door, cm; 0 = dry; null outside Barcelona |
| `fire_wui` | 1 when the footprint touches the wildland–urban interface |
| `fire_hazard`, `fire_class`, `fire_dist_m` | distance-decayed forest hazard at the centroid, as in 036 |

### Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `NOISE_RING_M` | 3 | how far outside the wall noise is read |
| `NOISE_SAMPLE_SPACING_M` | 2 | sample spacing along the ring |
| `NOISE_MIN_FACADE_M` | 4 | shorter facade groups (ring corners) are not kept as facades |
| `SICA_QUIET_LDEN_MAX` | 47.5 | a quiet SICA sample with no band for another period is "< 40 dB" |
| `STREET_FLOOD_DOOR_RADIUS_M` | 5 | radius around an entrance where water counts |
| `FIRE_SEARCH_RADIUS_M`, `FIRE_DECAY_M` | 500, 150 | as in 036 |

### Run

```
arch -x86_64 .venv-livability/bin/python scripts/fetch_exposure_sources.py      # once; cached
arch -x86_64 .venv-livability/bin/python scripts/building_exposure.py           # ~10 min
arch -x86_64 .venv-livability/bin/python -m unittest scripts/test_building_exposure.py
```

### Results (2026-11-03)

**Stage 2 — done 2026-11-03.**

- Noise for **117,260** buildings: 99.7% of the 15 municipalities with a full map. 61,722 from the Barcelona
  raster, 55,538 from SICA. 3.2 M samples, 48% on the courtyard side, 575,823 facade points; `exposure.gpkg`
  111 MB.
- Medians: `lden_avg` 57.5, street side 60.9, courtyard side 48.2 dB.
- **Eixample vs hexes:** hex `lden` median 53.8 dB. Buildings: `lden_avg` 63.5, street side 69.5, courtyard
  side 47.1, loudest facade 70.5. For 95% of the buildings with both sides, the street side is ≥ 10 dB louder
  than the courtyard side. The hexes made the Eixample look ~10 dB quieter than a typical window.
- **vs 2017 per-facade map** (60,137 Barcelona buildings): loudest facade median −1.7 dB, MAE 3.1 dB,
  correlation 0.88; night −1.9 / 3.3 dB. The 2022 map is slightly quieter, which is consistent with less
  traffic.
- **2017 leisure night noise:** recorded at 15% of Barcelona buildings; ≥ 45 dB at 5,011.
- **Barcelona vs SICA at the border.** SICA is systematically louder (medians, SICA − Barcelona):

  | Border | Street side Lden | Street side night | Courtyard Lden |
  |---|---|---|---|
  | l'Hospitalet, ≤ 30 m (Riera Blanca, the same street; n = 15 / 21) | +3.6 | +2.3 | +10.9 |
  | l'Hospitalet, ≤ 300 m | +4.3 | +5.0 | +17.2 |
  | Esplugues, ≤ 300 m | +4.4 | +3.4 | +8.8 |
  | Sant Adrià, ≤ 300 m | +7.8 | +9.3 | +9.0 |
  | Santa Coloma, ≤ 300 m | +8.8 | +10.4 | +6.4 |

  The agglomeration models seem to shield courtyards much less. **Decision (product owner, 2026-11-03): use
  SICA as is.** The card names the source and says it is a different official model, not directly comparable
  with Barcelona. Comparisons within AMB are fine. Across the border, an AMB building can lose 15–30 noise
  points.
- **River zones:** T10 383, T100 3,769, T500 7,338 buildings. Largest counts: El Prat (3,023 in T500),
  Cornellà (1,307 T500), Montcada (916 T100 + 109 T10), Sant Adrià (882 T100), Barcelona 377 (Besòs).
- **WUI:** 55,525 buildings.
- **Water at the door, Barcelona:**
  - T10: ≥ 10 cm 12.6%, ≥ 30 cm 4.9%, ≥ 50 cm 2.0%;
  - T100: ≥ 10 cm 23.7%, ≥ 30 cm 10.8%, ≥ 50 cm 6.0%.
  - Known limit: ~300 buildings (0.5%) show > 1 m. They stand next to sunken roads and cuttings that RESCCUE
    models as streets (Pg Maragall, Meridiana / Flor de Neu). Scoring saturates at 50 cm, and the card shows
    "≥ 50 cm".
- **QGIS check** (`exposure_sources.qgz`, group "Exposure per building"): facade circles are red / magenta on
  Aragó and Pg de Gràcia and green in the courtyards; the facade colours match the raster.

## Stage 3 — walkability and City Core on the walking network

### Method

`scripts/building_access.py` → `data/buildings/access.gpkg`, table `access` (no geometry, one row per building).

- **Network.** OSM ways from `backend/otp/data/barcelona.osm.pbf` (the extract OTP and feature 010 use).
  - Kept within the buildings' extent + `NETWORK_MARGIN_M`.
  - Walkable `highway` types: footway, pedestrian, path, steps, living_street, residential, service, unclassified,
    track, cycleway, corridor, tertiary / secondary / primary / trunk (+ `_link`). Motorways are out; `foot=no`
    is out; `access=no|private` is out unless `foot=yes|designated|permissive`.
  - Nodes: ends of ways, vertices shared by ≥ 2 ways (OSM junctions; a bridge without a shared vertex stays
    unconnected), plus one every `NETWORK_MAX_EDGE_M` along a way. Without those, a door in the middle of an
    Eixample block snapped to a corner 50–65 m away.
  - Largest connected component only.
- **Engine.** pandana 0.8 (contraction hierarchies), `nearest_pois` with POI ids.
- **Origin.** The building's first entrance (stage 1), or its centroid when it has none; nearest network node.
- **Walkability.** Feature-010 formula unchanged, with walking metres instead of straight-line metres:
  `access_c = Σ exp(−d/WALK_DECAY_M)` over the nearest K within `WALK_RMAX_M`,
  `sub_c = 1 − exp(−access_c/S_c)`, `walk = 100·Σ w·sub / Σ w`.
  - Categories, S and w come from `prepare-livability-grid.py` (= `serviceCategories.ts`). POIs come from the
    same OSM filters (`extract_poi.py`).
  - Parks and beaches are reached at their **edge**: boundary points every `WALK_BOUNDARY_STEP_M`, deduplicated
    per park so one park counts once. Before, the centroid was used.
  - Beaches skip paved `surface` values (asphalt, concrete, paving_stones …; `BEACH_WHERE` in `extract_poi.py`).
    OSM tags a pool deck in Nou Barris (way 1202318704) `natural=beach`; unfiltered, Porta, Sant Andreu and la
    Prosperitat came out as a few minutes from a beach. Rerun `extract_poi.py` and `building_access.py` to apply.
  - K = `WALK_K_NEAREST` (30). Slowly saturating categories (S ≥ 3: cafe, restaurant) use `WALK_K_DENSE` (120).
- **City Core.** The 13 landmarks of `prepare-city-core-access.py`; minutes = network metres / `WALK_SPEED_M_MIN`,
  null beyond `CITY_CORE_MAX_MIN`.
  - Polygons (Montjuïc, Eixample): nearest boundary point; 0 when the entrance is inside.
  - The waterfront line: points along it.
  - The 1.35 tortuosity factor is gone.

### Fields (`access`)

| Field | Meaning |
|---|---|
| `walk` | 0–100 with every category on (default, QA) |
| `walk_<category>` | 0–100 per category: supermarket, pharmacy, park, school, kindergarten, clinic, metro, cafe, restaurant, beach. The frontend recomputes `walk` for the categories the user keeps |
| `min_<category>` | walking minutes to the nearest one; null when there is none within `WALK_RMAX_M` |
| `cc_<landmark>` | walking minutes to each City Core landmark (021 ids); null beyond 90 min |
| `origin` | `entrance` / `centroid` |
| `snap_m` | distance from the origin to its network node |

### Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `WALK_DECAY_M`, `WALK_RMAX_M` | 400, 1500 | as in 010 — now walking metres |
| `WALK_K_NEAREST` | 30 | nearest services counted per category |
| `WALK_K_DENSE` | 120 | the same for categories with S ≥ 3 |
| `WALK_SPEED_M_MIN` | 80 | 4.8 km/h, as in 010 / 021 |
| `WALK_BOUNDARY_STEP_M` | 50 | edge points of parks, beaches and polygon / line landmarks |
| `CITY_CORE_MAX_MIN` | 90 | as in 021 |
| `NETWORK_MAX_EDGE_M` | 25 | node spacing along ways |
| `NETWORK_MARGIN_M` | 2000 | network kept around the buildings |

### Run

```
arch -x86_64 .venv-livability/bin/pip install pandana          # once; brings scipy and scikit-learn
arch -x86_64 .venv-livability/bin/python scripts/building_access.py            # ~4.5 min
arch -x86_64 .venv-livability/bin/python -m unittest scripts/test_building_access.py
```

### Results (2026-11-03)

**Stage 3 — done 2026-11-03.**

- **Network:** 213,821 walkable ways → 853,278 nodes, 980,200 edges.
- **Origins:** 144,381 entrances, 30,855 centroids. Distance to the network p50 / p95 = 9 / 22 m (before the
  25 m node spacing: 23 / 64 m).
- **Detour factor** (network ÷ straight line, origins ≥ 1 km from a point landmark): p10 / p50 / p90 =
  1.08 / 1.15 / 1.26 (Barcelona 1.16). Feature 021 assumed 1.35, so the old City Core times were ~15% too long
  on average.
  - The largest detours (1.4–1.5) are on the Collserola edge (Vallvidrera, Sant Genís), Montjuïc / La Marina and
    Torre Baró: hills, rail cuttings and Rondas.
- **Walkability vs hexes:** building median 62 vs hex 70, correlation 0.98, |difference| p50 / p90 = 6 / 13.
  Walking metres are longer than straight-line metres, so the same 400 m decay gives lower scores; the colour
  scale fits the visible area anyway (032).
  - 318 buildings (0.19%) drop by more than 30 points. They sit behind barriers or OSM gaps; e.g. Pomaret 78
    next to the Ronda de Dalt.
  - 639 Barcelona buildings have no supermarket within a 1.5 km walk.
- **Barcelona medians, walking minutes to the nearest:** pharmacy 1, restaurant 1, supermarket 2, cafe 2,
  school 3, park 4, kindergarten 5, clinic 5, metro 5, beach 13.
- **City Core spot checks:** Montbau → Passeig de Gràcia 66 min (Google ~75). Badal: mean over the 13 landmarks
  47.8 min. Beyond 90 min (null): 53–68% of all buildings, mostly AMB.
- **K check** (5,000 Barcelona buildings):

  | Comparison | Cafe | Restaurant |
  |---|---|---|
  | K = 30 vs 60 | up to 12 points | up to 14 points |
  | K = 120 vs 240, p99 / max | 0.33 / 0.81 | 0.66 / 1.62 |

  Hence `WALK_K_DENSE` = 120.
- **QGIS:** group "Access per building" in `exposure_sources.qgz`. The dense city is 80–100; Sarrià /
  Pedralbes are lower; Vallvidrera and the Collserola edge are red.

## Stage 4 — the index on buildings (frontend)

### 4a — map data (`scripts/build_building_tiles.py`) — done 2026-11-03

**Student residences.** Catastro files most student residences as public services or retail with **0
dwellings**, so stage 1 dropped them, yet people live there. Stage 1 now also takes every Catastro building
that touches an OSM `building=dormitory` / `amenity=student_accommodation` / `residential=student` object, and
marks it `student = 1`. That brings in 71 buildings, 50 of them with 0 dwellings: Xior, Nodis, micampus, Beyoo,
Residència Elisabets, ETSAV, Col·legi Major Ramon Llull. Stages 1–3 were rerun: 175,286 buildings.

**Clearly not housing — left out.** Only for buildings with ≤ `NONRES_MAX_DWELLINGS` (2) dwellings and never
for student residences. A building is left out when any of these holds:
- its Catastro use is not residential (offices, shops, industry, public services, agriculture) — a
  caretaker's flat;
- its centroid is inside an OSM object with clearly non-residential tags: castle, monastery, church, school,
  university, hospital, prison, police, museum, train station…;
  - only the tags of the object itself; land use is ignored, because real houses stand in industrial estates;
- it has more than `NONRES_MAX_M2_PER_DWELLING` (5,000) m² of built area per dwelling.

Result: **1,652 buildings left out** (0.9%; 2,040 dwellings):

| Reason | Buildings |
|---|---|
| Catastro use | 963 |
| OSM object | 497 |
| m² per dwelling | 192 |

Montjuïc castle (residential use in Catastro, 1 dwelling, 15,218 m²) is out. The UAB campus (45 dwellings on
487,000 m²) and every student residence stay in. For review: `data/buildings/nonresidential.gpkg` and the
group "Stage 4 review" of the QGIS project.

**Area and price.** The centroid goes to its barri (`bcn_sale_barri`, code `BARRI` = the key of
`barri-vibe.json`) or, outside Barcelona, to its municipality (`catalonia_sale_muni`). There are 113 areas.
Price bounds over the buildings: p5 / p95 = 2,105 / 6,213 €/m² (hexes: 2,088 / 6,224).

**Files** (`frontend/public/data/`, 173,634 buildings):

| File | Size | What |
|---|---|---|
| `buildings.pmtiles` | 25.6 MB | layer `b`, feature id = row *i*. z10–13: centroid points without attributes. z14–16: footprints with `ref` (cadastral ref), `floors`, `h` (height in m = floors × `FLOOR_HEIGHT_M`) |
| `buildings-scores.bin.gz` | 1.9 MB | score inputs, one little-endian typed array per column |
| `buildings-meta.json` | 11 KB | `count`; `columns` (`name`, `type` u8 / u16 / f32, `scale`, byte `offset`, `sentinel` = no data); `areas` (code, name, kind barri / muni, price); `price_bounds`; `categories`; `landmarks` |
| `buildings-detail.pmtiles` | 17.5 MB | z14 only. Layer `d`: one point per building with the card fields. Layer `f`: the facade noise points of stage 2 |

Score columns:
- `lng`, `lat` (f32);
- `lden_avg` ×10 (u16);
- `river_zone` (10 / 100 / 500);
- `street_t10_cm`, `street_t100_cm`;
- `fire_hazard` ×1000;
- `area` (index into `areas`);
- `fire_wui` (u8);
- `walk_<category>` ×10 and `cc_<landmark>` ×13 (u8).

Value = raw / scale; the sentinel (u8 255, u16 65535) means no data.

**3D-ready.** The footprints carry `h` and `ref`, so:
- `fill-extrusion` in MapLibre or Mapbox works directly (`fill-extrusion-height = ['get','h']`, colour from the
  same feature state);
- any other engine can join the scores by row or cadastral ref: Mapbox via `pmtiles convert` → MBTiles →
  Studio; deck.gl / three.js read PMTiles directly.

Parameters (env): `NONRES_MAX_DWELLINGS=2`, `NONRES_MAX_M2_PER_DWELLING=5000`, `FLOOR_HEIGHT_M=3`.

Run (~3 min after stages 1–3): `arch -x86_64 .venv-livability/bin/python scripts/build_building_tiles.py`.

### 4b — map layer and scoring — done 2026-11-03

- **Flag `VITE_FEATURE_BUILDINGS`** (removed in step 6). When it was on, `BuildingsLayer` replaced
  `CompositeLayer`.
- **`services/buildings/buildingData.ts`.** Loads the meta and the gzipped columns (`DecompressionStream`;
  raw bytes pass through when the server already decoded them).
- **`services/buildings/buildingScore.ts`.** Feeds a building's inputs to the same `computeComposite` as the
  hexes, so there is no second formula.
  - Walkability is recomputed over the categories the user keeps.
  - Price and Locals' opinion come from the area.
  - Risks: the ACA zone maps to the nested zone shares of 036; wildfire is unchanged; the water depth at the door
    is weighted 0 at ≤ `VITE_STREET_FLOOD_MIN_CM` (10) and 1 at ≥ `VITE_STREET_FLOOD_MAX_CM` (50), then banded
    T10 / T100 like before.
  - `computeComposite` got an optional `risks` argument; the hex path is unchanged.
- **`components/BuildingsLayer/BuildingsLayer.tsx`.**
  - A vector source with dots (z ≤ 13) and footprints (z ≥ 14).
  - Colour from `feature-state.score` (`buildStateColorForRange`), so refitting the visible range only swaps the
    stops.
  - Hatch layer `buildings-hatch` from `feature-state.gap` (060, replaced the black outline); white outline on hover and on the selected building; click selects
    the building (`selectedBuilding` in the store).
  - The first scoring runs at once. Later ones wait `RESCORE_DELAY_MS` (150 ms) after the last change, and only
    changed buildings get a new state.
  - Measured in the browser: 173,634 buildings scored and set in ~0.41 s. A weight change touches 96–99% of
    them. If that ever feels slow: score in a worker, or set states only for loaded tiles.
- **Walkability gear.** A modal of the 10 services; at least one stays on; stored in `bcn_walk_categories`.
  The info modal describes the building version when the flag is on.
- **Manual check** (dev server, headless Chrome):
  - z12 dots read as a map;
  - z15–17 footprints differ inside a block (Pg de Gràcia / Aragó red, courtyard-side buildings green);
  - turning noise off recolours the map;
  - Montjuïc castle is not drawn.

### 4c — building card — done 2026-11-03

- **`services/buildings/buildingDetail.ts`.** On click, reads the one z14 tile of `buildings-detail.pmtiles` under
  the building's centroid: the card fields (layer `d`) and the facade groups (layer `f`). The last 50 buildings
  are cached.
- **`services/buildings/address.ts`.** Catastro's `CL ARAGO 255; RB CATALUNYA 30` → "Carrer Arago 255 · Rambla
  Catalunya 30". It also builds the Catastro page and facade photo URLs from the cadastral reference.
- **`components/BuildingCard/BuildingCard.tsx`** replaced `HexDetailCard`.
  - It shares `ScoreBar`, `RiskRow`, `LocalsSay`, `NoiseLabel`, the colours and the wildfire text with the hex
    card. These now live in `HexDetailCard/cardParts.tsx`, `cardColors.ts` and `cardText.ts`.
  - The card has these blocks, in order:
    - address and use ("Student residence" for the OSM residences);
    - facade photo (flag `VITE_FEATURE_FACADE_PHOTO`, caption "Photo © Dirección General del Catastro"; it is
      hidden when Catastro has no photo);
    - Livability;
    - Catastro facts and "Open in Catastro";
    - what the floors below ground are: "Below ground: parking / storage" (see below);
    - Walkability with minutes to the nearest service of each kept category ("none nearby" beyond the
      `WALK_RMAX_M` network radius);
    - noise;
    - City Core;
    - climate risk with the ground-floor warning;
    - a **Barri-level** / **Municipality-level** block with the INCASOL price and Locals' opinion.
  - Texts live in `buildingCardText.ts`.
- **Floors below ground** (added 2026-11-04). INSPIRE only counts these floors, so a car park reads like
  basement flats. `services/buildings/catastroUnits.ts` asks Catastro's open DNPRC service (`Consulta_DNPRC`,
  CORS-open, one call per card, only when there are floors below ground) what is on each floor.
  - A building of several properties lists one use per property. `Almacen-Estacionamiento` is a single
    Catastro class, so it reads "parking / storage": Catastro does not split car parks from storage rooms.
  - A building that is one property lists its built pieces: `APARCAMIENTO` → "parking", `ALMACEN` →
    "storage", `VIVIENDA` → "dwellings".
  - Below ground means floor codes `-1`, `-2`… and `SS` / `ST` (semi-basement, basement). Common areas are left
    out.
  - When the call fails or nothing is registered below ground, the row is not shown. Catastro sometimes has no
    unit below ground although INSPIRE counts a floor there.
  - Example: Casteràs 33 has 2 floors below ground, with 39 properties of class `Almacen-Estacionamiento` on
    −1 / −2.
- **`components/BuildingsLayer/FacadeNoiseLayer.tsx`.** Circles at the facade groups' measurement points of the
  selected building, coloured with the noise-map palette (`services/noise/noisePalette.ts`, shared with
  `NoiseLayer`). They show from z15.
- A courtyard average can show without courtyard groups in the list. The average uses every courtyard sample;
  groups shorter than the minimum facade length are dropped (short walls of small courtyards).
- **Manual check** (headless Chrome, dev server):
  - Pg de Gràcia 51: the card opens on click, the Catastro photo loads, and three orange circles sit on the
    street side;
  - Badalona (SICA): "≈" values, the SICA note, the Municipality-level block, and "Not available outside
    Barcelona city" for Locals' opinion.

### 4d — best zones — done 2026-11-04

- Best zones (038) keep their algorithm and the res-9 grid; only the input changes. Under the flag,
  `useBestZones` averages the building scores over the H3 cell of each centroid (`centroidCells`,
  `cellMeans` in `buildingScore.ts`) instead of scoring the hex bundles.
- The scores are the ones `BuildingsLayer` already computed: it puts them in the store (`buildingScores`), so
  170k buildings are not scored twice.
- Sticky zones (038, strictness-only changes) now compare the score map itself, not a key of the settings. This
  is because building scores arrive one debounce (150 ms) after the settings change.
- Measured in the browser: centroids → cells 101 ms (once), averaging 14 ms per change; 2,985 cells.
- **Manual check:** at z13 over Barcelona, "Draw best zones" gives three zones on green blocks.

### Card texts (stage 4)

The card shows everything for now; we decide what to drop after seeing it with real data.

- **Noise:**
  - "Street side: 72 dB · night 64", "Courtyard side: 48 dB · night 40", loudest / quietest facade, the
    directions;
  - "Modelled at 4 m above ground (≈ 1st floor)";
  - for SICA buildings, "≈" before the levels and "Different official model (SICA 2022, 5 dB bands): its levels
    run a few dB higher than Barcelona's map, so compare with Barcelona with care". A band such as "55–60 dB" is
    not shown, because the averages over a facade fall between bands;
  - from the 2017 map (Barcelona): "Official facade map 2017: loudest facade X dB, night Y dB", and
    "Night-life noise on a facade: Z dB" when > 0.
- **Street flooding:**
  - headline "Careful if you are looking at a ground-floor flat, basement or garage" when the water at the door
    is ≥ 10 cm or the building has floors below ground;
  - depth scale: < 10 cm water stays in the gutter; 10–30 cm over the kerb, reaches doorsteps; 30–50 cm gets
    into ground floors and car parks; ≥ 50 cm serious damage, cars can float.
- **River flooding:** T10 high probability (about once in 10 years), T100 medium, T500 low (the official
  floodable zone), with the same ground-floor warning.

## Step 6 — hexes removed

Done 2026-11-04. The Livability Index exists only on buildings; production switches to it with the next deploy.

- **Frontend.**
  - Deleted:
    - `CompositeLayer`, `HexDetailCard`;
    - `services/composite/compositeData.ts`, `services/livability/`, the hex loader of `cityCoreData.ts`;
    - `selectedHexH3`, the `hexes` map of `barri-vibe.json`;
    - dead hex code: `mostSevereFloodZone`, `buildScoreFillColor*`, `IdealistaPricesLayer/h3Index.ts`, unused
      layer ids;
    - the flag `VITE_FEATURE_BUILDINGS`.
  - Moved: `scoreRamp.ts` and `CompositeLegend.tsx` to `BuildingsLayer/`; the card parts to `BuildingCard/`. The
    overlay class is `.building-card-overlay`.
  - Scoring core:
    - `computeComposite` takes `ScoreInputs` (no `h3`, no raw `climate`) with the building's `risks`;
    - City Core takes a plain `LandmarkMinutes` map (`cityCoreIndex`);
    - `streetFloodRisk` takes severities 0–1, so `VITE_STREET_FLOOD_SATURATION` is gone.
  - Best zones take only building scores. `h3-js` stays for their res-9 grid.
- **Data.** Deleted `livability-h3.geojson`, `city-core-access.geojson`, `open-price-meta.json` (3.6 MB).
  `barri-vibe.json` lost its `hexes` map (36 → 21 KB); everything else is identical.
- **Pipelines.**
  - Deleted `prepare-livability-grid.py`, `prepare-city-core-access.py`, `test_residential_mask.py`,
    `test_noise_avg.py`.
  - What the building pipeline used moved:
    - walk categories, `load_pois` (points and school grounds) and `LANDMARKS` → `building_access.py`;
    - `latest_sale_total` → `build_building_tiles.py`.
  - `climate_risk.py` keeps:
    - the hazard helpers `building_exposure.py` needs;
    - the three view layers, now over the buildings' extent plus `CLIP_MARGIN_M` (1 km) instead of the hex
      grid's.
  - Tiles were rebuilt: flood-zones 3,823 → 3,868 KB, wildfire 4,504 → 4,347 KB, street-flooding unchanged. The
    grid reached ~2.7 km west of the westernmost building.
  - `build_neighbourhood_vibe.py` no longer writes `hexes`.
  - No pipeline script needs `h3` any more.
- **Docs.**
  - 025, 026 and 039 → `DEPRECATED-`.
  - 017, 021, 022, 024, 032, 036, 037, 038, 042 got a "Superseded by TODO-046" line.
  - TODO-040, 041, 043, 044 and 045 got a note.
  - ARCHITECTURE and FEATURE_FLAGS are updated.

## Open questions

- **Pins:** parse exterior / interior and orientation from Idealista and use the matching side / direction.
- **Noise sources:** the 2017 facade map splits noise by source (road, rail, industry, leisure, patios). More
  of it could go into the card later.
- **Low zooms:** all footprints at z11–13 (tile size) vs centroids as dots.
- **Walk graph:** which tool to use, and whether slope is worth it. Measure network vs straight-line error
  first.
- **Further attributes:** heat-wave cooling demand (`comportament-energetic-edificis`). Age → 047; energy
  certificates and ground-floor premises → TODO-048.
- **Facade photos:** not downloaded. The card hotlinks
  `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfLibres/OVCFotoFachada.svc/RecuperarFotoFachadaGet?ReferenciaCatastral=<ref>`.
  It answers over https (checked 2026-11-03: JPEG ~76 KB, CORS `*`, no mixed-content problem). Still open: the
  service has no stated terms of use. Check before stage 4.

## Not doing

Per-flat values (floor, orientation) on the map. They appear only on a pin, when the listing provides them.

## Related

009, 010, 021, 022, 025, 026, 032, 036, 037, 038, 039, 042, TODO-043, 045, 047, TODO-048.

## Definition of Done

Standard (see `CLAUDE.md`), per stage.
