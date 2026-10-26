# TODO-042 — Neighbourhood vibe (what residents and guests say about a barri)

**Status:** Draft. **Do not start until every open question below is resolved.**

## Goal

Show what a barri *feels like*, from two open sources:

- **Residents' view.** Enquesta de Serveis Municipals (ESM) gives satisfaction, perceived safety, top problems,
  and whether residents call their barri "one of the best / worst".
- **Guests' view.** Inside Airbnb reviews give tags such as quiet, noisy, lively, nightlife, safe / unsafe,
  local, touristy.

User story: *As someone relocating to Barcelona, I want to know what living in a barri is like (quiet or lively,
local or touristy, what residents complain about), so I can judge whether it fits me before I visit.*

## Decided: not a Livability Index component

Vibe does not go into the weighted composite, for these reasons:

1. **Coverage.** ESM and Airbnb cover Barcelona city only, which is 644 of 2,635 grid cells (24%). Under the
   missing-data rule (missing data counts as a penalty), every AMB cell would drop. Airbnb text also covers only
   50 of 73 barris.
2. **Resolution.** Each barri value would be spread over about 8 hexes, which creates steps at barri borders.
   Inside a barri, Lden spreads by a median of 7.8 dB (p90 − p10), so one value hides real differences.
3. **No single good direction.** "Lively" vs "quiet" and "local" vs "touristy" depend on the user. A weight
   slider assumes higher = better.
4. **Stigma.** Perceived safety correlates with price (ρ = +0.49). Putting it into the score would silently
   down-rank poorer barris. A transparent sentence, for example "44% of Raval residents name insecurity as the
   top problem", is fairer and easier to explain.
5. **Different nature.** The index is built on measured values (dB, minutes, €/m²). Vibe is opinion.

## Pre-analysis (2026-10-22 / 26)

Data, QGIS project and full findings: `data/neighbourhood-vibe/README.md` (gitignored).
Build: `scripts/build_neighbourhood_vibe.py`. Tests: `scripts/test_neighbourhood_vibe.py`.

**Residents (ESM 2022–26, ~30k interviews, weighted):**
- Satisfaction ranges from 6.6 (Raval) to 8.5 (Montbau). Raval: 47% say it's "one of the worst" barris.
  Sarrià: 92% say it's "one of the best".
- Insecurity is the top problem in 52 of 73 barris. The second-ranked problems differ more between barris:
  - noise: Antiga Esquerra de l'Eixample 21%
  - tourism: Sagrada Família 27%, la Salut 21%
  - housing: Poblenou 15%
  - drugs: Baró de Viver 9%
- Raval, Gòtic and Sant Pere/Ribera lost 0.5–0.6 points vs 2015–19.

**Guests (Inside Airbnb 2026-09-17):**
- The Airbnb location score does **not** track residents' satisfaction (ρ = +0.08). It measures centrality.
- Review *text* does agree with residents:
  - quiet − noisy mentions vs residents naming noise: ρ = −0.61
  - "safe" mentions vs ESM safety: ρ = +0.53
- Listing density vs residents naming tourism: ρ = +0.68.
- 23 barris have fewer than 300 reviews in 3 years. These are the quiet periphery that residents rate highest.
- `neighborhood_overview` (host texts about the area) is empty in this snapshot.

**Overlap with existing components (medians of hexes per barri, 73 barris):**

| Pair | ρ |
|---|---|
| Lden ~ residents naming noise | +0.02 |
| Lden ~ guests quiet − noisy | −0.02 |
| Walkability ~ satisfaction | +0.13 |
| Sale €/m² ~ ESM safety | +0.49 |

No double counting with Noise. Lden is traffic noise. The noise residents and guests complain about comes from
nightlife, people and tourists, and Lden does not capture it. On Lden, Ciutat Vella looks quiet. Both surveys
say it is the noisiest part of the city.

## Data sources

| Data | Source | Level | Cadence | Licence |
|---|---|---|---|---|
| ESM microdata (`esm-bcn-evo`) | Open Data BCN | respondent → barri / gran barri | annual | CC BY 4.0 |
| Listings + reviews | Inside Airbnb, Barcelona | listing (coordinates jittered by Airbnb, up to ~150 m) | quarterly | CC BY 4.0 (review text is Airbnb user content) |
| Barri geometry | `data/areas/barris.geojson` | barri | — | Open Data BCN |

## Pipeline (draft)

Extend `scripts/build_neighbourhood_vibe.py`:

- Export a small per-barri JSON for the frontend, for example `frontend/public/data/barri-vibe.json`.
- Move the constants that affect results to env, per `CLAUDE.md`. See Parameters below.

## LLM tagging of reviews (replaces the keyword lexicon)

The current lexicon can't tell "quiet flat" from "quiet street" and misses paraphrases. Tag shares are low
(lively ≈ 0.6%, unsafe ≈ 0.2% of reviews).

**Sample.** 200–300 recent reviews per barri, stratified by language and listing. About 20k reviews in total.
Barris below the review threshold are skipped.

**Output per review (JSON).** For each tag in a fixed taxonomy:

- the tag itself, from: quiet, noisy, lively, nightlife, safe, unsafe, local, touristy, family, green, dirty, …
- `aspect`: `area` or `flat`. Only `area` mentions count towards the barri.
- `polarity`

**How it runs.** At build time, with results cached, so it is deterministic and not re-run on every build.

**Publishing.** Aggregates only (share of reviews per tag), no verbatim quotes.

**Validation:**
- Manual check of about 100 tagged reviews.
- Compare with the keyword tags.
- Keep the ESM agreement (ρ for noise and safety) at least at the lexicon level.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `VIBE_ESM_YEARS` | 2022–2026 | pipeline |
| `VIBE_ESM_MIN_N` | 100 (below this, flag or fall back to gran barri) | pipeline |
| `VIBE_REVIEW_YEARS` | 3 | pipeline |
| `VIBE_MIN_REVIEWS` | 300 | pipeline |
| `VIBE_LLM_SAMPLE_PER_BARRI` | tbd (200–300) | pipeline |

## Known limitations

- Barri level only. Barcelona city only, no AMB.
- ESM barri samples are small in 7 barris (n < 100). The sample is stratified by gran barri.
- Airbnb reviews skew positive and come mostly from short stays in the centre.

## Open questions (all must be resolved before starting)

- **Decide whether guest reviews go to production at all.** Things to weigh:
  - the review text is Airbnb user content, even though the Inside Airbnb data is CC BY 4.0
  - positive skew
  - no coverage for 23 barris
  - the alternative: ESM only
- **Presentation.** Pick one, or a combination:
  - a separate block in the barri / hex card
  - labels on the map
  - a separate map layer (with barri mode, TODO-027, or as its own toggle)
- **LLM provider.** Local Ollama (already used in feature 006) or Claude API.
- **Safety wording.** How to show perceived safety without stigmatising barris: residents' own numbers, no
  "unsafe" labels.
- **ESM small samples.** For barris with n < 100: show the barri value with a warning, or fall back to the
  gran barri?
- **Night / leisure noise.** Lden misses it. Should ESM noise complaints or review tags become a modifier of
  the Noise component? That would be a separate task.
- **Update cadence.** ESM is annual, Inside Airbnb is quarterly.

## Definition of Done

Standard (see `CLAUDE.md`).
