# Feature 018 — Per-hub accessibility layers (precomputed)

## Goal

Add **accessibility** (public-transport / walk travel time) to the livability map — but **per work
hub**, pre-computed offline so it never overloads the app. Each hub (e.g. Poblenou, Glòries,
Sarrià) gets a travel-time value per H3 cell, shown as an optional layer / checkbox under
"Livability" (feature 017). The owner can **add hubs themselves** via config.

Accessibility is **workplace-dependent**, so it cannot live in the static workplace-independent
grid of feature 017. Instead we pre-compute one travel-time surface **per fixed hub** offline and
ship each as static data. This keeps the page backend-free while still showing "how reachable is
each area if you work at X".

## Strategic note

Each hub maps to a crawlable SEO page (`where to live if you work in {hub}`,
`apartments within 30 minutes of {hub}` — cluster C in `seo/keywords.md`) and to the
remote-worker positioning. Precomputing hubs (vs live recompute) is what keeps it cheap.

## User story

> As someone who knows where they'll work, I want to tick my work hub and see the whole city
> recoloured by commute time from there — combined with walkability/noise — so I can find areas
> that are both reachable and nice to live in.

---

## Behaviour

### Hub checkboxes (extensible)

Under the "Livability" control group (feature 017), one checkbox **per available hub**. The list
is **data-driven**: it reads the set of hubs that have a precomputed surface and renders a checkbox
for each. Adding a hub (config + rerun precompute) makes a new checkbox appear automatically — no
code change.

- Selecting a hub switches the map to its **accessibility choropleth** (travel-time bands), or
- combines accessibility with walkability/noise into a full **livability-from-work** composite
  (reusing the existing travel/noise/walkability weights).
- When a **workplace** is set (existing feature) and coincides with / is near a hub, that hub can
  be highlighted / auto-selected.

### Default seeded set (keep precompute light)

To avoid heavy precomputation, **only a minimal default set is shipped**:
- Coverage grid extent default: Barcelona + AMB (the feature-017 grid; extendable to a wider
  Catalonia extent via config).
- **Default precomputed hub: Poblenou only.**

The owner adds further hubs (Glòries, Sarrià, Pl. Catalunya, 22@, Sants, …) by editing the hub
config and rerunning the precompute script.

---

## Data source / offline pre-computation

```
config/
  hubs.json                       — [{ id, name, lat, lng }]; default: Poblenou
                                    (owner-editable: add hubs here)

scripts/
  prepare-hub-accessibility.(py|sh)
    For each hub in hubs.json:
      1. Query OTP2 for a one-to-many travel-time surface from the hub
         (single isochrone/surface request — NOT a per-cell loop).
      2. Map travel time onto the feature-017 H3 cells (cell centroid → time).
      3. Emit frontend/public/data/hubs/{id}.geojson  (cell → minutes)  [static]
```

Key correction baked into the design: travel time from one origin to all cells is **one** OTP
request (one-to-many surface), not N. The only "loop" is iterating hubs offline.

OTP2 is needed **only at precompute time** — production serves static per-hub files, no live OTP.

---

## New env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_HUBS_DEFAULT` | `poblenou` | Hub(s) precomputed/seeded by default |
| `VITE_HUB_TRANSPORT_MODE` | `transit` | OTP mode for the surface (`transit`, `walk`, …) |
| `VITE_HUB_MAX_MINUTES` | `45` | Cap travel time at this many minutes |

Composite reuses `VITE_COMPOSITE_WEIGHT_TRAVEL` / `_NOISE` / `_WALKABILITY`.

---

## Architecture (planned)

```
config/hubs.json                  — owner-editable hub list (default: Poblenou)

scripts/
  prepare-hub-accessibility.*     — offline OTP2 surface per hub → static per-hub GeoJSON

frontend/public/data/hubs/
  poblenou.geojson                — cell → minutes (default); more added by the owner

frontend/src/
  services/livability/
    hubsData.ts                   — discover available hubs; load a hub surface;
                                    accessibility index + livability-from-work composite
  components/FilterPanel/
    LivabilityControls.tsx        — adds the data-driven per-hub checkbox list (extends 017)
  components/LivabilityLayer/
    LivabilityLayer.tsx           — renders the selected hub's accessibility/composite choropleth
  store/index.ts                  — selectedHubId (+ setter)
```

Depends on **feature 017** (H3 grid + livability layer/controls + choropleth renderer).

## Out of scope (future)

- Interactive **click any point → recompute** surface (arbitrary origin): one OTP call per click,
  but needs a **live OTP in production** or a **precomputed cell→cell travel-time matrix**
  (feasible at res 8 ~1300 cells → ~1.7M pairs; heavy at res 9). Separate v2 feature.
- Auto-generated crawlable per-hub SEO pages → separate feature.

## Definition of Done

- [ ] Unit tests: hub discovery, hub surface loader, accessibility index, from-work composite (≥ 80%).
- [ ] Integration test: select a hub → map recolours by travel time; combine with walkability/noise.
- [ ] `npm test` — all green (incl. existing).
- [ ] `npm run lint` — no errors.
- [ ] `npm run typecheck` — no errors.
- [ ] Precompute script produces a valid `hubs/poblenou.geojson` from a running OTP2.
- [ ] Adding a hub to `hubs.json` + rerun → new checkbox appears with no frontend code change.
- [ ] Manual via `npm run dev`: tick Poblenou → city recolours by commute; combines with livability.
```
