# 049 — Livability conditions in real units ("what is OK for me")

**Changed by 073 (2026-11-16):** noise is checked on the street side; the services exclude the beach and City Core is three central places by default; a place scores 0 at the reach of the data when that comes before 2× the limit; the budget is now a hard condition (see "Not doing").

**Status:** Done 2026-11-04. Replaces the importance weights of the components (022, words in 047) and the
real-scale lines of 045.

## Problem

The panel asked how important each component is (1–10, then words: "Slightly important" … "Top priority").
People still couldn't tell what that meant for a home. A sentence like "75 dB outside is OK for me" couldn't be
written either: a loud building always scored 0 on noise, and the weight only decided how much that zero counted.

## Decision

- Each component is a **condition in real units**: what is OK for the user.
- A building that meets a condition scores 100 on it; beyond the limit the score falls linearly to 0 over the
  fall-off.
- **The index is the mean over the conditions that are on**, so the map colour says how well a home meets the
  conditions. Every condition counts the same; there is no "Must have" for now.
- **Risk penalties stay** as they were (036 / 037): on / off and how much they matter in words.
- With several services or places, the condition is the **share within reach**: each scores on its own, then
  the mean.

## Conditions

| Condition (panel) | Sentence | Data | Default | Slider | Score 0 at |
|---|---|---|---|---|---|
| Walkability | "Everyday services within 10 min walk" / "My 3 services …" | `min_<category>`, walking minutes from the entrance; > 1.5 km = out of reach | 10 min | 5–15 | 2 × limit |
| Noise outside the window | "Up to 65 dB is OK for me — like a busy street" | `lden_avg` | 65 dB | 45–75 | limit + 10 dB |
| City Core Access | "My places within 30 min walk" | `cc_<landmark>` | 30 min | 10–60 | 2 × limit |
| Market Price | "I'm ready to pay up to €4.000/m²" | barri / municipality average sale price (INCASOL) | €4,000 | 1,500–8,000 | limit + 25 % |
| Locals' opinion (042, flag) | "Residents rate their barri at least 7.5 / 10" | `satisfAdj` of the barri | 7.5 | 6.5–8.5 | limit − 1 |
| Building age (047) | "All eras count …" / "Liked: …" | `year_built` | all eras | — (gear) | eras, 5-year blur |

- Noise anchors: ≤ 47 dB "a quiet courtyard", ≤ 57 "a calm street", ≤ 67 "a busy street", else "a main road".
- **Defaults on**: walkability, noise, City Core, price. Locals' opinion and building age are off.
- How many buildings pass the defaults (of 173,634):
  - noise ≤ 65 dB: 57 % (median 57.5 dB);
  - price ≤ €4,000: 62 % (median €3,325);
  - residents ≥ 7.5: about 75 % of barris (range 6.6–8.3).
- **ENV**:
  - the limits: `VITE_COND_NOISE_MAX_DB`, `VITE_COND_PRICE_MAX_EUR_M2`, `VITE_COND_CITY_CORE_MAX_MIN`,
    `VITE_COND_WALK_MAX_MIN`, `VITE_COND_LOCALS_MIN`;
  - the fall-offs: `VITE_COND_NOISE_FALLOFF_DB`, `VITE_COND_PRICE_FALLOFF_PCT`,
    `VITE_COND_MINUTES_FALLOFF_FACTOR`, `VITE_COND_SATISF_FALLOFF`.
- **Removed**: `VITE_LOCALS_SATISF_MIN/MAX` (the old 0–100 stretch).

## Implementation

- **Data.** `buildings-scores.bin.gz` now carries `min_<category>` (walking minutes, u8) instead of the old
  decay sub-scores `walk_<category>`.
  - The file went from 2.1 to 1.8 MB.
  - The other columns are byte-identical, and the committed `.pmtiles` were kept.
- **`services/buildings/conditions.ts`**: `Conditions`, defaults, slider ranges, `atMost` / `atLeast`,
  `noiseCondition`, `priceCondition`, `localsCondition`, `minutesShare`, `noiseAnchor`.
- **Scoring.**
  - `buildingBundle` scores each component from the columns.
  - `computeComposite(inputs, onOff, riskStrengths)` only averages and applies the penalties.
  - Removed: `openPriceScore`, `localsOpinionScore`, `cityCoreScore.ts`, `walkFromCategories`.
  - `noiseScore` stays for the pins.
- **Store.**
  - `conditions`, persisted as `bcn_conditions`, key by key with a fallback to the defaults.
  - `compositeWeights` means on (1) / off (0); weights stored before 049 (1–10) read as on.
- **Panel.** `ConditionRow` is a checkbox, a gear, a slider in real units and the sentence. `StrengthRow` covers
  the risks.
- **Info modal and legend**: "how well homes meet your conditions".
- **Card.** Each block says how the building meets the condition:
  - "1 of 2 services within 10 min";
  - "73 dB — 18 dB over your 55 dB";
  - "7 of 13 places within 30 min";
  - "Sale price: €6.946/m² — 132% over your €3.000/m²";
  - "Residents rate 7.2 — below your 7.5".
- **Best zones** follow, through `buildingScores`.
- **Rescoring time**: 173,634 buildings in about 220 ms, as before.

## Tests and checks

- **Unit tests:**
  - `conditions.test.ts`;
  - `compositeScore.test.ts`, `buildingScore.test.ts`;
  - `store/index.test.ts`: defaults, migration of old weights, persistence;
  - `CompositeControls.test.tsx`: sentences follow the sliders, subsets, risks keep their words;
  - `BuildingCard.test.tsx`, `buildingCardText.test.ts`.
- **Integration**: `BuildingsLayer.test.tsx`, where changing a condition or dropping a service rescores.
- **Python**: `test_build_building_tiles.py`, `min_*` columns present and `walk_*` gone.
- **Manual (headless Chrome, Eixample, z15)**:
  - the default sentences;
  - budget €3,000 with noise 55 dB turns main-road and expensive buildings red, courtyard and cheaper ones green;
  - the card shows "over your …" lines.

## Not doing (yet)

- "Must have" (a stronger or hard condition) for any condition. Since 073 the budget alone is hard (`VITE_BUDGET_HARD`).
- Rent prices: there is no rent data.
- Total price for a flat size instead of €/m².

## Definition of Done

Standard (see `CLAUDE.md`).
