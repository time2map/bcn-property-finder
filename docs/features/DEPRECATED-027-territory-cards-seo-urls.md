# DEPRECATED-027 — Territory mode (hex / adm) + territory cards with SEO URLs

**Status:** Deprecated 2026-10-27. Built behind a feature flag, rolled back without merging.

**Why.** A district, barri or municipality has no meaningful single score. Noise, walkability, access to the
centre and climate risks change street by street, so an area value misleads someone choosing a home, even when
it is computed from source data rather than from hex scores (e.g. "el Raval: 51 dB, quiet"; "Gràcia → Plaça
de Catalunya: 50 min" as an average walk). Only the price is native to the area (INCASOL). The territory mode and
cards helped SEO only, not people looking for a home.

**Lesson for SEO.** Google indexes the page as rendered after JavaScript, so static text that the app replaces
on load barely counts, and hidden text is penalised: text for search has to be visible to people too.

**Revisit only together with territory search (044).** Then a territory URL opens the regular hex map
focused on that place (outline + zoom) with a small facts-only panel: price, list of barris and neighbours,
facts as shares rather than averages ("38% of the residential area is louder than 65 dB"). No area score, no
rank, no adm map mode. The draft below is kept for reference.

## Goal

Give Barcelona districts, barris and AMB municipalities their own cards and human-readable URLs, so that
users can look at a place by its name and share it, and every territory becomes a separate page Google can
index. Add an `adm` map mode that colours territories instead of hexes.

User story: *As someone relocating to Barcelona, I want to open "Gràcia" and see how it does on noise,
walkability, prices and risks, and send that link to my partner.*

## Why

- Today the site has one URL: Google sees one page, and every launch post links to the home page.
- People search and talk in place names, not hexes.
- Barri-level data (INCASOL prices, TODO-041 market activity, TODO-042 resident survey) fits territory
  cards better than hexes.

## Scope

### Territories

- 10 districts + 73 barris (Barcelona) and 35 AMB municipalities, from `areas.geojson` (`kind`, `id`, `parent`).
- Pipeline (`scripts/prepare-livability-grid.py`): each hex gets `barri` + `district`, or `muni`, by its
  centroid. New fields in `livability-h3.geojson`. Used for breadcrumbs.
- Barris are small: by centroid the median barri has 8 hexes, 8 barris have 1–3 (la Font de la Guatlla: 1).
  For territory summaries use every hex that overlaps the territory, weighted by overlap share, not only the
  hexes whose centroid falls inside. Municipalities are large enough: the smallest (Badia del Vallès) has 11.

### Map mode

- `hex / adm` toggle at the top of the map. Default `hex`, persisted in localStorage. Only the user changes it.
- `adm`: below `ADM_BARRI_MINZOOM`, districts + municipalities; at or above it, barris + municipalities.
- Territory colour = territory summary score (see Aggregation) with the current weights and risk settings,
  same ramp and legend as the hexes.

### Territory selection (independent of the mode)

- Triggers: click on a territory in `adm`, a breadcrumb in the hex card, opening a territory URL.
- Effect: fit the map to the territory, draw its outline, open its card. The mode does not change.
- The hex card gets a breadcrumb: `Barcelona › Gràcia › la Vila de Gràcia` (AMB: `Sant Cugat del Vallès`).
- The URL changes with `pushState`, so browser Back returns to the previous card.

### Territory card

Replaces the hex card in the same place (only one card is open at a time). One component for all three
levels:

- Name (plus colloquial alias), level, rank among peers (`#12 of 73 barris`), summary score.
- Factor breakdown, sale and rent prices, noise, walkability by category, climate risks, city-core access.
- Links: parent district, child barris (for a district), neighbouring territories.
- Share, "Show best zones here" (fit + best zones), and the hint "Switch to hex level for details".

### Aggregation (experiment)

Compare on real data before choosing:

- median of the territory's hex scores;
- share of the territory's hexes in the city top `VITE_TERRITORY_TOP_PCT`%;
- p10–p90 range shown next to the number.

The method changes results, so it goes to ENV (see Parameters).

### URLs

- `/barcelona/district/<slug>`, `/barcelona/barri/<slug>`, `/<muni-slug>`; Spanish under `/es/` (TODO-028).
- Slugs: ASCII, lowercase, accents stripped, articles kept (`la-vila-de-gracia`). The type is in the path
  because *Les Corts* and *Sant Andreu* are both a district and a barri. The city is in the path so other
  cities (TODO-033) don't change existing URLs. Slugs are generated, not taken from `areas.geojson` ids
  (`muni-cornellà-de-llobregat` is not ASCII).
- Hex link: `<barri URL>?h3=<id>`, canonical = the barri URL.
- Hosting: one static file per path plus SPA fallback (Caddy, VPS task).

### Colloquial names

- Dictionary `frontend/src/data/territoryAliases.json`: territory id → aliases (`barri-0104` → `El Born`).
- One alias can cover several barris (*Poblenou* → 5 barris). Such aliases go into page text and future
  search (044), not into titles.

### Static HTML at build

- A postbuild script writes `dist/<path>/index.html` for each territory (118 per language) with title,
  description, OG, canonical, hreflang and the card text as HTML, computed with default weights. The SPA
  replaces it on mount.
- `sitemap.xml`, `robots.txt`.
- Home page: H1 and a short description visible without JavaScript.
- Methodology page `/about/methodology`: how the index works, data sources.

### Ranking pages

Each page has its own URL and a ranked list of territories; the static HTML has the ranked table. In the
app the list opens in the card slot, and clicking a row opens that territory's card. Keyword volumes are
from the free Ahrefs tool (directional), to be confirmed in Search Console.

| Page | Ranked by | Target query (`seo/keywords.md`) |
|---|---|---|
| `/barcelona/best-neighbourhoods` | composite, default weights | mejores zonas para vivir en barcelona (>100, Easy), mejores barrios para vivir en barcelona, where to live in barcelona |
| `/barcelona/quietest-neighbourhoods` | noise | quietest neighborhoods barcelona |
| `/barcelona/most-walkable-neighbourhoods` | walkability | most walkable neighborhoods barcelona |
| `/barcelona/cheapest-neighbourhoods` | rent €/m² (sale as a second column) | zonas baratas para vivir en barcelona |
| `/barcelona/best-neighbourhoods-for-remote-workers` | preset: quiet, cafés, parks, lower rent | best neighborhoods barcelona for remote workers, dónde vivir en barcelona si trabajo en remoto |
| `/barcelona/where-to-live-as-a-student` | preset: lower rent, metro, cafés and restaurants | where to live in barcelona as a student (>100) |
| `/barcelona/best-neighbourhoods-for-families` | preset: schools, kindergartens, parks, quiet | to validate |
| `/barcelona/lowest-flood-risk` | climate risk | to validate |

### Getting pages into Google

- Pages are reachable by links: a "Rankings" entry in the panel and the footer, territory cards linking to
  parent, children and neighbours, the home page linking to districts and rankings. A page that nothing
  links to is found only through the sitemap.
- Search Console: verify `time2map.com` as a domain property (DNS TXT record; covers the subdomain),
  submit `sitemap.xml`, request indexing by hand for the home page and the ranking pages.
- Launch posts link to specific pages (a territory or a ranking), not only to the home page.

### Analytics

`territory_opened {level, slug, source}`, `mode_switched {hex, adm}`, `share_clicked {level}`.

## Out of scope

- Territory search (044), metro stations and named places (La Rambla), top territories on entry.
- Best zones in `adm` (highlight the best territories): roadmap item for 038.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `VITE_TERRITORY_SCORE_METHOD` | tbd: `median` / `top_share` | frontend |
| `VITE_TERRITORY_TOP_PCT` | 20 | frontend |

`ADM_BARRI_MINZOOM` is a UI constant, not ENV: it doesn't change results.

## Open questions

- Aggregation method (experiment on real data).
- Zoom threshold between districts and barris.
- Which ranking pages go into the first release (proposal: the first four, the rest after Search Console data).
- Opening a ranking page in the app: apply its preset to the user's weights, or show a fixed list and leave
  the user's weights alone (proposal: fixed list).

## Depends on

038 best zones, TODO-028 (ES), VPS hosting task (path fallback), TODO-032 (legend).

## Estimate

4–6 days for mode, selection, cards, URLs and static HTML; about 1 day for ranking pages.

## Definition of Done

Standard (see `CLAUDE.md`). Plus: every territory URL returns 200 with its own title and card text in the
HTML (checked with JavaScript off).
