# Feature 042 — Locals' opinion (residents' view of a barri)

**Superseded by TODO-046 (2026-11-04):** computed per residential building; the H3 hex version described below was removed.

**Status:** Done 2026-10-27, behind `VITE_FEATURE_LOCALS_OPINION` (off in production). Scope changed on
2026-10-27: residents' satisfaction becomes a Composite Index component, and the guests' view (Airbnb) is deferred.

## Goal

Let users who care about what residents think of their barri weigh it into the Composite Index, and show what
residents say about the barri in the hex card.

User story: *As someone relocating to Barcelona, I want to know how happy residents are with a barri and what
they complain about, and to rank areas by it if it matters to me.*

## Decisions (2026-10-27)

The earlier draft kept vibe out of the composite. That decision was revised:

| Earlier concern | Resolution |
|---|---|
| Matters to some users, not to others | That is what weights are for. Default weight is 0 (off). |
| Coverage: Barcelona city only (644 of 2,635 cells) | Same as Noise (TODO-043). The missing-data rule applies unchanged. |
| One value per barri, steps at borders | Same as price. 027 was rolled back for averaging hex values over an area. Here the barri is the native unit of the survey question. |
| No single good direction | Only satisfaction goes into the score: higher = better. Quiet/lively and local/touristy stay out. |
| Stigma | Data is public, and the user sets the weight. No safety score in the UI. Insecurity is shown only as the share of residents naming it as the main problem. |
| Opinion vs measured values | The hex card already shows each component separately, with its source. |

Overlap check (73 barris, medians of hexes per barri):

| Pair | ρ |
|---|---|
| Satisfaction ~ sale €/m² | +0.34 |
| Satisfaction ~ walkability | +0.13 |
| Satisfaction ~ Lden | +0.10 |
| "One of the best" % ~ sale €/m² | +0.68 |
| ESM safety ~ sale €/m² | +0.49 |

The overlap is moderate, so there is no double counting. `esm_best_pct` is not used, because it mostly tracks
price.

## Composite component: `localsOpinion`

- **Source:** ESM `esm_satisf`, satisfaction with living in the barri (0–10), 2022–26 pooled, weighted by `PES`.
- **Small samples:** shrink each barri towards its gran barri mean.
  `s_adj = (n · s_barri + k · s_granbarri) / (n + k)`, with `k = VIBE_ESM_SHRINK_K`. Barri samples range from
  19 to 962 interviews (median 350). Barris have a between-barri SD of 0.43, and at n = 19 the sampling error
  of a barri mean is about the same size.
- **Normalisation:** stretch to 0–100 (after shrinkage the barris span 6.55–8.33, so the defaults are 6.5 and 8.4),
  `clamp(0, 100, (s_adj − VITE_LOCALS_SATISF_MIN) / (VITE_LOCALS_SATISF_MAX − VITE_LOCALS_SATISF_MIN) × 100)`.
  On the raw 0–10 scale every barri would land between 65 and 86, so the slider would barely change anything.
- **Hex value:** a hex takes the value of the barri that contains its centroid. Hexes outside Barcelona city get
  `null`, and the missing-data rule from 022 applies.
- **Map:** cells in barris with `n < VIBE_ESM_MIN_N` are treated as missing data (060): score range and hatch.
- **UI:** slider label "Locals' opinion", default weight 0.
- **Hex card, component breakdown:** shows the normalised score, like the other components. The raw values are
  in the block below.

## Hex card block: "What locals say"

The block is shown for every hex inside Barcelona city, whatever the weight. Outside the city it shows one line:
"Not available outside Barcelona city".

```
What locals say                         el Raval
Satisfaction       6.6 / 10    city 7.8
Would stay here    36%         city 55%
Trend vs 2015–19   ▼ 0.6
Main problems
  Insecurity       44%         city 25%
  Cleanliness      10%         city 11%
  Noise             8%         city 6%
Barcelona city survey (ESM) 2022–26 · 770 interviews
```

| Row | Field | Notes |
|---|---|---|
| Satisfaction | `esm_satisf` | The raw barri value, not the shrunk value |
| Would stay here | `esm_stay_pct` | "If I moved, I'd stay in this barri" |
| Trend vs 2015–19 | `esm_satisf_delta` | Hidden when `n < VIBE_ESM_MIN_N` |
| Main problems | top 3 of `esm_prob_*_pct` | Fixed list, see below |
| Footer | `esm_n` | Shows a small-sample note when `n < VIBE_ESM_MIN_N` |

Every value is shown next to the city median (median over the 73 barris).

**Problem list (fixed):** Insecurity, Cleanliness, Noise, Housing access, Tourism & crowding, Incivility,
Drugs & squats, Maintenance & works, Parking, Traffic. Only the numeric `esm_prob_*` fields are used, never
the raw `esm_top_problem` labels, because the ESM coding includes an "immigration-related problems" category.

**Not shown:**
- `esm_best_pct` / `esm_worst_pct`: they read as labels and track price.
- `esm_safety`: it duplicates the insecurity share and is the most stigmatising number.
- `esm_noise_mgmt`: it rates a city service, and could be confused with the Noise component.
- `esm_future_net`: every barri is optimistic (+7 to +76 pp), so it carries little information.

## Data sources

| Data | Source | Level | Cadence | Licence |
|---|---|---|---|---|
| ESM microdata (`esm-bcn-evo`) | Open Data BCN | respondent → barri / gran barri | annual | CC BY 4.0 |
| Barri geometry | `data/areas/barris.geojson` | barri | — | Open Data BCN |

## Pipeline

`scripts/build_neighbourhood_vibe.py` writes `frontend/public/data/barri-vibe.json` (~36 KB):

- `barris`: per barri code, the card fields, `satisfAdj`, `n` and `lowN`;
- `city`: medians over the 73 barris;
- `hexes`: H3 cell → barri code (centroid in polygon) for the cells of `livability-h3.geojson`. The map is
  kept here, not in the grid file, so a grid rebuild doesn't need this script.

Rerun it once a year, when a new ESM release comes out, and after the grid changes.

Frontend: `services/localsOpinion/localsOpinion.ts` loads the file (only with the flag on). `compositeData`
attaches the barri record to each bundle, `computeComposite` adds the component, and `HexDetailCard` renders
the block.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `VIBE_ESM_YEARS` | 2022–2026 | pipeline |
| `VIBE_ESM_MIN_N` | 100 | pipeline (small-sample flag) |
| `VIBE_ESM_SHRINK_K` | 100 (σ²within / τ²between ≈ 3.59 / 0.039 ≈ 93 on 2022–26 microdata) | pipeline |
| `VITE_LOCALS_SATISF_MIN` | 6.5 | frontend |
| `VITE_LOCALS_SATISF_MAX` | 8.4 | frontend |
| `VITE_FEATURE_LOCALS_OPINION` | false (public), true in `.env.test` | frontend flag |

## Pre-analysis (2026-10-22 / 26)

Data, QGIS project and full findings: `data/neighbourhood-vibe/README.md` (gitignored).
Build: `scripts/build_neighbourhood_vibe.py`. Tests: `scripts/test_neighbourhood_vibe.py`.

- Satisfaction ranges from 6.6 (Raval) to 8.6 (Montbau). Raval: 47% say it's "one of the worst" barris.
  Sarrià: 92% say it's "one of the best".
- Insecurity is the top problem in 52 of 73 barris. The second-ranked problems differ more between barris:
  - noise: Antiga Esquerra de l'Eixample 21%
  - tourism: Sagrada Família 27%, la Salut 21%
  - housing: Poblenou 15%
  - cleanliness: Sarrià 21%
- Raval, Gòtic and Sant Pere/Ribera lost 0.5–0.6 points vs 2015–19.
- Lden does not capture what residents call noise (ρ = +0.02 with residents naming noise). That noise comes
  from nightlife, people and tourists.

## Known limitations

- Barri level only. Barcelona city only, no AMB.
- Seven barris have small ESM samples (n < 100), and the survey is stratified by gran barri.
- Residents rate their own barri. That is not the same as how a newcomer would rate it.

## Deferred: guests' view (Inside Airbnb)

This part is not in scope now. Revisit it only if the residents' block proves too thin.

- Review text agrees with residents (quiet − noisy vs residents naming noise ρ = −0.61; "safe" vs ESM safety
  ρ = +0.53). The Airbnb location score does not (ρ = +0.08), because it measures centrality.
- 23 barris have fewer than 300 reviews in 3 years. `neighborhood_overview` is empty in the 2026-09-17 snapshot.
- The keyword lexicon can't tell "quiet flat" from "quiet street". The plan was LLM tagging of 200–300 reviews
  per barri:
  - each tag gets an `aspect` (`area` / `flat`) and a `polarity`;
  - tags are cached at build time;
  - only aggregates are published.
- Open issues:
  - review text is Airbnb user content;
  - reviews skew positive;
  - LLM provider: Ollama or Claude API.

## Out of scope

- A night / leisure-noise modifier for the Noise component, based on ESM noise complaints. Separate task, later.

## Open questions

None. Shipped behind `VITE_FEATURE_LOCALS_OPINION` for now (decided 2026-10-27).

## Definition of Done

Standard (see `CLAUDE.md`).
