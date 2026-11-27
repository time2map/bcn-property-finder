# 070 — Building card for the launch: explicit match, awards in the barri and in the city, details folded

**Changed 2026-11-16 (tiers):** the award is now a tier, "Top 10%" or "Top 20%" (`VITE_RANK_TIERS=10,20`), in the card and on the
share picture, in place of "better than N% of homes". Each scope shows the narrowest tier the building fits in; outside
both tiers the scope has no line. "Top N%" is the share of homes with the same or a higher score (ties count against the
building, so the claim never overstates and a plateau earns nothing). Measured on the real data before the change
(homes in Barcelona, first visit and the five profiles): the old rule (≥70% beaten, both scopes) gave an award to
33–37% of homes; Top 10% / Top 20% gives it to 19–22%. In the city the tiers are honest (Top 10% = 8–10% of homes,
Top 20% = 18–20%); in a barri Top 10% is rare (2–6% of homes) because many homes tie on one score. When the barri tier is wider than the city one ("Top 20%" in the barri, "Top 10%" in
Barcelona: the barri holds a lot of the city's best homes, so standing out in it is harder) the card adds a dim note under
the tiles, "This is an area with a lot of good homes, so it is harder to stand out in it." (`rank.crowded`, card only: the
share picture keeps the two tiles and no note). The rest of this file
describes the first build ("better than N%"); where it disagrees, this note wins.

**Changed 2026-11-16 (share picture):** on the share picture, the building picture shows the rank as the card's tiles ("87%" over "of homes in l'Hospitalet de Llobregat are a weaker match."), two side by side or one across the width, instead of two sentences "This home is better than N% of homes in …". The sentences repeated their start, wrapped badly in Spanish and Catalan, and "better" read as a verdict on the home to whoever got the picture. When the 1200×630 preview cannot hold everything, the condition rows go (last first, the risk row last), not the tiles. A long band name shrinks to fit the plaque.

**Changed by 073 (2026-11-16):** "better than N% of homes" counts dwellings; the barri size limit and the "more than one building" rule of a tie still count buildings.

**Status:** Implemented (2026-11-15). Agreed with the owner on 2026-11-15 as the product change the media launch
needs (`docs/media/STRATEGY.md`). Extends 050 (match header), 062 (phone sheet), 063 (share image). The first design
(a scale and a word under each rank) was replaced the same day after the owner saw it: see "Decisions".

## Problem

The launch story is one sentence: say what matters to you, tap any building, see how well it fits you and how it
compares with its barri and with the city. The card does not yet say that plainly:

- The score line reads "Good match · 83". It is not obvious that 83 is the match with *my* conditions.
- "Meets 3 of 4 of your conditions" has no "compared with what". Nothing says how the building stands among others.
- Below the match header the card shows everything at once: Catastro facts, noise by facade, walking times, building
  age, climate risks, the barri block. For a person who came from a link it is a wall of technical data.

## Decision (as built)

1. **The score is named for what it is:** a label "Match with your conditions", then "83 of 100 · Good match".
   The phone sheet header reads "83 of 100 · Good match · Meets 3 of 4".
2. **Awards, not ranks.** Under the conditions and the risk line, a block "For your conditions" with one line per
   scope where the building stands out: "This home is better than 80% of homes in la Vila de Gràcia", "… of homes
   in Barcelona", each with a small award icon. No scale, no band words.
3. **A scope gets a line only inside a tier of `VITE_RANK_TIERS` (default `10,20`: "Top 10%", "Top 20%")** of homes (first build: from `VITE_RANK_SHOW_MIN_PCT`, 70% beaten). The barri and the city are judged separately: a weak building in its barri can
   still earn the city line. When neither earns one, the whole block is absent.
4. **The technical details are folded** under "Details about this building", closed by default. The state (open or
   closed) is kept in the store while the person moves between buildings. The photo, the match, the rows, the risk
   line, the awards and Save image / Share stay in plain sight.
5. **Many addresses.** The title is the first address; the others open under "+N more addresses" in a list that
   scrolls past a few lines. On the phone the peek shows the first address and "+N".

Rules that stay: no general score (both numbers are under the person's current conditions); neutral wording ("this
home", never "your home"); "barri" means one of the 73 administrative barris (outside Barcelona: the municipality).

## What was built

- `services/buildings/buildingRank.ts`: score histograms (101 bins) per area, for Barcelona (barris) and for the
  whole data; `rankIn`, `awardTier`, `parseTiers`, `buildingRanks`. Pure, tested. Built on the main thread by
  `hooks/useScoreHistograms.ts` from the scores the map already holds (`buildingScores`), once per rescoring (a few
  milliseconds for ~170k buildings), so the worker protocol did not change.
- What the share counts (first build, "better than N%"; now "Top N%" counts homes at or above, see the note on top): the final score of the building against the final scores of every building of the
  scope under the same conditions; N = share with a lower score, rounded down, at most 99. Buildings, not dwellings;
  all buildings of the data, as everywhere in the app.
- **Ties (changed 2026-11-16, owner).** No special rule: homes with the same score are not beaten, so only the
  threshold counts. The first rule ("among the best: N% of homes fit as well" for the top group, from 2% of the
  scope up) gave an award to a plateau: with a budget under the barri price, 93% of la Vila de Gràcia shared one
  score of 63, and each of those homes read "among the best". A wide plateau now earns no line.
- **Scope.** Barcelona building: the barri, then Barcelona. Elsewhere: the municipality, then "the Barcelona area".
  The barri line is hidden below `VITE_AREA_MIN_BUILDINGS` (50) buildings.
- **Hidden:** no block for a building with incomplete data (060: the card says "No rank: …" instead), before the
  scores are in, and with no conditions on (061).
- **Place wording** (`inPlace.ts`): English "in X"; Spanish "en X" (never contracts); Catalan "a X" with "al" for
  "el" and "als" for "els". The names come from the data with their article ("el Raval"), so one rule per language
  covers every barri and municipality.
- **Share image (063).** The award lines are on the building picture (English like the rest of the picture), with
  the heading "For your conditions" when no profile says for whom. The tall 1080×1350 picture was re-laid out the
  same day: white, with the brand line on top, the map in a rounded rectangle and the result below; the brand no
  longer sits at the bottom among the rows. The 1200×630 link preview is unchanged.
- ENV: `VITE_RANK_TIERS` (replaced `VITE_RANK_SHOW_MIN_PCT`; `.env.production`, `.env.local.example`); `VITE_AREA_MIN_BUILDINGS` is reused.
- Texts: `locales/{en,es,ca}/card.json` (`match.label`, `match.score`, `rank.*`, `ui.details`, `ui.moreAddresses`,
  `ui.fewerAddresses`). ES and CA go into the native read-through (065).

## Decisions

- **Scale and words dropped (owner, 2026-11-15).** The first build had a colour bar with a marker and a word per
  band ("Among the best fits" … "Many others fit you better", `VITE_RANK_BANDS`). It pulled attention from the main
  score and told little. A low rank ("better than 0%") also read badly. Showing the figure only when it is good
  keeps the claim honest: the award says how much better, and nothing is said when it is not.
- **Wording as a sentence, not a label.** "Barri: Sant Antoni — better than 65%" was unclear; "This home is better
  than 65% of homes in Sant Antoni" is plain, and the place phrase handles the contractions per language.
- Percentages follow the locale files: no space before "%" in EN, ES and CA.

## Left out

- "For a family" instead of "For your conditions" as the heading on the card (the picture shows the profile).
- Restricting the count to residential buildings.

## Tests

Rank service (histograms, percentages, ties, award threshold, each scope alone, small area, outside Barcelona);
`inPlace` per language; `useScoreHistograms`; `BuildingCard` (details closed and remembered, awards, no block, phone
peek, addresses list); share model and drawing (award lines, stacked layout, brand on top); env file; locale
completeness.

## Definition of done

As in `CLAUDE.md`; checked by the owner on the dev server (card, phone viewport, saved picture).
