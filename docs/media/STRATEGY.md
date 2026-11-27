# Launch strategy

Rewritten 2026-11-15 after three rounds of discussion with the owner. The first version (2026-11-14, noise as the
lead story) is dropped; what was dropped and why is listed at the end. Evidence: [VIRAL_CASES.md](VIRAL_CASES.md),
[BARCELONA_PRECEDENTS.md](BARCELONA_PRECEDENTS.md).

**Status: agreed with the owner on 2026-11-15.** [STORIES.md](STORIES.md), [CHANNELS.md](CHANNELS.md) and
[LAUNCH_PLAN.md](LAUNCH_PLAN.md) are rewritten for this idea.

## Why we do this

The traffic is for the company. time2map builds maps and geodata projects to order, for clients in any field
(environment, mining, tourism and others; most likely not the public sector). **The result that counts is contacts
of people who want a map made**, not visits. The map is the showcase: a multi-criteria evaluation that a person
sets up in plain words is the same task as "where can we build, protect or open, given these constraints".

## The idea in one sentence

**Say what matters to you, tap any building in Barcelona, and see how well it fits you and how it compares with
the rest of its barri and of the city.**

## The path (three steps; the interface stays practically as it is)

1. **Say what matters.** The first screen: a profile or a few sentences in plain words (031, 052). This is the
   questionnaire; no separate quiz is built.
2. **Pick any building.** Tap it on the map or type an address (044). Any building: where the person lives, where
   their parents live, the flat they are thinking about. We never call it "your home".
3. **Read the card.**
   - **The score, named for what it is:** "Match with your conditions: 83 of 100" (exists as "Good match · 83";
     the wording becomes explicit).
   - "Meets 3 of 4 of your conditions" and the row for each condition (exists, 050; stays in plain sight).
   - **"This home is better than 80% of homes in la Vila de Gràcia"** and **"… better than 64% of homes in
     Barcelona"** (built, 070). Each is an award with an icon, shown only inside a tier (`VITE_RANK_TIERS`,
     "Top 10%" / "Top 20%" since 2026-11-16), and the barri and the city are judged separately. Below it the line is absent: no
     scale, no words, nothing that reads as a verdict. The wording per language is in
     [070](../features/070-building-rank-in-barri-and-city.md).
   - Save image / Share (exists, 063); the award lines go on the picture.
   - Everything technical (Catastro facts, noise by facade, walking times, risks) is folded under "Details".

> **Decided (owner, 2026-11-15):** no general score in the manner of Vivino. The two ranks are personal: the
> selected building is better than N% of homes in its barri, and separately in the city, **for the person's own
> conditions, not in general**, and the card says so.

## Product work

The software is not rebuilt. The right tools are made more visible.

| Item | What | File |
|---|---|---|
| The card | the score named as the match with the person's conditions; the two awards (barri, city) when the building stands out, on the card and on the share picture; technical details folded | [070](../features/070-building-rank-in-barri-and-city.md) |
| Retiree profile | replaces the investor profile on the first screen (done) | [069](../features/069-retiree-profile-replaces-investor.md) |
| Contacts for time2map | credit, a way to ask for a map, case-study page, "I want my city" | checklist in [LAUNCH_PLAN.md](LAUNCH_PLAN.md) |
| Infrastructure | A1 hosting, A2 observability before any press link | ROADMAP.md |
| Data | the inland "beach" problem fixed (done 2026-11-15, `bb7e495`); sea numbers to recompute | checklist in LAUNCH_PLAN.md |

## How it is told

- **The short story for the media:** "A map where you say what you want from a home, tap any building, and it tells
  you how well it fits and how it stands in its barri and in the city." One sentence, three steps, a result in
  under a minute.
- **The tone is light.** Curiosity and a little pride. Nothing about the housing crisis, no gloom.
- **Scenarios, not one use:** the building you live in; your parents' or a friend's; the one you are viewing this
  weekend; the one you left.
- **The couple (the strongest scenario):** one wants quiet, the other wants a restaurant downstairs. Both put their
  conditions into one mix, and the map scores where to live. No extra feature: it is the same conditions panel
  with two people at it. Good for radio and for short video.
- **For buyers of maps:** the same thing described as a method, on the company's case-study page.

## Parked (not for the launch; possible later waves)

| Idea | Why parked |
|---|---|
| Showing who gets what in a couple's result | the owner wants no additions beyond the two scales |
| AI: wishes in free text, a short verdict with a voice | needs a small server function for the key; a good second-wave reason to be written about ("now you can just say it"); matches the 2026 "talk to the map" trend |
| "I don't agree with this result" | wanted, but needs a way to collect answers; later |
| Price level of the barri against the fit ("you pay for something not on your list") | borders on the price subject; not needed for the launch |
| "Guess your barri" game | a separate product |
| "Find your one building": rank what matters, get the single building where it meets best | proposed 2026-11-16 as the forwardable result; explored on data, not agreed; [TODO-076](../features/TODO-076-find-your-one-building.md) |

## Dropped

| Idea | Why |
|---|---|
| Noise as the lead story | the subject is taken (BARCELONA_PRECEDENTS.md); not our data; reduces the product to one criterion |
| Stories about the cost of housing, "the city goes dark" | too dark; the owner wants nothing about the crisis |
| "N% of Barcelona fits you", "my Barcelona" | the person is choosing inside the city, not comparing cities |
| "Did you choose well?", "your home" | too personal and too narrow: people look at any building |
| A "compare with me" link for two people | a couple can simply put both sets of wishes into one mix |
| Asking for the price of the flat; over- and undervalued homes | people do not know it; we have no price per building; valuing a flat is ruled out in RAW_IDEAS.md |
| The investor profile | contradicts a launch addressed to residents |

## Why this form (against the pattern in VIRAL_CASES.md)

| What the cases share | Now |
|---|---|
| One sentence a stranger can repeat | yes, above |
| A personal result quickly | conditions in one tap (profile), then any address |
| A comparison with others | the two scales |
| A picture that carries the result | exists; gets the two scales |
| Light, no pitch inside | yes |
| The company one click away | to do (LAUNCH_PLAN checklist) |
| A story for the press separate from the tool | "which barri is for whom" and "where two wishes meet" (STORIES.md, M3 and M4); numbers to compute |
| The site survives the spike | to do: A1, A2 |

## Risks

| Risk | What we do |
|---|---|
| The site fails during the spike | A1 and A2 first |
| A percentile without its conditions misleads (the same building gets different numbers for different people) | the profile or the conditions are always on the card and on the picture |
| A perfect building reads as mediocre when many buildings are perfect | no award when a wide group shares the top score: nothing is said rather than "among the best of 93%" (070, changed 2026-11-16) |
| A result contradicts what residents know (night-life noise, safety are not measured) | model limits stated in the UI and on the method page; "I don't agree" later |
| A low result is not shared | accepted; the tone of the card stays neutral, not a verdict on the person |
| Wrong data on a public number | outlier checks before launch; the "beach" case is fixed and has a failing check in the pipeline |
| "A map for buyers / investors" reading | investor profile removed; wording about fit, not about buying |

## Metrics (need A2)

- **Contacts:** requests through the form, the "I want my city" button and email, by source. This is the main one.
- Visits by source; share of visits that reach a building card; time to the first card.
- Card views → Save image / Share; visits arriving from shared links.
- Backlinks and mentions that name time2map.

## Data notes from the discussion (rough, not for quoting)

Computed 2026-11-14/15 with a throwaway script on the shipped data of 2026-11-04: strict "meets every condition",
buildings of Barcelona city, not the app's scoring. Redo with the app's scoring before any number is published.

- One condition alone says little: 88% of buildings are under 65 dB; each everyday service is within 10 minutes for
  93–98%. Combinations are where the differences are.
- The profiles give different places. Family and remote worker share almost no buildings; top barris differ
  (family: Can Peguera, el Bon Pastor, el Besòs i el Maresme; remote: la Barceloneta, Sants, el Poblenou; city:
  Hostafrancs, la Ribera, el Gòtic; retiree: el Turó de la Peira, Sants, Can Peguera). Over 400 random condition
  sets, 27 different barris came first.
- Two wishes at once: quiet (≤55 dB) and close to the centre 9.5%; quiet and the sea 6.3%; the sea and the centre
  3.4%; a park and a metro station within 5 minutes 39%; school and kindergarten plus cafés within 5 minutes 54%.
- Fit and barri price are weakly related (correlation −0.40 for family, +0.17 to +0.31 for the others).
- **Data problem, fixed 2026-11-15 (`bb7e495`):** "beach within 15 minutes" was true for inland barris (Porta 100%, Sant Andreu,
  la Prosperitat) because OpenStreetMap tags an asphalt pool deck in Nou Barris as a beach. Paved surfaces are now skipped.
  The sea numbers above (quiet and the sea 6.3%, the sea and the centre 3.4%) predate the fix: redo them.
