# Feature Flags

Flags are read in `frontend/src/features.ts` as `VITE_FEATURE_<NAME> === 'true'`. Anything else counts as off.
They are build-time values: changing one needs a rebuild or a dev-server restart.

| File | Purpose |
|---|---|
| `frontend/.env.production` | public build (committed): the "Production" column below |
| `frontend/.env.local` | local dev; `.env.local.example` has everything off |
| `frontend/.env.test` | tests: every flag on, so the suite covers the gated code |

| Flag | What it gates in the code | Production | Plan |
|------|---------------------------|------------|------|
| `VITE_FEATURE_ISOCHRONE` | the Daily trip condition (078: "+ Daily trip", pick on the map, draggable marker), `IsochroneLayer`, `useIsochrone` (OTP2); with an isochrone drawn, buildings, area ranks and best zones cover only the commute zone and the colours are stretched over it (077) | off | needs a hosted OTP2 |
| `VITE_FEATURE_EXCLUSIONS` | `ExclusionLayer`, `ExclusionDraw`, `ExclusionControls`; exclusions in best zones | off | soon |
| `VITE_FEATURE_PINS` | `ComparePane`, `AddPinButton`, `PinLayer`, `PinAccuracyLayer`, `WalkabilityLayer`, add-pin click mode, mobile Map/Compare toggle | off | later |
| `VITE_FEATURE_SCREENSHOT` | `ScreenshotDropZone` around the map; the Claude Vision call (the SDK is left out of the bundle when off) | off | later: the API key must not reach the browser |
| `VITE_FEATURE_IDEALISTA_PRICES` | `IdealistaPricesLayer` + controls (data file is gitignored, local only) | off | private scrape, not for public |
| `VITE_FEATURE_BEST_ZONES` | `BestZones` bar + zones + Idealista zone links (038); also the "Best areas" block in the filter panel | **off** (hidden 2026-11-12 by the owner) | public once re-enabled |
| `VITE_FEATURE_LOCALS_OPINION` | "Locals' opinion" condition, its info text, "What locals say" card block, loading `barri-vibe.json` (042) | **on** | public |
| `VITE_FEATURE_ONBOARDING` | first-visit panel (profiles + one sentence per condition), and the new filter panel (sentences, map layers, best areas, advanced) instead of the old controls (031, 052) | **on** | public; remove the flag and the old `CompositeControls` / `ClimateLayerControls` code next |
| `VITE_FEATURE_AREAS` | "Your areas" tab (ranked list), `AreasLayer` (area view below z13), per-condition scores and the area ranking after each rescoring, dots only from z13 (051) | **on** | public |
| `VITE_FEATURE_FACADE_PHOTO` | Catastro facade photo in the building card (hotlinked; the service states no terms of use) | off | TBD |
| `VITE_FEATURE_ONE_BUILDING` | "Find your one building" funnel prototype (TODO-076): `FunnelPanel` instead of the top panel and `FunnelLayer` instead of the building colours, opened with `?funnel` in the address, desktop only; settings `VITE_FUNNEL_*` | on | on since 2026-11-17 for the owner to try on prod; reachable only with `?funnel` (no link to it in the UI), not announced |
| `VITE_COMMERCIAL_USE` | commercial launch: turns off street flooding (layer and penalty) until its licence is confirmed (TODO-066) | off | off until licences are confirmed |

The "Inside commute zone, outside exclusion zones" option of best zones is shown only when `ISOCHRONE` or
`EXCLUSIONS` is on, and hidden while an isochrone is drawn: then the restriction is always on (077).

When a feature goes fully public, remove its flag from the code and delete its row here.
