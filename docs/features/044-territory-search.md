# 044 — Territory search

**Note (2026-11-04):** the hexes were removed in TODO-046; where this file says hex / cell, read building.

**Status:** Done (2026-11-12) for this pass: area search + address search. Everything under "Later" is not planned for now.

**Note (2026-11-11):** promoted to a prerequisite of the mass-market UX track (050–053): a public map needs a
search box (address or area) before an onboarding quiz makes sense. Add a plain address geocoder (Geoapify,
already used for pins) next to the territory match; result = fly-to + temporary marker, no card.

## Idea

A "Search a neighbourhood" box over Barcelona districts, barris and AMB municipalities, including colloquial
names (El Born, Poblenou, …). Picking a result fits the hex map to the territory and draws its outline.

User story: *As someone relocating to Barcelona, I already know a few neighbourhood names, so I want to jump
straight to one instead of hunting for it on the map.*

## Built in this pass

- One box, two groups: **Areas** (10 districts, 73 barris, 35 AMB municipalities from `areas.geojson`, plus a small
  colloquial-name dictionary `areaAliases.ts`) and **Addresses** (Geoapify autocomplete, metro bbox).
- Area pick: fit the map to the area (padding for the panel) and draw its outline. A colloquial name covering
  several barris outlines all of them. Address pick: fly to it with a temporary marker. No card, no facts panel.
- Esc or the × clears the pick. Without `VITE_GEOAPIFY_API_KEY` only areas are searched.
- ENV: `VITE_SEARCH_MIN_CHARS`, `VITE_SEARCH_DEBOUNCE_MS`, `VITE_SEARCH_MAX_RESULTS`, `VITE_SEARCH_ADDRESS_ZOOM`.
- Key: local `frontend/.env.local` (gitignored); CI secret `VITE_GEOAPIFY_API_KEY` in `deploy.yml`. The key ends up in
  the public bundle, so restrict it by HTTP referrer in the Geoapify dashboard.
- Not done: `search_used` analytics (the app has no product analytics yet).

## Phone (TODO-062)

After the onboarding the search is a pill at the top of the screen, always there: brand mark on the left (opens
"About"), placeholder "Search Barcelona livability map", Share on the right until something is typed. Results take
the screen under the pill, above the keyboard (`--vvh` from the visual viewport); the field is 16 px so iOS does
not zoom. A pick closes the keyboard and drops the bottom sheet to peek. Before the onboarding is closed the
old brand bar with the search button is shown.

## Later (not in this pass)

Territory URLs and the facts-only panel, metro stations and named places, SEO pages. Original notes:

## Notes

- Territory cards and the adm map mode were dropped (DEPRECATED-027): an area has no meaningful single score.
  If search is built, it brings back only "variant A" from that file: a territory URL opens the regular hex map
  focused on the place, with a small facts-only panel (no score, no rank).
- Needs a colloquial-name dictionary (El Born, Poblenou → several barris) for matching; see DEPRECATED-027.
- Later scope: metro stations and named places (e.g. La Rambla) as searchable objects.
- Analytics: `search_used`, `territory_opened {source: search}`.
- Possibly worth it for SEO as well: territory URLs give search engines one page per place (see DEPRECATED-027).

## Definition of Done

Standard (see `CLAUDE.md`).
