# TODO-073 — Score model audit: fixes, street-side noise, hard budget, honest names

**Status:** Done 2026-11-16 (stages A, B, C and three open questions), on branch `feat/073-score-model-audit`.
Decisions below were agreed with the owner on 2026-11-16; what changed while building is in
[As built](#as-built-2026-11-16). One item waits for the full pipeline run: the longer reach of the minutes (A4).

## Problem

Before the launch the scoring model (049, 050, 060, 070) was checked for direct errors and for the objections a
planner, an acoustician or a data analyst would raise in the first five minutes. The formula code is arithmetically
correct, but five things are plainly wrong and several choices are hard to defend.

All figures in this document come from a Python replica of `conditions.ts` / `compositeScore.ts` run on the shipped
`buildings-scores.bin.gz` (173,634 buildings; 60,993 in Barcelona), with the first-visit settings unless stated. The
app itself was not run for them; stage C adds a script that reproduces them.

### Direct errors

1. **"Centre" cannot be met.** The condition is the share of all 13 landmarks within the limit, and they are too far
   apart (Parc Güell, Montjuïc, Poblenou, the waterfront).
   - At 30 min no building has more than 11 of 13; the best component score is 94, so no building can score 100.
   - The "City" profile says "15 min to the centre": the best building has 6 of 13 (component 56), and the profile's
     final score cannot exceed 85.
2. **The beach is an "everyday service" by default.** 2.4% of Barcelona buildings are within 10 min of a beach, so
   "Walkability" is met by 2.1% of them. Without the beach: 72.7%.
   - Errors 1 and 2 together: with the first-visit settings no Barcelona building meets more than 2 of 4 conditions,
     the highest score in the whole data is 94, and 1.5% of Barcelona is a "Great match".
3. **The top of the incomplete-data range is not a top** (060). A missing condition is dropped and the rest
   renormalised. The real best case is the missing condition at 100.
   - 57,691 buildings (33%) are affected: the municipalities without a full noise map.
   - Their real upper bound is a median 12 points above the number shown.
   - Noise scores 100 for about 85% of the buildings that have data, so these municipalities are shown and ranked
     well below what they most likely are: 56% of them read "Poor match" today, 18% with the real upper bound.
4. **Cliffs at long limits.** Service minutes are stored up to 1.5 km (19 min), landmark minutes up to 90 min, but
   the sliders allow 15 and 60 min with a fall-off to twice the limit (30 and 120 min).
   - Services, limit 15: 19 min scores 73, a little further scores 0.
   - Centre, limit 60: 89 min scores 52, 91 min scores 0.
5. **"Homes" are buildings.** "Better than 80% of homes" (070) and "62% of homes are a good match" (051) count
   buildings. Barcelona has 11.5 dwellings per building, the rest of the area 5.9, so a single-family house weighs
   as much as a block of 100 flats.

### What an expert will object to

- **Noise is the mean over street and courtyard facades.** The EU noise directive and the WHO assess the most
  exposed facade. With the mean, 87.6% of Barcelona passes 65 dB; in the Eixample the mean is 63.5 dB and the street
  side 69.5 dB (046). No window has the "mean" level.
- **Full compensation.** 24.5% of the Barcelona buildings that score 0 on budget (area price 25% or more over the
  limit) are still a "Good match". After fixes 1 and 2 it would be 49.8%, because the other conditions give more
  points. A budget is usually a hard limit.
- **Equal weights are only nominal.** In Barcelona the price explains about 70% of the variance of the final score,
  noise 15%, centre 8%, services 7%. The price is one number per barri, so the default map is mostly a price map.
  After fixes 1 and 2: price 46%, centre 34%, noise 11%, services 9%.
- **Names.** "Livability Index" has no air quality, green space, safety or public transport; it is a match with the
  person's conditions. "Walkability" means the quality of the walking environment to a planner; here it is how close
  services are.
- Smaller points are in [Open questions](#open-questions): flood-zone weights, walking speed and slope, what counts as
  "metro", the centre on foot only, the WHO reference.

## Decisions (owner, 2026-11-16)

| Topic | Decision |
|---|---|
| Form | One document, three stages: A fixes, B changes to what the score means, C names and method. Each stage ships on its own. |
| Centre | Three central places on by default: Plaça Catalunya, Barri Gòtic, Passeig de Gràcia. The formula stays (share within the limit). The other 10 stay in the list, off. |
| Beach | Off by default (follows from the audit; stays in the list). |
| Incomplete data | Real upper bound: the missing condition counts 100 for the top of the range and 0 for the bottom. Colour, band and ranking use the top, as 060 says. |
| Homes | Ranks and shares are weighted by dwellings. The wording stays. |
| Cliffs | Recompute the data: services to 2.4 km (30 min), landmarks to 120 min. Formula and sliders stay. |
| Noise | Scored on the street side. The courtyard is shown as "there is a quiet side". |
| Budget | A hard condition: a building at 0 on budget is at most a "Partial match". |
| Names | "Livability Index" → "Match score"; "Walkability" → "Services on foot". The product name and the domain stay. |

## Stage A — fixes

Stage A changes no meaning, only errors. A1–A3 are frontend only; A4 and A5 need one data rebuild (shared with B1).

### A1. Centre: three places by default

- New ENV `VITE_CITY_CORE_DEFAULT_LANDMARKS=placa_cat,barri_gotic,pg_gracia`; `firstVisitSettings()` and
  `profileToPatch()` use it where they use `ALL_LANDMARK_IDS` today.
- A saved selection (`localStorage`) and a shared link keep their own list.
- Expected (Barcelona): at 30 min 15.5% of buildings score 100 and 74% score above 0; at 45 min 37% and 95%.
- At 15 min only 1.1% score 100 (31% above 0). The "City" profile then gives 10% "Great", 48% "Good" and a best
  score of 100. Decide in plan mode whether "City" keeps 15 min or moves to 20.

### A2. Beach off by default

- New ENV `VITE_WALK_DEFAULT_CATEGORIES` = the nine categories without `beach`; used by `firstVisitSettings()` and
  the store default. Profiles already name their own categories.
- Expected with A1 and A2 (Barcelona, first-visit settings): buildings meeting 0 / 1 / 2 / 3 / 4 of 4 conditions =
  0.5 / 18.0 / 62.3 / 16.8 / 2.4%; "Great" 2.9%, "Good" 61.0%, "Partial" 31.2%, "Poor" 4.9%; best score 100.

### A3. Real upper bound of the range

- `computeComposite`: `score` (top) = `(Σ known + 100 · Σ missing weights) / Σ weights`, then the penalties.
  `scoreMin` is unchanged. Every condition missing gives 0–100.
- A condition without data still reads "– no data". (The "Meets N of M" count was later removed everywhere, 2026-11-16: it read "Meets 1 of 3" under a 92 and argued with the band.)
- Expected: of the 57,691 buildings with a range, "Poor" falls from 56% to 18% and "Good" rises from 1% to 21%.
- Update `060-incomplete-data-range.md` ("max" definition) and the comment on `CompositeResult.score`.

### A4. No cliffs: longer distances in the data

- `scripts/building_access.py`: the `min_<category>` columns search to a new `WALK_MIN_RMAX_M` (default 2400 =
  30 min); `CITY_CORE_MAX_MIN` default 120. `WALK_RMAX_M` (the old decay score) is not shipped and stays.
- `buildings-meta.json` gets `minutes_cap: { walk: 30, cityCore: 120 }`.
- A frontend test fails when `slider max × VITE_COND_MINUTES_FALLOFF_FACTOR` exceeds the cap of the data, so the
  cliff cannot come back by moving a slider range or the factor.
- Texts: the info modal and the card say "beyond 1.5 km" today; they follow the new radius.
- `fix_beach_minutes.py` has `WALK_RMAX_M = 1500` hard-coded; it is a one-off and is not needed after a full run.

### A5. Ranks and shares by dwellings

- `scripts/build_building_tiles.py`: new score column `dwellings` (u16). A student residence with 0 dwellings
  counts as 1.
- Weighted by dwellings: the score histograms and "better than N%" (070, `buildingRank.ts`), the area shares and
  means (051, `areaRank.ts`), the band shares in the panel (`bandShares`), the area colours at low zoom and the
  precomputed first-visit colours (`areaStartBuild.ts`).
- Not weighted: `VITE_AREA_MIN_BUILDINGS` (still a count of buildings), best zones (038).
- The "top group" rule of 070 (at least 2% of the scope) becomes 2% of the dwellings.

## Stage B — what the score means

### B1. Noise on the street side

- Data: new score column `lden_street` (u16, ×10) from `exposure.gpkg`; it already exists there and in the card.
- Scoring: noise input = `lden_street`, or `lden_avg` when the building has no street side.
- Sentence: "Up to 65 dB on the street side is OK for me — like a busy street".
- Card and match row: the street level against the limit; when the building has a courtyard side at or under the
  limit, a second line "Quiet side: courtyard, 47 dB". The quiet side does not change the score.
- Default limit stays 65 dB. Reference to cite in the method text: the Spanish quality objective for existing
  residential areas (RD 1367/2007: 65 dB day and evening, 55 dB night). Check the citation before publishing.
- **After the rebuild, measure and write here:** the share of buildings without a street side; the share of
  Barcelona passing 50 / 58 / 65 dB on the street side (today, on the mean: 23 / 64 / 88%). If fewer than
  about 15% pass 58 dB, revisit the quiz options (`VITE_QUIZ_NOISE_OPTIONS=50,58,65`) and the profiles that use 58.
- Barcelona and the SICA municipalities stay as they are: different official models, said so in the card.

### B2. Budget is a hard condition

- New ENV `VITE_BUDGET_HARD=true`.
- When the budget condition is on and has data, the final score has a ceiling that depends on the budget score `p`
  (0–100): `ceiling = (good − 1) + (100 − (good − 1)) · p / 100`, where `good` is the lower edge of the "Good" band
  (65). At `p = 0` the ceiling is 64 ("Partial match" at most); at `p = 100` there is none.
  - The owner's decision names the case `p = 0`. The sloped ceiling is added so that a building 24% over the budget
    and one 25% over do not differ by a band (the same kind of cliff A4 removes). Confirm in plan mode.
- Order: mean → risk penalties → ceiling. `score` and `scoreMin` both get it. No price data: no ceiling.
- Card: when the ceiling lowers the score, a line under the risk line: "Over your budget: at most a partial match".
- Expected (Barcelona, after A1–A3): "Good" 61% → 42%, "Partial" 31% → 50%; "Great" and "Poor" do not move.
- Update `049-conditions-real-units.md` ("Not doing: Must have") and `050-match-score.md`.

## Stage C — names and method

### C1. Names

- "Livability Index" → "Match score" in the panel, the info modal, the legend and the share image. The card already
  says "Match with your conditions".
- "Walkability" → "Services on foot" (condition label, info modal, card block).
- English first; Spanish and Catalan through the usual process (`docs/TRANSLATING.md`). Internal ids (`poiAccess`,
  `composite*`) do not change.
- Noise in Spanish and Catalan: "Tranquilidad / Tranquil·litat" → "Poco ruido / Poc soroll", "lado calle" →
  "fachada exterior" — see [074](074-noise-wording-es-ca.md).

### C2. Method text

The info modal gets three short blocks, written for a reader who checks the method:

- **What the score is not:** no air quality, green space, safety or public transport; the centre is measured on
  foot; the price is the average of the barri or municipality, not of a flat.
- **Known limits:** walking at 4.8 km/h on the flat, slopes not counted; "metro" is metro stations only; noise is
  modelled 4 m above the ground; Barcelona and the SICA municipalities use different noise models.
- **How much each condition moves the score:** with the default settings, the share of the score's variance each
  condition explains (from the audit script). Stated plainly: equal weights do not mean equal influence.
- Small corrections: "the WHO recommends below 53 dB" applies to road traffic; say so.

### C3. Audit script and guard

- `npm run audit:score` (`frontend/scripts/score-audit.mjs` → `src/services/audit/`): runs the app's own scoring
  code over the shipped files and prints the figures of this document (share meeting each condition, homes meeting
  N of M, best score, band shares, influence), for the first visit and each profile. Written in TypeScript rather
  than as the planned Python replica, so it cannot drift from the app. Run it after every data rebuild and after
  changing a default; `-- --write` updates `src/services/audit/influence.json`, which the info modal quotes.
- Guard, in the same script (exit code 1): with the first-visit settings and with each profile, some building in
  Barcelona meets every condition, and every condition is met by at least 5% of Barcelona dwellings. This is
  the check that would have caught errors 1 and 2.

## Tests

- **A1 / A2:** `firstVisit.test.ts`, `presets.test.ts` — the default landmark and category lists come from the ENV;
  a saved selection wins.
- **A3:** `compositeScore.test.ts` — top with one and with all conditions missing; `scoreMin` unchanged; penalties
  applied to both ends.
- **A4:** `test_building_access.py` — minutes present between 19 and 30 min; the slider × factor ≤ cap test.
- **A5:** `buildingRank.test.ts`, `areaRank.test.ts` — one large and many small buildings give the dwelling-weighted
  percentage; `test_build_building_tiles.py` — the column, residences count 1.
- **B1:** `buildingScore.test.ts` — street side used, fallback to the mean; card text with and without a quiet side.
- **B2:** `compositeScore.test.ts` — ceiling at `p` = 0, 50, 100; off with the ENV off; no data → no ceiling; card line.
- **C:** locale completeness; `score_audit.py` guard has its own unit test on a small synthetic blob.
- Integration: one building through `scoreBuilding` with the new defaults reaches 100; one over budget is capped.

## Affects existing docs

`049`, `050`, `051`, `060`, `070` (rules above); `046` (new columns, radii); `031` (profiles and quiz options);
`ARCHITECTURE.md` and the ENV files (`.env.production`, `.env.local.example`, `.env.test`) for the new variables.

## Open questions

Decided on 2026-11-16 and built: 1 (flood weights 1 / 0.27 / 0.06), 4 (renamed "Metro station"), 6 (City profile
25 min, owner 2026-11-16 after the guard) and the limits of 3 and 5 stated in the info modal. Still open: 2, the slope and per-profile speed of 3, the
transit version of 5.

1. **Flood-zone weights.** Today 1 / 0.6 / 0.25 for the 10 / 100 / 500-year zones. The flood modal itself gives the
   chance over 30 years as 96% / 26% / 6%, i.e. 1 / 0.27 / 0.06. Proposal: use the 30-year chances, or keep the
   weights and call them a judgement in the method text.
2. **Price still explains about half of the score** after stage A. Proposal: measure again after B1 and B2; if it is
   still above 50%, look at the 25% fall-off or at prices below the barri level.
3. **Walking speed and slope.** One speed (4.8 km/h) for every profile, the retiree with a 5-min limit included, and
   no slope (El Carmel, Horta). Proposal: state it in C2 now; a slower speed for the retiree profile and stage 3b of
   046 (slope) later.
4. **"Metro" is `station=subway` only**: no tram, no Rodalies. Proposal: rename the service "Metro station" now;
   add rail and tram stops with the next POI extract.
5. **The centre on foot only.** Travel time by public transport is the usual measure, and OTP is already in the
   backend. Proposal: a separate feature.
6. **"City" profile at 15 min** (see A1): keep or move to 20.

## Definition of Done

Per `CLAUDE.md`, per stage. Manual check after stage A: with the first-visit settings some Barcelona buildings read
"Meets 4 of 4"; a building in a municipality without a noise map shows a range whose top is its colour; the services
slider at 15 min has no hard edge on the map.

## As built (2026-11-16)

### What the code does

| Item | Where |
|---|---|
| A1, A2 defaults | `firstVisit.ts` (`DEFAULT_LANDMARK_IDS`, `DEFAULT_WALK_CATEGORY_IDS`, ENV `VITE_CITY_CORE_DEFAULT_LANDMARKS`, `VITE_WALK_DEFAULT_CATEGORIES`); `profileToPatch`, the store and the link defaults use them |
| A3 top of the range | `computeComposite`: missing = 100 for `score`, 0 for `scoreMin` |
| A4 no cliffs | pipeline: `WALK_MIN_RMAX_M` = 2,400, `CITY_CORE_MAX_MIN` = 120, meta `minutes_cap`; app: a place scores 0 at `min(2 × limit, minutes_cap)` (`minutesZeroAt`) |
| A5 homes | `dwellings` column; `homeWeight` in `scoreHistograms` / `rankIn` (070), `rankAreas` (051), `bandShares` (the panel bar), the budget steps' "≈ N % of homes", `area-start.json` |
| B1 street side | `lden_street` column; `scoredNoise()`; card headline "Street side: … — what your condition is checked against" and "Quiet side: courtyard, N dB" |
| B2 hard budget | `budgetCeiling`, `CompositeResult.budgetCap`, ENV `VITE_BUDGET_HARD`; card line "Over your budget: at most a partial match" |
| C1 names | "Match score", "Services on foot", "Metro station" (EN / ES / CA) |
| C2 method | info modal: what the score does not include, known limits, influence of each condition; reach of the data and flood weights come from the settings |
| C3 audit | `npm run audit:score` |

### Decisions taken while building

- **Data without the pipeline.** The inputs of the pipeline are not on this machine. `scripts/add_073_columns.py`
  read `dwellings` and `lden_street` from the shipped `buildings-detail.pmtiles` (same tables, every one of the
  173,634 buildings found) and added them with `minutes_cap` = the reach of the shipped files (18.75 / 90 min). Until
  the next full run of `building_access.py` + `build_building_tiles.py`, A4 works through the cap: a service with a
  15-min limit scores 0 at 18.75 min instead of 30. No cliff either way. Scores file: 1.0 → 1.2 MB.
- **Saved lists.** A saved list of all 10 services or all 13 places reads as the new default: until 073 "all" was
  the default and the profiles saved it. Any other saved list is kept. Old links that did not name the lists open
  with the new defaults.
- **City profile and quiz.** City is 25 min; the centre steps of the sentence are 25 / 30 / 45 (15 was almost never
  met). 20 min, the first choice, failed the guard (below).
- **Quiet side** is shown only when the street side is over the limit and the courtyard within it.
- **No award over budget.** Found in the browser check: in an expensive barri many homes share the ceiling (64), so
  a home over the budget read "42% of homes in la Dreta de l'Eixample fit as well. Among the best." The card shows
  no award when the ceiling set the score.
- **Ties** (070) need more than one *building* at the top, and the barri size limit still counts buildings.
- Flood band weights also apply to the 100-year rain of street flooding (037), as before.

- **Versioned data addresses.** The building files, `areas.geojson` and `area-start.json` are fetched with
  `?v=<hash of the data files>` (`dataUrl.ts`, `scripts/dataVersion.mjs`), so after a deploy a cached old file is
  never read next to a new one by the same building row. Needed for this deploy (two new columns) and for any rebuild.

### Measured (npm run audit:score, Barcelona homes)

| Settings | Meets fully | Meets all | Great / Good / Partial / Poor | Influence |
|---|---|---|---|---|
| First visit | services 79, noise 62, centre 16, budget 26 | 1.7% | 2 / 35 / 57 / 6 | budget 48, noise 41, centre 10, services 0 |
| Family | services 95, noise 28, budget 16 | 6.7% | 12 / 13 / 43 / 32 | noise 52, budget 48 |
| Remote | services 96, noise 28, centre 16 | 2.1% | 15 / 47 / 33 / 6 | noise 52, centre 47 |
| City (25 min) | services 56, noise 62, centre 9.5 | 3.1% | 19 / 44 / 35 / 2 | centre 64, noise 23, services 13 |
| Retiree | services 39, noise 28 | 9.0% | 28 / 23 / 38 / 10 | noise 96, services 4 |

- Street-side noise: 9% of the buildings with a noise map have no street side. Share of Barcelona buildings (homes)
  at or under 50 / 55 / 58 / 65 dB: 11 (4.5) / 28 (15) / 43 (28) / 74 (62)%; on the old mean 23 / 50 / 64 / 88% of
  buildings. 58 dB stays a quiz step (more than 15% pass).
- With the defaults the price no longer makes the map alone: budget 48%, noise 41%. Services explain almost nothing
  in Barcelona: nearly every home has them within 10 min.
- **The guard failed for the City profile at 20 min:** all three central places within reach for 3.8% of homes
  (under 5%); 25 min gives 9.5%, 30 min 15.7%. The owner set 25 min; every setting now passes.

### Rerun to finish A4

Same inputs, only the reach changes (on the machine that has `data/buildings/*.gpkg`, `data/open-prices/bcn_prices.gpkg`
and `backend/otp/data/barcelona.osm.pbf`):

```
arch -x86_64 .venv-livability/bin/python scripts/building_access.py         # min_* to 2,400 m, cc_* to 120 min
arch -x86_64 .venv-livability/bin/python scripts/build_building_tiles.py    # writes lden_street, dwellings, minutes_cap itself
arch -x86_64 .venv-livability/bin/python -m unittest scripts/test_build_building_tiles.py scripts/test_building_access.py
cd frontend && npm run audit:score -- --write && npm test && npm run build
```

Do not run `add_073_columns.py` after it (not needed). `fix_beach_minutes.py` reads the reach from the meta since
073, so it no longer clears beach minutes between 1.5 and 2.4 km. A refresh of the sources (new Catastro, OSM, SICA,
INCASOL) is a separate task: it changes every building row and every figure, and the fetchers were last run
on 2026-11-02 / 03 and are untested against today's live sources.
