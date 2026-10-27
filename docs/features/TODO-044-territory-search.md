# TODO-044 — Territory search

**Status:** Draft. Not planned for the first release.

## Idea

A "Search a neighbourhood" box over Barcelona districts, barris and AMB municipalities, including colloquial
names (El Born, Poblenou, …). Picking a result selects the territory: the map fits its bounds, draws its
outline and opens its territory card. The map mode (hex / adm) does not change.

User story: *As someone relocating to Barcelona, I already know a few neighbourhood names, so I want to jump
straight to one instead of hunting for it on the map.*

## Notes

- Depends on territory selection, territory cards and the hex → territory mapping (TODO-027, being rewritten
  for the first release).
- Reuse the colloquial-name dictionary from TODO-027 for matching.
- Later scope: metro stations and named places (e.g. La Rambla) as searchable objects.
- Analytics: `search_used`, `territory_opened {source: search}`.

## Definition of Done

Standard (see `CLAUDE.md`).
