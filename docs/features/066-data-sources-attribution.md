# 066 — Data sources, attribution and a licence-safe footprint

Status: implemented. Source of the requirements: `docs/DATA_LICENSES.md` (sections 1, 5, 6, 7).
Mode today: non-commercial. Every step below is written so that a later commercial launch changes only the items
marked **COMMERCIAL**.

## Goal

Nobody can say we used their data without credit or against its terms. Everything in this feature is done inside
our own app and repo: no requests to third parties.

## Scope

1. **Source registry** — one file, `src/services/dataSources.ts`: id, publisher, dataset, licence (name + URL),
   source URL, update date, "modified by time2map" (i18n key), `commercial` note, used-by layers. Everything
   visible (map credit, modal, legends, cards) reads from it.
2. **Map credit** — own component, always visible on desktop and mobile (also during onboarding and with the panel
   collapsed): `© ICGC · © OpenStreetMap contributors · © Dirección General del Catastro · Data sources`. It does not
   collapse on desktop (ODbL: visible without interaction). **On a phone** (changed after the first real-device check)
   the line covered a strip of a small map, so it is shown first and folds into a small «©» button after 5 s or at
   the first touch of the map (the collapse the OSMF attribution guidelines allow: shown first, findable afterwards,
   here also in «About»). A tap on «©» opens it again, «×» folds it back. The fold/unfold is animated (~0.18 s, the line slides out of the «©»; none with reduced motion). On the phone the credit sits above the colour legend. Replaces the raw-HTML credit in the filter panel and in the about
   sheet (no `dangerouslySetInnerHTML`).
3. **About / Data sources always reachable** — an info button in `BrandBar` (desktop); the mobile button stays.
   One component: Modal on desktop, Drawer on mobile. Sections: About, Data sources (table), Licences and
   disclaimers, Privacy (what leaves the browser), Contact, Language.
4. **Modal content** — per source: publisher, dataset, date, licence with link, what we changed. Plus: "not
   affiliated with or endorsed by any of these bodies"; "not official cadastral information"; ODbL notice;
   contact: Alexander Semenov, info@time2map.com.
5. **Credits in context** — building card (Catastro credit + "not official"), area card and locals' opinion
   ("Source: Barcelona City Council", values adjusted by time2map), prices (INCASOL, year), legends of noise /
   flood / wildfire / street flooding read their text and date from the registry.
6. **Dates from the pipeline** — `sources` block with fetch dates in `buildings-meta.json`, written by the
   `fetch_*` scripts; the modal falls back to `generated`.
7. **ODbL notice** — `public/data/DATA_LICENSE.txt` and root `THIRD_PARTY_NOTICES.md`: `min_*` / `cc_*` columns,
   `barcelona_poi.pmtiles`, area-start are an ODbL derivative database; data available on request. Catastro and
   Generalitat data are not relicensed.
8. **Cleanup** — delete `public/data/landmark-geometries.json`; check that Idealista files are gitignored and not
   in `dist`.
9. **Geoapify / Mapterhorn** — "Powered by Geoapify" in the search box when a key is set; Mapterhorn / Copernicus /
   CNIG credit in the registry.
10. **`VITE_COMMERCIAL_USE`** (default `false`, in all env files). When `true`: street flooding layer and penalty
    off (`RISK_STRENGTH_STREET` = 0) and the FGC layer off until its licence is confirmed. A test pins the
    list.

## Commercial-use differences (**COMMERCIAL** = needs special terms)

| Source | Non-commercial now | COMMERCIAL |
|---|---|---|
| Catastro | credit; transformed data | written confirmation of CC BY 4.0 (the 2016 licence allows commercial use of transformed data only) |
| RESCCUE street flooding | no licence (all rights reserved) | permission from Ajuntament / BCASA / Aquatec, or off |
| TMB API | free, non-exclusive licence; cite source and update date; use only for the app named in the application | declare the commercial use in the TMB application; TMB may attach fees to some content |
| FGC GTFS | licence not stated | confirm with FGC, or draw from OSM |
| Geoapify | Free plan + credit | paid plan |
| Catastro DNPRC | one call per click | ask Catastro for terms at scale |
| Mapterhorn | no terms for the endpoint | self-host tiles or agree terms |
| Idealista | local only | never publish |
| Legal notice (LSSI-CE art. 10) and privacy policy | not needed for a personal project | likely needed; show to a lawyer |

## Tests (written first)

- Registry: every entry has publisher, licence name and URL; every `attribution` string in layer code maps to a
  registry id; every source file in `public/` is listed.
- Map credit renders on desktop and mobile, includes OSM and Catastro, links to the modal.
- About modal opens from the brand bar; lists every registry entry; shows contact and the disclaimers.
- i18n parity (en / es / ca) for all new keys; source and licence names are not translated.
- `VITE_COMMERCIAL_USE=true` switches off the listed layers and penalty.
- Playwright: About on desktop and on a phone viewport.

## Definition of Done

As in `CLAUDE.md`, plus: `docs/DATA_LICENSES.md` statuses updated (items 1, 3, 8 and the "Conditions met?" column),
ARCHITECTURE and ROADMAP updated.
