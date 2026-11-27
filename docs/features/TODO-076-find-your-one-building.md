# TODO-076 — Find your one building: rank what matters, get the single building that fits it best

**Status:** Idea, explored on data 2026-11-16. Not agreed for the launch; not planned. It changes a decision in
`docs/media/STRATEGY.md` ("the interface stays practically as it is"), so the owner decides whether and when.

## Why

The launch needs a result people pass on (`docs/media/VIRAL_CASES.md`, third round). In every case that spread through
its result, the result was a name about the person ("I got Portland", "I am Precariat"), not a score of an object. Our
card says "this building: 83 for my conditions". This feature turns the answer around: the person says what matters
and in what order, and the map names **one building** (with its barri) where all of it meets best.

- Forwardable: "my one building in Barcelona is in el Poblenou; I live in Sants".
- Arguable: "do you agree?" carried the BBC class calculator and "Know Your Place".
- The couple (M2): "the one building where both of our lists meet".
- For buyers of maps: multi-criteria optimisation with priorities is exactly what time2map sells.

## The idea (owner, 2026-11-16)

- A separate panel, like the onboarding, but new.
- The person picks criteria and gives each an importance: very important / important / nice to have / don't care.
  No numbers (no "under 55 dB", no budget).
- The map finds the single building, or a small handful, that fits that set of importances best.

## How it would compute (as explored)

- Each criterion is a continuous "goodness" of a building (minutes, dB, barri price, year, locals' opinion), turned
  into its **percentile among the residential buildings of Barcelona city**, so minutes, dB and euros are comparable.
  No data / out of reach = 0.
- Score = weighted mean of the percentiles, weights from the importance level. Winner = argmax. The winner of a
  positive weighted sum is always on the Pareto front, so "optimal for your priorities" is honest.
- Tie-break: the most dwellings, then a fixed order (deterministic, so a shared link gives the same building).
- A strict order of importance (lexicographic) is **not** used: the first criterion would decide alone.

Script: `scripts/explore_one_building.py` (reads the shipped blob, changes nothing). 12 criteria: cheap (barri
price), quiet (street-side Lden), centre (nearest of Pl. Catalunya, Gòtic, Pg. de Gràcia), metro, park, shops
(supermarket and pharmacy), schools (school and kindergarten), bars (café and restaurant), sea, health, new (year
built), locals (barri satisfaction). 60,993 residential buildings of Barcelona city.

## Findings (2026-11-16, 2,000–3,000 random importance sets per row)

| Setting | Distinct winners | Barris | Top building wins | Top 10 win |
|---|---|---|---|---|
| 3–6 criteria chosen, weights 1/2/3 | 603 | 59 | 4% | 18% |
| 3–6 chosen, without price | 461 | 47 | 7% | 24% |
| price "very important" + 2–5 others | 375 | 37 | 3% | 22% |
| **all 12 chosen, weights 1/2/3** | **28** | **8** | **55%** | **98%** |
| all 12 chosen, weights 1/3/9 | 179 | 26 | 17% | 62% |
| all 12 chosen, weights 1/4/16 | 251 | 33 | 11% | 48% |
| 3–6 chosen, weights 1/3/9 | 599 | 63 | 4% | 15% |
| at most 5 chosen, weights 1/3/9 | 549 | 54 | 4% | 16% |

Other numbers:

- Exact ties at the top: in about 22% of runs, median 1 building, rarely up to 89 (minutes are whole numbers).
- Buildings within 1 point of the best: median 3, p90 12, almost always in **one barri**. A natural result is "this
  building, and two near it".
- Median best score 90 of 100 (as a mean percentile).
- Moving one importance by one step changes the winner in 16% of cases: stable, but it responds.
- Pareto front: 54 buildings for 3 criteria (quiet, centre, metro), 364 for 5, 3,309 for 8. Showing the front is not
  an option; one building is.
- **Price does not collapse to the cheapest barris.** With price "very important" the winners are in el Raval (27%),
  Horta, el Besòs i el Maresme, el Turó de la Peira, les Roquetes, el Carmel. Price only separates barris (73 values),
  the other criteria pick the building inside them.
- **el Poblenou wins too often:** 21–39% of runs depending on the setting, 18% even without the sea. Explained by good
  values on many criteria at once (sea, metro, services, quiet inner streets). It is a fact of the data, but a launch
  where "everyone gets Poblenou" is the BuzzFeed "everyone gets Portland" effect: funny once, then a joke against us.
- **The most frequent winners are odd buildings:** one dwelling (a house), or 45 dwellings at 66 dB from 1810. The
  winner is an extreme, and extremes are where data errors live (the "beach" case). A sanity filter is required.

## What follows for the design

1. **Weights must be steep (1/3/9 or so), or the number of criteria limited (at most 5).** With weights 1/2/3 and
   everything chosen, 28 buildings serve everyone. "Don't care" must be the default for every criterion.
2. **The result is one building plus "two more near it"**, and the barri name is part of the result.
3. **Sanity filter on the winner:** at least N dwellings (a house is not a result), data present for every chosen
   criterion, no building with a known data issue. Numbers to decide.
4. **The Poblenou effect** needs an answer before launch: accept it and say it ("el Poblenou fits most lists"), or
   make the result less concentrated (e.g. one winner per barri shown as alternatives).
5. **Tone:** "where your priorities meet", never "your home"; people live there and the building is not for sale.

## Variants of asking (thought through 2026-11-16)

| | Variant | How the person answers | For | Against |
|---|---|---|---|---|
| A | **Funnel** (recommended) | Step by step: "what matters most?", then "and next?". Each pick keeps only the best share of the buildings still in play; the rest go dark on the map; a counter falls: 35,604 → 3,560 → 410 → 38 → 4 → 1 | The order is the importance: no scales. The narrowing is visible, good for a screen recording. A different order of the same wishes gives a different building | Hard cuts: a building just under the line is out. The cut share must be tuned (below) |
| B | Importance levels | One panel, each criterion: very / important / nice / don't care; weighted sum (explored above) | Simple to build, one screen | No narrowing, the answer just appears. "Everything matters" gives everyone the same building. el Poblenou wins most |
| C | Duels | 6–8 questions "this or that": "a quieter street, or 5 minutes closer to the metro?"; weights are learned from the answers | Feels like a quiz; no criteria list to read | Hard to build and to explain; the result cannot be traced back to the answers |
| D | Funnel with strictness | As A, and at each step the person picks how strict: "a little / clearly / only the very best", seeing the count before confirming | Gives the 3–4 levels the owner asked for; the person controls the pace | One more decision per step |

### Funnel on the data (2,000 random runs per row, buildings with ≥ 4 dwellings: 35,604)

| Share kept at each step | Ends with exactly 1 | Steps needed | Distinct winners | Top barris of the winner |
|---|---|---|---|---|
| 10% | 73% (2–5 left: 24%) | median 7 | 732 in 53 barris | el Poblenou 18%, el Raval 9%, la Dreta de l'Eixample 7% |
| 20% | 9% (2–5 left: 48%) | 8 is not enough | 413 in 43 | la Vila de Gràcia 25%, el Raval 13% |
| 33% | 0% | 10 is not enough | 146 in 24 | la Vila de Gràcia 25%, Sants 18% |
| 10 / 25 / 50% by level | 11% | 8 is not enough | 500 in 48 | la Vila de Gràcia 18%, el Poblenou 12% |

- From 35,604 to 1 is a factor of about 35,000. Five steps need about 12% kept per step; four need 7%; seven need 22%.
- **Order matters:** the same five criteria in their 120 possible orders give a median of 5 different winners (1 to 25).
- **Some steps do nothing.** "Sea" has no data for 94% of buildings, so "keep the best 20%" keeps everyone: it must be
  a yes / no gate ("within walking distance of the sea"). "Bars" keeps 34% when asked for 20% (whole minutes, many
  ties). A step that cannot cut the buildings still in play must not be offered: "all remaining buildings have this".
- A minimum of 4 dwellings removes 42% of the buildings (houses and very small ones). The number is to be decided.

### Recommended shape (A, with D as an option)

1. Start: "35,604 buildings. What matters most?" A list of 10–12 wishes as words, not numbers: quieter, cheaper barri,
   closer to the centre, metro, a park, shops, schools, bars and restaurants, the sea (gate), a newer building, a barri
   its residents like.
2. Each pick cuts by a share that depends on **its place in the order**: the first is the strictest. E.g. 5 picks keep
   5%, 10%, 15%, 25%, 40%: about 3 buildings left. The exact ladder is tuned so that five picks end at 1–5 buildings.
3. After each pick: the counter, the map with the survivors, and one line of fact ("the 3,560 quietest: under 52 dB on
   the street side"). The real threshold is shown after the pick, never asked.
4. Stop when ≤ 3 are left, or when the person stops: the winner among the survivors is the best on everything picked;
   the others are "also close".
5. Result card: the building, its barri, the path of numbers and the picks in order. That is the share picture.

### The ladder for 5 steps (2026-11-16)

`python3 scripts/explore_one_building.py --funnel [--exclude locals]`

**A fixed ladder does not work.** Keeping the same share at every step either ends too early (3–5% per step: one
building after 3 steps, steps 4 and 5 do nothing) or not at all (10%: half the runs still have more than 3 at step
5). The criteria are correlated and full of ties, so the narrowing per step is not predictable in advance.

**An adaptive ladder works.** At each step the share kept is computed from the buildings still in play, so that the
fifth step ends near 2:

    share kept at step i = (2 / buildings left) ^ (s_i / (s_i + … + s_5)),  strictness s = 3, 2.5, 2, 1.5, 1

The first step takes the largest part of the narrowing (it keeps about 5%: 35,604 → about 1,900), the last the
smallest (about 18–20% of what is left). Typical paths: 35,604 → 1,952 → 212 → 40 → 8 → 2.

| | Result (2,000 runs) |
|---|---|
| All 5 steps used | 100% |
| Left after step 5 | 2–3: 64%, 4–5: 20%, more: 16% (ties in whole minutes); the best of them on the weighted picks is the one building |
| Distinct winners | 671 in 60 barris; the most frequent building 3.5% |
| Barris of the winner | el Poblenou 24%, el Raval 7%, la Dreta de l'Eixample 7%, Horta 6% |

### Checking the winners by hand (Catastro data from the card tiles)

The 30 most frequent winners and 15 random ones were looked up in `buildings-detail.pmtiles`:

- **All 45 are residential, condition "functional", with a real address** (e.g. CL Lope de Vega 83, el Poblenou,
  20 dwellings, 2006; CL Aneto 16–18, el Turó de la Peira, 100 dwellings, 2018; CL Consell de Cent 368, la Dreta de
  l'Eixample, 9 dwellings, 1880). No student residence, no ruin, no non-residential use. With the 4-dwellings minimum
  the "odd winner" problem of the weighted variant (a house with one dwelling) is gone.
- Some winners are loud (up to 74 dB): when "quieter" was not picked. Correct, but the result card must show the noise
  anyway, so that it is not a surprise.
- **The Poblenou cluster:** 11 of the top 30 are on two streets near the Rambla del Poblenou (Pujades, Lope de Vega).
  They are at 1 minute from a metro, a park, shops, schools and bars, and el Poblenou has the highest residents'
  satisfaction in the survey (8.3, 98th percentile). **The cause is "a barri its residents like"**: a barri-level
  criterion lets the whole barri through one step at once, and then its best corner wins the rest.
  Without that criterion el Poblenou drops from 24% to 10%, and the most frequent barri is el Raval with 14%.
- **The barri price works the other way:** without "cheaper barri" the winners concentrate in the expensive barris
  (la Dreta de l'Eixample 19%, Sant Gervasi - Galvany 13%) and only 36 barris ever win. Price keeps the result spread.

### Decisions this suggests

1. Adaptive ladder, 5 steps, strictness 3 / 2.5 / 2 / 1.5 / 1. Keep the formula and the numbers in ENV.
2. At least 4 dwellings for a building to take part (removes 42% of the buildings, mostly houses).
3. ~~"A barri its residents like" out of the funnel~~. Revised by the population simulation below: with realistic
   personas it makes the results more varied, and el Poblenou is 15%, not 24%. Keep it; watch el Poblenou.
4. "Cheaper barri" stays: it is what spreads the results over the city.
5. The sea is a yes / no gate, not a step.
6. Ties after step 5: the winner is the best on the picks weighted by their order; the rest are "also close".

## Simulation on a population of users (2026-11-16)

`python3 scripts/simulate_one_building.py [--with-locals]` (about 30 s). Interest cannot be simulated; what is
measured are the properties that made comparable results spread (VIRAL_CASES.md): personal, comparable between
friends, responsive to the answers, good, and not an artefact of noise in the data.

**Population:** 20,000 users. Personas: general 35%, family 20%, young 25%, retiree 15%, random order 5%. Each user
picks 5 wishes in order by a Plackett-Luce draw from popularity scores per persona (a family puts schools and parks
first more often, a young person bars and the centre); the sea is a separate yes / no. Also: every one of the 110,880
possible ordered sets of 5 wishes (± sea).

| Property | Without "locals" | With "locals" |
|---|---|---|
| Distinct buildings among 20,000 users | 1,169 (effective number 381) | 1,469 (515) |
| The most frequent building | 2.4% of users | 2.6% |
| Two random users get the same building | 0.5% | 0.4% |
| … the same barri | 6.5% | 6.3% |
| Barris that ever win | 61 of 73 (effective 22) | 66 (effective 24) |
| Most frequent barris | el Raval 14%, Sant Pere / la Ribera 10%, el Turó de la Peira 9%, el Gòtic 8% | el Poblenou 15%, el Raval 10%, Sant Pere / la Ribera 9% |
| All possible ordered sets: distinct buildings | 1,480 | 2,028 |
| Two friends: distance between their buildings | median 3.6 km; same barri 6% | 3.8 km; 6% |
| Swap wishes 1 and 2 → another building | 42% (median 1.5 km away) | 43% |
| Replace one wish → another building | 75–83% | 74–83% |
| Winner on the weakest of the 5 wishes | median top 49% of the city | top 51% |
| Winner in the top 25% on every wish | 32% of users | 30% |
| Couple (wishes in turns): joint building is one of their own | 10%; median 2.7 km from each partner's | 8%; 2.9 km |
| **Noise in the data (±1.5 dB, ±1 min): the same building** | **13%** (within 300 m 52%, same barri 54%) | **14%** (56%, 61%) |

District of the winner against its share of buildings (without "locals"): Ciutat Vella 32% vs 9%, Nou Barris 20% vs
10%, Sant Martí 16% vs 10%; Eixample 8% vs 16%, Gràcia 3% vs 10%, Sant Andreu 2% vs 8%, les Corts 2% vs 4%.

With realistic personas el Poblenou is 15% with "locals", not 24% as with random orders (the earlier finding).
"Locals" in fact makes the results more varied (66 barris, 2,028 buildings in the whole space).

### What it says

1. **Personal and comparable: yes.** Two people almost never get the same building (0.4–0.5%) and rarely the same
   barri (6%); friends' buildings are a median 3.6 km apart. "I got el Raval, you got Horta" works.
2. **The answers matter: yes.** Swapping the first two wishes moves the building in 42% of cases, by about 1.5 km.
   Nobody gets a fixed answer whatever they say.
3. **The couple story works:** in 90% of couples the joint building is neither partner's own, about 3 km from both.
   "A third place" is M2's headline.
4. **The city is not covered evenly.** Ciutat Vella gets 3.5 times its share of winners, Gràcia and Eixample a third
   to a half of theirs. The data favour the old centre (everything at 1 minute) and the cheap north. A Barcelona
   reader may expect Gràcia; the map rarely says it. Arguable, which helps a story, but "the map sends everyone to
   el Raval" is a predictable headline, and el Raval's night noise and safety are not measured.
5. **The winner is a compromise, not the best on everything.** On the weakest of the 5 wishes it is at the city median;
   only 32% of users get a building in the top 25% on all five. The card must say "the best balance in your order",
   not "the best on everything". (A weighted sum gives better balance, top 26% on the weakest, but less variety and
   more el Raval: 26–30%.)
6. **The exact building is not robust; the area is half robust.** With realistic measurement noise the same building
   comes out in 13% of cases, the same barri in 54–61%. Coarser values (2–3 dB, 2–3 min) and "the heart of the
   cluster" did not help (9–13%); the weighted sum is barely better (18–21%). At the top there are always several
   near-identical buildings, and the data cannot tell them apart. **"The single best building for you" is a claim
   the data does not support.** It can be "a building at the heart of your best spot", with its neighbours shown.

### Recommendation

- Keep the funnel as the interaction (visible narrowing, variety, the answers matter).
- Present the result as **your spot** (the buildings left after step 5 and their street / barri) with one building
  pinned, worded "one of the buildings that fit your order best; the ones around it fit almost as well". Never "the
  best building in Barcelona for you".
- Keep "locals" (more variety); watch el Poblenou and el Raval in the quiet run.
- Show on the result how the building does on each wish (top N% of the city), including the weak one: honest, and
  the weak one is what people will argue about.
- Interest itself is tested only in the quiet run: share of people who finish the 5 steps, share who share the
  result, share who run it again with another order, and what they say is wrong.

## Prototype (2026-11-16, branch `feat/076-funnel-prototype`)

A technical prototype for the owner, to try the funnel by hand on the real data. Desktop only. On production since
2026-11-17, reachable only with `?funnel` (no link to it in the UI, not announced).

**Open:** `VITE_FEATURE_ONE_BUILDING=true` in `frontend/.env.local`, restart `npm run dev`, open `/?funnel`.

**What it does:**

- The top panel becomes the funnel. "35,604 homes in Barcelona. What matters most?": 11 wishes as buttons, and a
  switch "Within walking distance of the sea" (a gate, not a step).
- Each pick keeps the best share of the homes still in play (the adaptive ladder, `VITE_FUNNEL_*`). The panel shows
  the path of counts and what each step kept ("1,905 · Quieter street · up to 50 dB on the street side").
- A wish that cannot narrow the homes left is greyed out ("All the homes left already have this").
- After 5 steps: "Your building is in <barri>", the winner's rank in the city for each wish, how many more homes fit
  almost as well, and "Open its card" (the usual building card).
- "Back" and "Start again".
- The map: every home that takes part is a dot. Orange = still in play, grey = dropped, red = the winner. The map
  fits the homes left once there are 500 or fewer. The livability colours and the area view are hidden while the
  funnel is open.

**Code:**

- `frontend/src/services/funnel/`: `funnelConfig`, `percentile`, `funnelWishes`, `funnel` (pure logic), `funnelData`
  (loading).
- `hooks/useFunnel.ts`; `components/Funnel/FunnelPanel.tsx`, `FunnelLayer.tsx` (lazy-loaded); `funnel` namespace in
  `locales/{en,es,ca}`; `funnelOpen` / `funnelPicks` / `funnelSea` in the store.

**Same as the simulations:** `funnelShippedData.test.ts` runs four orders on the shipped data and checks the path of
counts and the winning building against `scripts/simulate_one_building.py --order …`. They match exactly. When the
data is rebuilt the test is skipped (file hash); rerun the script and update the expected rows.

**Found while trying it:**

- The homes left after step 5 are **not always one spot.** In "quieter → metro → park → shops → cheaper" the winner is
  in les Roquetes and the two others are near Sant Andreu, about 2 km away. The wording "your spot" / "here" was
  wrong and is replaced by "Your building is in <barri>" and "N more homes fit almost as well: the orange dots on
  the map". Whether to show the alternatives by their own barri is open.
- The building card opened from the result shows the match with the conditions saved in the main panel (e.g.
  "64 · Partial match"), which has nothing to do with the funnel. Confusing; for a public version the card needs a
  funnel mode or the result needs its own card.
- Not part of the funnel: in `npm run dev`, zooming past 14 logs 9 errors "An image named poi-… already exists"
  (`PoiLayer`: React StrictMode runs the effect twice and `loadIcons` checks `hasImage` before an await). Happens
  without the funnel too; harmless; to fix separately.

**What to look at when trying it:** is the narrowing itself interesting to watch; are there orders whose result looks
wrong to someone who knows the city; does "top 59% on quieter" (the weak wish) feel honest or disappointing; is
the winner a building one would want to send to someone.

## Open questions

- Is it a separate panel (owner's idea) or a "Find my one building" button on the existing conditions panel (cheaper
  to test in the December quiet run)?
- Price: keep as a ranked criterion (it behaves) or only as a hard budget (073)?
- Couples: two sets of importances combined how (sum of weights, or the max of the two)?
- Does the winner show its score, or only "the best match for your priorities"?
- Share picture and link: the building, its barri, the list of importances.

## Definition of Done (when planned)

To be written with the plan. At least: unit tests for normalisation, weights, tie-break and the sanity filter;
the result is deterministic for a link; one integration test for the happy path; numbers above recomputed with the
final criteria.
