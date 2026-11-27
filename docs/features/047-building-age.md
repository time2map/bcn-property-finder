# 047 — Building age in the index + plain-word panel labels

**Note (2026-11-04):** 049 replaced the component weights with conditions in real units. The importance words below now apply to the risk penalties only; building age is an on / off condition with its eras.

**Status:** Done 2026-11-04. Moved out of 046 (stage 5, "building attributes as weights"). TODO-045 (panel labels
in real units) was merged in and done here too.

## Idea

The year a building was built says a lot about living in it: heating bills, noise from the neighbours,
structural risks and future repair levies, and taste (old charm vs new comfort). There is no year after which
a building is "definitely no", so age is a **weight over eras the user likes** (option B), not a filter.

User story: *As someone choosing a flat, I want to steer away from buildings of the eras I don't trust, or
towards the old stock I like, without naming an exact cut-off year.*

## Building age

### Eras

| Era | Years | What it means for living there | Buildings | Dwellings |
|---|---|---|---|---|
| Historic | before 1900 | Old town and village cores: thick masonry walls, often no lift, small windows | 4 % | 2 % |
| Modernista & early 20th c. | 1900–1939 | Eixample heyday: high ceilings, mosaic floors, big windows; often renovated | 19 % | 10 % |
| Post-war boom | 1940–1979 | Fast mass housing: thin walls, no insulation (no thermal standard until NBE-CT-79); aluminous-cement floors in some 1950s–70s buildings | 49 % | 60 % |
| First building standards | 1980–2006 | First thermal (1979) and acoustic (NBE-CA, 1981–88) standards | 23 % | 22 % |
| Current building code | 2007 on | Código Técnico (2006): insulation, soundproofing, accessibility | 5 % | 7 % |

Shares are over the 173,634 buildings of the map (`year_built` missing for 26).

### Score

- `services/buildings/buildingAge.ts`:
  - `ageScore(year, likedEras)` gives 100 inside a liked era and 0 elsewhere;
  - it fades linearly to 0 over `VITE_AGE_ERA_BLUR_YEARS` (5) outside a liked era: 1978 next to a liked
    1980–2006 scores 60;
  - with several liked eras, the best one counts.
- **Catastro's 1900.**
  - 9,695 buildings say exactly 1900, against 64 for 1899 and 61 for 1901. It is Catastro's date for old
    buildings of unknown year.
  - `VITE_AGE_UNCERTAIN_YEAR` (1900) counts for both neighbouring eras (Historic and Modernista).
  - The card notes that the exact year is unknown.
- **Unknown year**: missing data. It gives the building a score range and the hatch (060), as
  for the other components.
- **Renovation year**: shown in the card only ("Renovated 1995 — shown only; the score uses the year built").
  Catastro does not say how deep a renovation went.
- **Weight `age`**:
  - off by default (0); turning it on sets 5 ("Matters");
  - when first turned on, every era is liked, so the map changes only once the user unticks an era (gear
    modal "Building age — eras you like");
  - at least one era stays ticked.
- **ENV**:
  - `VITE_AGE_ERA_BOUNDS` (`1900,1940,1980,2007`). The era names and texts are written for these bounds; with
    other bounds the eras are named by their years.
  - `VITE_AGE_ERA_BLUR_YEARS` (5);
  - `VITE_AGE_UNCERTAIN_YEAR` (1900).
- **Store**:
  - `compositeWeights.age`;
  - `ageEras`, stored in localStorage as `bcn_age_eras`. Unknown ids are dropped; if none are left, every era
    is liked.
- **Best zones** follow automatically, through `buildingScores`.

### Data

`scripts/build_building_tiles.py` adds the score column `year_built` (u16, sentinel 65535) to
`buildings-scores.bin.gz` (1.9 → 2.1 MB).
- The rebuild left every previous column byte-identical: same rows, same feature ids.
- The two `.pmtiles` differed only in bytes, so the committed ones were kept.

## Panel labels (TODO-045 merged)

- **Weights and risk penalties in words**, one "how much it matters" scale. The number 1–10 is gone:

  | Value | Label |
  |---|---|
  | 1–2 | Slightly important |
  | 3–4 | Somewhat important |
  | 5–6 | Matters |
  | 7–8 | Important |
  | 9–10 | Top priority |

  The checkbox still turns a component off.
- **Real scale under each component that is on**, worst → best. The numbers come from the formulas and data,
  not from the labels:
  - Walkability: "No services close → all everyday services close";
  - Noise: "≥ 75 dB, very loud → ≤ 45 dB, very quiet" (`QUIET_DB` / `LOUD_DB` in `noiseScore.ts`);
  - City Core: "> 90 min → ≤ 15 min walk" (`LANDMARK_FULL_MIN` / `LANDMARK_ZERO_MIN` in `cityCoreScore.ts`);
  - Market Price: "€6.213 → €2.105/m²" (`price_bounds` p95 → p5 in `buildings-meta.json`);
  - Locals' opinion: "Satisfaction 6.5 → 8.4 out of 10";
  - Building age: "All eras count — untick the ones you don't want", or "Liked: …".
- The info modal has a Building age paragraph.

## Building card

- "Built 1968 · Post-war boom · renovated 1995".
- For year 1900: "Catastro's date for many old buildings — the exact year is unknown".
- With the age weight on, a **Building age** section shows:
  - the score bar;
  - "Post-war boom, 1940–1979 — not one of your eras". The other wordings are "counts as one of your eras"
    and "at the edge of one of your eras";
  - the renovation note.

## Not doing

- Age as a filter (greying out eras): the weight does the job without hard edges.
- Splitting Post-war boom at 1960: discussed, the five eras above were chosen.
- Energy certificates and ground-floor premises: TODO-048 (draft).

## Tests and checks

- **Unit tests:**
  - `buildingAge.test.ts`: eras, blur, 1900, unknown year;
  - `compositeScore.test.ts`, `buildingScore.test.ts`: the age component;
  - `store/index.test.ts`: defaults and persistence;
  - `CompositeControls.test.tsx`: words, scales, the eras modal;
  - `BuildingCard.test.tsx`: era, 1900 note, age section.
- **Integration**: `BuildingsLayer.test.tsx`, where unticking an era rescores the buildings of that era.
- **Python**: `test_build_building_tiles.py`, the `year_built` column.
- **Manual (headless Chrome, around Sagrada Família, z16)**:
  - turning Building age on changes nothing;
  - unticking Post-war boom turns the 1960–70s infill red while the older Eixample blocks stay green;
  - the card of a 1975 building says "Post-war boom, 1940–1979 — not one of your eras", 0 / 100;
  - the panel shows the words and the real scales.

## Definition of Done

Standard (see `CLAUDE.md`).
