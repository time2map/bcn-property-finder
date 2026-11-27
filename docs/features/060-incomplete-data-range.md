# 060 — Incomplete data: score range and hatched fill

**Changed by 073 (2026-11-16):** the top of the range counts a missing condition as 100 (the real best case), not as dropped. The card text says so.

## Problem

Today (022, "Missing data rule") a missing component counts as 0 with its weight kept in the denominator, and the
cell/building gets a black outline. That is the **worst case** only, so places with a gap look unfairly bad and
the user cannot tell how much the gap matters.

## Decision

A place with no data for an active component (weight > 0) gets a **range** `[min, max]` instead of one number.

- **min** — the current 022 rule: the missing component contributes 0, its weight stays in the denominator.
- **max** — the missing component is dropped: it leaves numerator and denominator, the remaining weights are
  renormalised. This is the "as if this criterion did not exist" estimate, not a true best case. `max ≥ min` always.
- No gaps → `min = max`, behaviour unchanged.

## Display

- **Colour = max.** Everywhere: houses, cells, areas.
- **Houses with a range:** outline is the **same as for complete houses** (the black gap outline from 022 is
  removed). The inside gets a thin diagonal hatch: stripe A = colour at max, stripe B = the same colour, lighter /
  more transparent. The stripe B colour does not encode the range width (deliberate, for visual simplicity).
- **Areas:** wide diagonal hatch, same two-tone scheme. An area is hatched when the share of its buildings with
  a range is **above `VITE_INCOMPLETE_AREA_MIN_SHARE`**. The area colour is computed from max values, including
  when it mixes buildings with ranges and with exact values.
- **Hover tooltip:** `~70` — an "approximately" sign and the index only.
- **Full card:** the real range (`52–70`) plus the text "Incomplete data". The band line is hedged when the score is a
  range: "Possibly a great match" instead of "Great match" (the band is the one of the top of the range), so a low bound
  in a lower band does not contradict the verdict. Same on the phone peek.

## What counts as a gap

Any component that today falls under the 022 missing-data rule: true no data, **unknown build year** (047) and
**low-sample locals' opinion** (`n < VIBE_ESM_MIN_N`, 042). All get the range and the hatch; the old black gap
outline is removed everywhere.

## Ranking

The ranked areas list (051) sorts by **max**.

## Filters

A building passes a filter if its **max** passes (consistent with colouring). In lists and cards it is marked
as incomplete data.

## ENV

| Variable | Default | Meaning |
|---|---|---|
| `VITE_INCOMPLETE_AREA_MIN_SHARE` | `0.3` | share of buildings with a range above which an area is hatched |

Add to `frontend/.env.local.example`, `.env.production`, `.env.test`.

## Affects existing docs

- `022-composite-livability-index.md` — "Missing data rule" and the black outline (`hasGap`).
- `046-building-level-index.md`, `047-building-age.md` (unknown year = gap), `042-locals-opinion.md`
  (`n < VIBE_ESM_MIN_N` is "marked like missing data"), `050-match-score.md`, `051-ranked-areas-list.md`.
- `DESIGN.md` — hatch pattern spec.

## Open questions

1. Hatch rendering at building scale: implemented as a second `fill-pattern` layer (white stripes over the score
   colour). Needs a visual check on small footprints.

## Definition of Done

- [ ] Unit tests: `scoreRange` (min, max, no gap, all components missing, weights 0), area share rule, filter by max
- [ ] Integration test: building with a gap → hatched, tooltip `~N`, card shows range
- [ ] `npm test`, `npm run lint`, `npm run typecheck`
- [ ] Manual check via `npm run dev`
- [ ] 022 and related feature docs updated
