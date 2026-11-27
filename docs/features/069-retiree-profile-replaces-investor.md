# 069 — "Retiree" profile replaces "Investor"

**Status:** Implemented (2026-11-15). Decided by the owner on 2026-11-14 (media strategy, `docs/media/STRATEGY.md`).
The conditions below were confirmed by the owner on 2026-11-15 ("ок"); the ES and CA texts still go through the native read-through (065). Changes 031 (profiles) and 063 (barri × profile pages).

## Problem

The first screen offers four profiles: family, remote worker, city life, investor (`services/presets.ts`). The launch
addresses residents, during a housing crisis. An "investor" profile on the first screen contradicts that and gives a
ready hostile headline ("a map for investors"). It is also the only profile that is not about living somewhere.

## Decision

- Remove the `investor` profile.
- Add a `retiree` profile in its place (fourth in the list).

## Proposed conditions (to agree)

| Field | Value | Why |
|---|---|---|
| Walk | clinic, pharmacy, supermarket, park within **5 min** | everyday errands on foot; 10 min makes the profile fit a third of the city and say little |
| Noise | up to **58 dB** ("a calm street"), same as family | |
| Price | **off** | most retirees already own; with a price limit the result becomes "the cheapest barris" again |
| Climate risks | avoid | same as family |
| Order | `poiAccess`, `noise`, `risk` | |

Rough check on the shipped data (strict "meets every condition", Barcelona city, not the app's scoring): about 19% of
buildings; top barris el Turó de la Peira, Sants, Can Peguera, Sants - Badal, les Corts, les Tres Torres. The set
shares almost nothing with family (with budget) or city life, and about a third with remote worker, so the profile
gives a result of its own.

**Known gap:** we have no slope and no lift data. Steep barris can come out well for a retiree (el Guinardó appears
in one variant). The profile blurb should not promise accessibility. A slope condition is a separate feature.

## Where `investor` is used

- `frontend/src/services/presets.ts` (`ProfileId`, `BASE`, `OVERRIDES`, `VITE_PRESET_INVESTOR`), `presets.test.ts`
- `frontend/src/locales/{en,es,ca}/conditions.json` (`profile.investor.name`, `.blurb`)
- `frontend/src/services/shareImage/shareImageModel.ts`, `shareImageBuild.ts` (profile labels; the build renders a
  page and a picture for every barri × profile)
- env files: `VITE_PRESET_INVESTOR` → `VITE_PRESET_RETIREE`
- docs: `031-onboarding-quiz-presets.md`, `063-share-image.md`, `PROJECT_BRIEF.md` if it lists the profiles

## Open questions

1. Shared links that carry the `investor` token (053): open with the default conditions and no profile line, or map
   to another profile? Proposal: default conditions, silently.
2. Already published barri × investor pages and pictures: delete on the next build. Nothing links to them yet (no
   press link has gone out).
3. Texts in ES and CA: "una persona jubilada" in both; to confirm in the native read-through (065).

## Tests (write first)

- `presets.test.ts`: four profiles, no `investor`, `retiree` with the conditions above; the ENV override works.
- URL config: a link with the removed token loads without an error.
- Share image model and build: labels for `retiree`; no page generated for `investor`.
- Locale completeness test passes for the three languages.

## Definition of done

As in `CLAUDE.md`; plus the onboarding screen and one barri × retiree page checked in the browser.
