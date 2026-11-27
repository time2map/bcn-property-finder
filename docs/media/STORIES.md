# Stories

Rewritten 2026-11-15 for the agreed idea ([STRATEGY.md](STRATEGY.md)). Theses only. Each story has a headline shape
(not a final headline), what to prepare, who it is for, and what can go wrong. Outlets are in
[CHANNELS.md](CHANNELS.md).

The tone of all of them is light: curiosity, a little pride, a friendly argument. Nothing about the housing crisis.

Every number below is a rough draft from a throwaway script (strict "meets every condition", buildings of Barcelona
city). **Recompute with the app's own scoring and check by hand before anything is sent.**

## M1. The tool: "how well does this building fit you?" (the lead, wave 1)

- **Headline shape:** "A map that tells you how well any building in Barcelona fits what you want from a home."
- **Theses:**
  - Three steps, under a minute: say what matters, tap any building, read the card.
  - The card says three things: how well the building matches your conditions, and how it stands for those
    conditions among the homes of its barri and of the whole city.
  - Any building: where you live, where your parents live, the flat you are seeing on Saturday.
  - The answer depends on the person. The same building can be among the best for a retiree and among the weakest
    for someone who wants bars downstairs.
  - Every residential building of Barcelona and the metropolitan area, about 174,000, from open data.
- **Prepare:** a link that opens on the profile choice; five or six example cards (well-known buildings and
  streets, with different profiles) as pictures; a 20-second screen recording.
- **Risks:** a journalist tries their own building and disagrees. The method page states what is not measured
  (night-life noise, safety, the flat itself).

## M2. The couple: two wish lists, one map (wave 1, the strongest scenario)

- **Headline shape:** "One wants quiet, the other wants a restaurant downstairs. The map finds where both get it."
- **Theses:**
  - Both put their conditions into one set, and the map scores every building for the mix.
  - The same works for flatmates, or for a family deciding with grandparents.
  - A number to open with: quiet and close to the centre together fit about 9.5% of the city's buildings; quiet
    and the sea, about 6% (drafts; the sea numbers predate the beach fix of 2026-11-15 and must be recomputed).
- **Prepare:** two or three ready pairs of opposite wishes with their result maps; a format for radio and short
  video (two people enter their wishes live and see where they would have to live).
- **Hooks:** Valentine's Day (14 February), Sant Jordi (23 April).
- **Risks:** a result that locals find funny for the wrong reason (la Barceloneta comes out as "quiet": the noise
  map is traffic, not night life). Pick the example pairs with a local's eye.

## M3. Which barri is for whom (wave 1, the data story and the barri press)

- **Headline shape:** "Sants for the remote worker, el Turó de la Peira for the retiree: what each barri of
  Barcelona is best at."
- **Theses:**
  - For each of the four profiles (family, remote worker, city life, retiree), the share of homes in every barri
    that fit it. Each barri gets the profile it fits best.
  - The four profiles see four different cities; they hardly overlap (draft: family and remote worker share almost
    no buildings).
  - Surprises on both ends: a barri nobody thinks of that fits a profile very well.
- **Prepare:** the table of 73 barris × 4 profiles (the share pages and pictures per barri × profile exist, 063);
  four maps side by side; one short note per barri with its numbers.
- **Risks:** wording. Always "the share of homes that fit a family's conditions", never "the best barri" and never
  one score per barri (DEPRECATED-027). With a budget in the family profile the cheapest barris come first; decide
  whether the published table uses the budget.

## M4. Where two wishes meet (wave 1 or 2, a light second piece)

- **Headline shape:** "Sea and centre, quiet and bars, park and metro: where in Barcelona you can have both."
- **Theses (drafts):** quiet and close to the centre 9.5%; the sea and the centre 3.4%; a park and a metro station
  within 5 minutes 39%; school, kindergarten and cafés within 5 minutes 54%. For each pair, the barris where it
  works.
- **Risks:** the sea. The data error ("beach within 15 minutes" true for Porta, Sant Andreu, la Prosperitat) is fixed
  (2026-11-15), but the drafts below were computed before it: recompute before any beach number is used.

## M5. A city scored in the browser (wave 3, technical)

- **Headline shape:** "Show HN: 174k buildings re-scored and re-ranked in your browser as you change a condition,
  no backend."
- **Theses:** static files only; every building scored and ranked client-side in a worker; PMTiles; an all-open
  data stack and what each licence asks; what was tried and dropped (the hex grid).
- **Risks:** this audience opens the network tab: third-party calls and bundle size will be discussed (A3, A5).

## M6. The method, for people who buy maps (all waves, the company's own channels)

- **Headline shape:** "Many requirements, one map: how we turned eight public datasets into an answer people set
  up in plain words."
- **Theses:**
  - The Barcelona map is a multi-criteria suitability map with a human front end.
  - The same task in other fields: where to build, protect or open, given these constraints; where the wishes of
    two sides can both be met.
  - What it took: data sources and licences, per-building computation, no server, three languages.
  - What we can do for a client, and how to ask.
- **Where:** the case-study page, LinkedIn, talks. Not the consumer press.

## Later waves (need product work that is parked)

- **"Now you can just say it":** wishes in free text, read by an AI. A second reason to be written about.
- **"Where residents disagree with the map":** once people can mark a result as wrong.

## Stories we do not tell

- Noise as a subject of its own; the 15-minute city; building age (all three have been done in Barcelona, see
  [BARCELONA_PRECEDENTS.md](BARCELONA_PRECEDENTS.md)).
- Anything about the cost of housing, prices, bargains, over- or undervalued homes.
- "Best" or "worst" barris; one score for a barri; a ranking of buildings in general.
- "Your home", "did you choose well".
- Buyers, investors, foreigners.
- Anything built on street flooding, facade photos or scraped listing prices.
