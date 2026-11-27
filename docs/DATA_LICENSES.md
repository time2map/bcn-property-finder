# Data sources and licences

Checked against the code and the publishers' terms on 2026-11-12; attribution implemented and links re-checked on 2026-11-14
(TODO-066); municipality outlines moved to ICGC and the "not verified" list re-checked on 2026-11-14 (TODO-067). If the code adds or drops a source, update this file **and** `frontend/src/services/dataSources.ts`.
This is a technical review, not legal advice. Items marked **verify** were not confirmed from a primary source; the
two "high" risks below are worth a short consultation with a Spanish IP / open-data lawyer before any paid or
B2B use.

## 1. Summary

**Most of the map can be used in a commercial product.** The core data (Catastro buildings, Barcelona noise
maps, the residents' survey, Generalitat prices and climate layers, ICGC base map, OpenStreetMap) is published
under open licences: CC BY 4.0, the Generalitat open-information licence, or ODbL. All of them allow commercial
use. All of them **require attribution**, and some add more conditions: don't alter the meaning, state the update
date, don't imply endorsement, and share-alike for OSM.

**Status after TODO-066 (2026-11-14).** Attribution is now shown in the app (item 1), the ODbL notice is published
(item 3), and a single switch, `VITE_COMMERCIAL_USE`, turns off the layers that are not safe for a commercial
launch (item 2). What is still open needs a third party: item 2 and the Catastro confirmation. TMB (item 4) is closed: the terms were accepted with the application. Items 5 (FGC) and 6 (municipality outlines) are closed by TODO-067.
The "Risk" column below is the risk **before** the work, except where the Fix column says done.

**What was wrong, and what is left:**

| # | Problem | Risk | Fix |
|---|---|---|---|
| 1 | **Attribution was missing for most sources. DONE (TODO-066).** The facts below describe the state before.  `attributionControl: false` in `Map.tsx`; the panel shows only the base-map credit. The `attribution` strings of the noise, flood, wildfire, street-flooding and POI sources are never rendered. Catastro (the buildings layer itself), OSM-derived walkability, the ESM survey, SICA noise, area boundaries, TMB, FGC and Mapterhorn terrain are not credited anywhere visible. On mobile the panel is in a drawer, so the map has no visible credit at all. | ~~High~~ fixed | Done: credit line on the map, "About and data sources" dialog, credits on the cards (section 6) |
| 2 | **Street flooding (RESCCUE, Atles de resiliència)** has no licence. It is fetched from the Ajuntament's CARTO account with a read key taken from the public viewer. The product owner accepted the risk in 037. Research of 2026-11-14 (5.2): still no licence; leads for the letter are the Ajuntament's Avís legal (general reuse with source credit, rights reserved otherwise) and the RESCCUE Data Management Plan (open publication planned, no licence stated). | **High** (open) | Ask the Ajuntament for permission, or for publication on Open Data BCN. **Commercial: `VITE_COMMERCIAL_USE=true` already turns the layer and the penalty off.** The dialog states that the layer has no licence |
| 3 | **OSM share-alike (ODbL). Notice added in TODO-066** (`frontend/public/data/DATA_LICENSE.txt`, `THIRD_PARTY_NOTICES.md`). `barcelona_poi.pmtiles` is an OSM extract, so it is a derivative database. The `min_*` / `cc_*` columns in `buildings-scores.bin.gz` are computed from OSM and are probably one too. Both are public files, but nothing says they are under ODbL. | ~~Medium~~ done | Done: `frontend/public/data/DATA_LICENSE.txt` and `THIRD_PARTY_NOTICES.md` declare the OSM-derived files as ODbL, the dialog says so, data on request (section 5.3) |
| 4 | **TMB metro layer. CLOSED (2026-11-14).** The product owner accepted the TMB terms (developer.tmb.cat/docs/terms-conditions) when creating a new application and its ID, which the app now uses. Free, non-exclusive, worldwide, indefinite licence; static and real-time data; conditions: cite the source and the date of the last update (done, dialog), don't alter the content, use it only for the application named in the request. | ~~Medium~~ none | Nothing to do now. **Commercial: if the purpose changes (paid product), update the application's stated use**; TMB may attach fees to some content |
| 5 | **FGC lines and stations. CLOSED (TODO-067).** The licence was not stated on the website, whose legal notice forbids commercial exploitation of *web content*. FGC's open-data portal (dadesobertes.fgc.cat) publishes the same GTFS feed (`www.fgc.cat/google/google_transit.zip`) as dataset `gtfs_zip`, modified 2026-11-10, under **CC BY 4.0** (the website notice has no section on data reuse; the portal's "terms" link leads to it). | ~~Medium~~ none | Nothing to do. Credited in the dialog (CC BY 4.0, "drawn from the GTFS feed"). The layer stays on with `VITE_COMMERCIAL_USE=true` |
| 6 | **Municipality outlines. CLOSED (TODO-067).** `areas.geojson` used Opendatasoft `georef-spain-municipio`, licence not confirmed. Now the 35 AMB outlines come from ICGC `divisions-administratives-municipis-100000` (CC BY 4.0, edition 2026-01-20). Same ids and names; districts and barris unchanged. | ~~Low~~ none | Nothing to do. Credited in the dialog (`areas`, with the edition) |
| 7 | **Catastro facade photo** (flag off): hotlinked, no stated terms. | Low while off | Keep off until Catastro confirms |
| 8 | **Idealista scrape** (`idealista_prices.geojson`, flag off, gitignored). Scraping breaks Idealista's terms, and its listings are a protected database (EU sui generis right). | **High if published**, none while local | Never ship it; keep it out of git and production |

**Fines, concretely.** Spain's reuse law (Ley 37/2007, art. 11) fines reuse of **State** information (here:
Catastro, MITECO/SICA, CNIG): €1,000–10,000 for not citing the source, not giving the update date, or slight
alteration; €10,001–50,000 for reuse without a required licence or a serious breach; €50,001–100,000 for
distorting the meaning. A ban on reuse for 1–5 years can be added. For the Generalitat, the Ajuntament, OSM and
private providers the realistic consequence is **losing the licence** (with it, the right to use the data) and a
civil claim (copyright or database right). We found no separate fine regime for them. Under CC BY 4.0 the rights
come back automatically if the breach is cured within 30 days of discovery. So **fixing attribution quickly**
(item 1, done) removes most of the exposure.

## 2. Licences in play

| Licence | Who uses it here | Commercial | Main conditions |
|---|---|---|---|
| **CC BY 4.0** | Catastro INSPIRE (metadata), Open Data BCN, ICGC, FGC open-data portal (GTFS), SICA (metadata), CNIG terrain | yes | credit the source; link the licence; say if you changed it; no implied endorsement |
| **Llicència oberta d'ús d'informació – Catalunya** (Generalitat default) | ACA, Agricultura (wildfire), INCASOL / habitatge | yes (not restricted) | cite "Generalitat de Catalunya. Departament de …"; **give the date of the last update**; don't alter or distort; no Generalitat logos; no sublicensing |
| **Open Data BCN terms** (CC BY 4.0 + art. 8 of Ley 37/2007) | noise, ESM survey, barris | yes | "Source of the data: Barcelona City Council"; identify changes; no suggestion of Council support |
| **Catastro INSPIRE licence v1.0 (2016)** | buildings, addresses, parcels | yes, **for transformed information only** | see 5.1 |
| **ODbL 1.0** | OpenStreetMap (POI, walking network, basemap outside Catalonia, OpenFreeMap) | yes | "© OpenStreetMap contributors", visible on the map; a public derivative database must be offered under ODbL |
| **No licence** | RESCCUE street flooding, Catastro facade photo | **no: needs permission** | all rights reserved by default. "Non-commercial" is not a safe harbour here: with no licence there is nothing that allows even free use |
| **Service terms** | TMB API, Geoapify, Catastro web services (SEC), OpenFreeMap, Mapterhorn | per service | keys, rate limits, attribution |

## 3. Inventory

### 3.1 Public product: files we build and serve (`frontend/public/`)

| File | Content | Source (script) | Publisher, licence | Conditions met? |
|---|---|---|---|---|
| `data/buildings.pmtiles`, `buildings-detail.pmtiles`, `buildings-scores.bin.gz`, `buildings-positions.bin.gz`, `buildings-meta.json` | ~174k residential buildings: footprints, cadastral ref, address, use, dwellings, floors, year built / renovated, area, condition | Catastro INSPIRE ATOM, province 08: BU, AD, CP (`prepare_buildings.py`, `fetch_exposure_sources.py`) | Dirección General del Catastro. CODSI metadata (2026-05): **CC BY 4.0 "DG Catastro"**, high-value dataset. The linked licence PDF v1.0 (2016) is stricter (5.1) | ✓ credit in the map line and the dialog; the card says "© Dirección General del Catastro. Not official cadastral information" |
| same files: `lden_avg`, card noise fields, facade points | noise at the facade | Barcelona: Open Data BCN `rasters-mapa-estrategic-soroll` 2022 (+ 2017 facades for validation). Other municipalities: SICA / MITECO, 4th round (2022) agglomeration maps | Barcelona: **CC BY 4.0** (confirmed in CKAN). SICA 4th round (used): originals of the **Generalitat** (Departament de Territori, Habitatge i Transició Ecològica), published by MITECO; **no licence stated** in the page, the metadata or MITECO's notice; Generalitat default licence by reading (section 8). The 3rd-round metadata says CC BY 4.0 | ✓ dialog (with edition and what we changed) and the card line under the noise block. SICA: the credit uses the form MITECO asks for (section 8) |
| same files: `min_<category>`, `cc_<landmark>` | walking minutes to services and City Core places | OpenStreetMap, Geofabrik / BBBike extract (`building_access.py`) | **ODbL 1.0** | ✓ OSM in the map line and the dialog; declared ODbL in `DATA_LICENSE.txt` (5.3) |
| same files: student residences | filter only | OSM | ODbL | as above |
| same files: `river_zone` | ACA flood zones T10 / T100 / T500 | `sig.gencat.cat/ows/AIGUA/wfs` (`fetch_climate_risk.py`) | ACA, Generalitat. The WFS states no constraints (`Fees` and `AccessConstraints` empty, checked 2026-11-14), so the Generalitat default licence applies; no per-layer licence exists | ✓ dialog with fetch date; legend credit kept |
| same files: `street_t10_cm`, `street_t100_cm` | water depth at the door | RESCCUE via CARTO `urbisadmin` (`fetch_climate_risk.py`) | Ajuntament de Barcelona / BCASA / Aquatec, **no licence** | ✗ no licence (5.2); the dialog says so; off in commercial mode |
| same files: `fire_hazard`, `fire_wui` | wildfire hazard 2024, WUI zones | Generalitat, Agricultura (`PERILLBASICINCENDI.zip`); Protecció Civil via ICGC geoservei | Generalitat default licence; ICGC CC BY 4.0 | ✓ dialog with edition; legend credit kept |
| `buildings-meta.json` → `areas[].price` | INCASOL sale price €/m² per barri / municipality | `habitatge.gencat.cat` XLSX (`fetch_incasol_sale_prices.py`, `fetch_incasol_sale_catalonia.py`) | Generalitat (Agència de l'Habitatge / INCASOL), Generalitat default licence (the site has no notice of its own; the gencat legal notice applies, section 8) | ✓ card: "Generalitat de Catalunya, INCASOL" (the word "official" was removed: it can read as an endorsement); dialog with date |
| `data/barri-vibe.json` | residents' satisfaction, intention to stay, top problems per barri | Open Data BCN `esm-bcn-evo` (`build_neighbourhood_vibe.py`) | Ajuntament de Barcelona, Oficina Municipal de Dades. **CC BY 4.0** (confirmed in CKAN); anonymised microdata | ✓ card: "Source: Barcelona City Council … CC BY 4.0", small samples marked; dialog says the values are adjusted |
| `data/noise.pmtiles` | Lden isophones 2022 | Open Data BCN `isofones-mapa-estrategic-soroll` (`prepare-noise-data.sh`) | **CC BY 4.0** | ✓ in the legend, the map line and the dialog |
| `data/flood-zones.pmtiles`, `wildfire.pmtiles` | view layers | as `river_zone`, `fire_*` | as above | ✓ legend, map line, dialog with date |
| `data/street-flooding.pmtiles` | view layer | RESCCUE | **no licence** | legend says "No explicit open-data license" |
| `data/areas.geojson` | districts, barris, AMB municipalities | barris / districtes: `martgnz/bcn-geodata` (MIT repo; data from Ajuntament / CartoBCN, CC BY). Municipalities: ICGC `divisions-administratives-municipis-100000` (`prepare-areas-data.sh`) | CC BY via the Ajuntament; ICGC **CC BY 4.0** | ✓ dialog credits CartoBCN and ICGC (edition 2026-01-20) |
| `data/landmark-geometries.json` | removed in TODO-066 | | | |
| `barcelona_poi.pmtiles` | POI icons; walkability of pins | OSM PBF (`extract_poi.py`) | **ODbL** | ✓ declared ODbL (5.3) |
| `fgc-lines.geojson`, `fgc-stations.geojson` | FGC lines and stations | FGC GTFS `fgc.cat/google/google_transit.zip` | FGC open-data portal, dataset `gtfs_zip`: **CC BY 4.0** | ✓ credited in the dialog with the licence link; "drawn from the GTFS feed" |
| `basemap/icgc-standard.json` | our copy of ICGC's style `icgc_mapa_estandard_general` (TODO-058), byte for byte as ICGC serves it; the tiles, fonts and icons still come from ICGC | `npm run update:basemap` (`scripts/update-basemap-style.mjs`) | ICGC, **CC BY 4.0**: redistribution allowed with credit; unchanged, so nothing to mark as modified | ✓ "© ICGC" in the map line on desktop and mobile; Mapterhorn is credited in the dialog (3.2) |
| `data/area-start.json` (written by `npm run build` into `dist/`, not in git) | the area view of a first visit: area → polygon, and the area ranks for the default settings (TODO-058) | computed from the building files and `areas.geojson` (`scripts/build-area-start.mjs`) | derived from all the score inputs: same terms as the building files (Catastro, noise, prices, climate) and ODbL for the OSM-derived part, as `min_*` / `cc_*` above | as the building files; declared in `DATA_LICENSE.txt` |
| `og-image.jpg` | screenshot of the map | ours (contains ICGC / OSM cartography) | — | low: add a small credit when it is regenerated |

### 3.2 Public product: services the browser calls

| Service | Use | Terms | Status |
|---|---|---|---|
| ICGC ContextMaps / Mapa Base: tiles, glyphs, sprites, terrain | base map | **CC BY 4.0**; outside Catalonia © OpenMapTiles © OpenStreetMap (ODbL). No key, no stated limits | ✓ "© ICGC" and "© OpenStreetMap contributors" in the map line on every screen |
| Mapterhorn `tiles.mapterhorn.com` (source `terrainMapZen` of the ICGC style) | terrain / hillshade | tiles from Copernicus GLO-30 and CNIG MDT ("CC-BY 4.0 scne.es"); code BSD-3; no stated terms for the endpoint | ✓ credited in the dialog (the style itself still has none) |
| Share pictures (TODO-063) | a snapshot of the live map (ICGC / OpenStreetMap), or the barri polygons coloured by score | same terms as the sources: CC BY 4.0 (ICGC, Ajuntament), ODbL for the OSM part | ✓ the credit is drawn on every picture ("Map: ICGC, OpenStreetMap contributors" / "Boundaries: Barcelona City Council, CC BY 4.0"); the scores in a picture are derived from all the score inputs |
| OpenFreeMap (fallback) | base map | commercial use allowed, no limits, no SLA; OSM / OpenMapTiles credit required | ✓ credit from its style |
| TMB API `api.tmb.cat/v1/transit` | metro lines and stations | **free, non-exclusive, worldwide, indefinite licence** (developer.tmb.cat/docs/terms-conditions, in Catalan); covers static GTFS and real-time data, reproduction, distribution, derivative works. Cite the source **and the date of the last update**; don't alter or distort; use only for the app named in the application; keys per application; TMB may impose other (paid) terms on some content and may end the licence on breach | ✓ credited in the dialog, with "live from the TMB API" as the date. Keys in the public bundle: not forbidden (the terms say the registration controls "how and from where" the API is used) |
| Catastro OVC `Consulta_DNPRC` | uses of the floors below ground, one call per card | SEC conditions: no bulk or automated use, per-IP limits (blocks of ~10 days). One call per user click is interactive use | ✓ keep it per click; never prefetch or bulk-download it (TODO-055) |
| Catastro OVC facade photo | card photo (flag off) | no stated terms | keep off |
| Catastro Sede, Google Maps, Idealista | links only | links are fine; name Idealista only to describe the link | ✓ |
| Geoapify geocoding / autocomplete | search box addresses (no key in production now), pins (flag) | Free plan: commercial use "with some limitations" in production; **"Geoapify attribution is mandatory"** on the Free plan, plus OSM attribution | ✓ "Search by Geoapify · © OpenStreetMap contributors" under the address results. **Commercial: a paid plan is needed** |

### 3.3 Pipeline only (not shipped)

| Data | Status |
|---|---|
| Inside Airbnb snapshot 2026-09-17 (CC BY 4.0) | research only; not in `barri-vibe.json`. Contains host names (personal data): keep it local |
| INE indices, INCASOL / Generalitat rental | fetched, not used by the app |
| Heat layers of the Atles de resiliència (Open Data BCN, CC BY 4.0) | fetched, not used |
| ICGC municipalities 1:100 000 (CC BY 4.0) | used to join prices, and for the municipality outlines in `areas.geojson` (item 6) |

### 3.4 Personal mode (flags off in production)

| Data | Terms |
|---|---|
| OTP2 with TMB GTFS (TMB licence), FGC GTFS, Rodalies GTFS (Mobility Database mirror of Renfe data, Renfe open-data terms, **verify**), OSM | runs locally only; if it is ever deployed (TODO-059), the TMB and Renfe terms apply to the routing results |
| Idealista HAR scrape → `idealista_prices.geojson` | against Idealista's terms; personal research only; never publish |
| Idealista HTML parser, screenshot → Claude Vision | the user's own page or screenshot; Anthropic receives the image; fine for personal use |

## 4. Personal data

None of the public files hold personal data. Catastro INSPIRE excludes owners and values (protected data).
The ESM microdata is anonymised and only barri aggregates are shipped. Airbnb host names stay local. The pins,
exclusion zones and settings live in the user's localStorage.

## 5. Notes on the hard cases

### 5.1 Catastro

- **Which licence applies.** The INSPIRE metadata (CODSI record `ES_SDGC_BU`, dated 2026-05-21) says "No
  conditions apply" and "CC BY 4.0 DG Catastro", and tags the data as an EU high-value dataset. Regulation
  2023/138 requires CC BY 4.0 or more permissive terms for that category. The Catastro INSPIRE page still
  links the 2016 licence (v1.0). That licence allows public and **commercial** use only of information that
  has been **transformed**: the original information may not be redistributed as is.
- **Our position.** We filter (residential only), join, aggregate, reproject and recombine the data into scores,
  so it is transformed under either reading. The card still shows per-building attributes almost verbatim
  (address, use, dwellings, floors, year). That is fine under CC BY 4.0, and arguably transformed under the 2016
  text.
- **What the 2016 licence also asks:**
  - don't alter or distort the information;
  - **don't present our product as "cartografía catastral" or "información catastral"**, or anything that could
    be taken for Catastro's own service;
  - the data has no official value.

  So: credit "© Dirección General del Catastro", and add "not official cadastral information" next to the
  Catastro facts in the card.
- **Fines.** Catastro is a State body, so Ley 37/2007 art. 11 applies (section 1).
- **Web services.** DNPRC is allowed per user click; bulk or automated use gets the IP blocked. For an offline copy
  (TODO-055), use the bulk downloads (INSPIRE, or the alphanumeric CAT files from the Sede under its download
  licence), not DNPRC.

### 5.2 RESCCUE street flooding

- The data is not on Open Data BCN, and the Atles viewer states no licence. Other Atles datasets are on Open Data
  BCN under CC BY 4.0 (noise risk, climate refuges), but the flood model is not.
- It is downloaded from `urbisadmin.carto.com` with a read key found in the viewer's config. That is a public key,
  not a bypass. Still, it is an undocumented channel, and the data stays "all rights reserved" by default.
- BCASA (Barcelona Cicle de l'Aigua) is a municipal company, and Aquatec is a private firm (Suez group). Rights
  may sit with either of them.
- **Research of 2026-11-14 (no licence found, but three leads).**
  - *Layer page* (`atles-resiliencia/index_resccue_inun_urbana.html`): credits "Font: PDISBA'19 (BCASA) - RESCCUE
    Project"; the model comes from BCASA's *Pla director de sanejament de Barcelona*. No licence, no reuse terms, no
    link to Open Data BCN or to a download. Footer: Ajuntament de Barcelona, Àrea d'Ecologia, Urbanisme i Mobilitat.
  - *Avís legal of the Ajuntament* (ajuntament.barcelona.cat/ecologiaurbana/ca/avis-legal): "permet reutilitzar totes
    les dades i informacions difoses per mitjà d'aquest web" unless stated otherwise, on four conditions: do not alter
    the content, do not distort its meaning, cite the source, do not imply the Ajuntament's support. But "quan no
    s'especifiqui cap règim de reutilització, s'entendrà que tots els drets estan reservats", and third-party material
    is not covered. A weak argument, not a licence: the data may belong to BCASA or Aquatec, and we repackage it
    (tiles, penalty), which may count as "altering".
  - *RESCCUE Data Management Plan* (D8.6, toolkit.resccue.eu/wp-content/uploads/2020/12/D8.6.pdf): the dataset
    "Urban drainage simulations in Barcelona" (Aquatec, BCASA; 75 shapefiles, 25 simulations; audience includes "the
    general population of the city") is planned for INSPIRE and Zenodo, "licensed to permit the widest re-use
    possible, when no limitations are identified by the key stakeholders". Results are withheld where stakeholders
    refuse. This is an intention, not a licence. **Use it in the letter.**
  - *Zenodo*: the RESCCUE WP1 data (10.5281/zenodo.3688402, CC BY 4.0) covers Lisbon, England/South Wales and
    Ter-Llobregat only. The Barcelona papers (Russo et al., Sustainability 2020, 12, 5638, CC BY 4.0) are open as
    text; that does not cover the shapefiles. No Barcelona urban-drainage dataset found on Zenodo (searches
    "RESCCUE", "urban drainage Barcelona shapefile"; only the first results were read).
  - *Open Data BCN* (CKAN API `package_search`): the 23 datasets of the Atles de resiliència there are all CC BY 4.0
    (noise, air, heat, green space, tourism...), but none is about flooding. Searches "flood", "inundació",
    "inundacions", "drainage", "RESCCUE" return 0; "pluja" and "aigües" return only historical rainfall and the
    stormwater tank list (`np-nasia-diposits-aigues-pluvials`), not depth maps. So the flood layer is the one Atles
    layer that was not released.
  - *Another possible holder*: the toolkit.resccue.eu legal notice reserves all content and databases of that website
    to CETAQUA (written consent needed to copy or modify). It concerns the website, not necessarily the Barcelona data.
  - *BCNROC record of PDISBA* (hdl.handle.net/11703/119275, read from a saved copy of the page): author Barcelona
    Cicle de l'Aigua, S.A., published 2020-07, terms of use **CC BY-NC-ND**. It covers the plan's documents (report,
    diagnosis, 5 volumes of maps), not explicitly the Atles layer. It is the only explicit licence found from the
    author of the model, and it is the restrictive one: no derivatives (our tiles and per-building penalty are
    derivatives) and no commercial use. So BCASA is the likely rights holder, and the letter must ask for
    transformation explicitly.
  - *Not checked*: RESCCUE Maps (csis.myclimateservice.eu/study/53, certificate error), INSPIRE catalogues.
- **Recommendation.** Write to the Ajuntament (Oficina Municipal de Dades / Open Data BCN, or the Resiliència
  Urbana department) and to BCASA as the likely rights holder, copy CETAQUA, quote the Avís legal and the DMP, and ask for the T10 / T100 depth layers on Open Data BCN under CC BY 4.0, or
  for written permission. Until then, the product owner's acceptance in 037 stands. For a paid or B2B product, switch off the
  street-flooding layer and its penalty.

### 5.3 OpenStreetMap and ODbL

- **Attribution:** "© OpenStreetMap contributors", linked to `openstreetmap.org/copyright`, visible on the map
  without interaction. It may collapse after 5 s or on the first map move. **Done:** it is in the map credit line
  (`MapCredit`), which never collapses, on desktop and mobile, and links to openstreetmap.org/copyright.
- `barcelona_poi.pmtiles` is a straight OSM extract that anyone can download from the site, so it is a derivative
  database "publicly used". It must be under ODbL, and say so.
- The walking-minute columns are computed from the OSM network and POIs and are published per building. The
  OSMF guidelines don't settle whether such computed values are a Produced Work or a Derivative Database. The
  safe and cheap option is to treat the OSM-derived columns as ODbL:
  - say so in the "Data sources" modal (**done**);
  - add a short `DATA_LICENSE` note next to the files (**done**: `frontend/public/data/DATA_LICENSE.txt`, and
    `THIRD_PARTY_NOTICES.md` in the repo root);
  - be ready to send the OSM-derived columns as a CSV on request (contact in the dialog: info@time2map.com).

  The Catastro and other columns stay under their own terms; the file is a collective database. Don't relicense
  the Generalitat or Catastro data under ODbL: the Generalitat licence forbids sublicensing.

### 5.4 TMB

Read on 2026-11-14 from https://developer.tmb.cat/docs/terms-conditions (Catalan only). Summary, not a translation:

- **Who and what.** Anyone who builds an app that informs about TMB transport, or a service or product that draws on TMB
  content. The text does not separate commercial from non-commercial use: both are services or products.
- **Licence.** Free ("a títol gratuït"), non-exclusive, worldwide, indefinite. It covers reproduction, distribution,
  public communication and derivative works, for the static GTFS and the real-time services. So a **static copy
  (TODO-055) is allowed** under this text.
- **Conditions.** Cite the source and the date of the last update in the app; don't alter or distort the content; use the
  content only for the app or service named in the application ("únicament i exclusivament"); keys are issued per
  application. The client is liable for damages and indemnifies TMB.
- **What can change.** TMB may license some content under other terms with payment, may change or remove content, end
  the licence, or change the API without a duty to warn; breach allows immediate termination. Content is as-is.
- **Browser keys.** Not addressed. The terms say the application registration controls how and from where the API is
  used; keys in a public bundle are not forbidden.
- **What we do.** Credit in the dialog (publisher, licence link, "live from the TMB API" as the date). We do not change
  the metro lines.
- **Accepted.** The product owner accepted these terms when creating a new application and receiving its ID (the ID
  the app uses). No open risk for the current use.
- **Watch.** The licence is tied to the use named in the application: if the product becomes commercial, update that
  statement. Keep a copy of the accepted terms in `local-docs/`. If TMB ever asks for payment for a content type, draw
  the metro lines from OSM instead.

## 6. Attribution (implemented in TODO-066)

What the app does now. The registry `frontend/src/services/dataSources.ts` is the single source: the map line, the
dialog and the legends read from it, and `dataSources.test.ts` fails when a layer with an `attribution` has no entry.
Texts: `frontend/src/locales/<lang>/legal.json`. The original proposal follows; differences are noted.

**On the map** (own component `MapCredit`, not MapLibre's control: always visible on desktop, bottom right; on a phone the line is shown first and folds into a small «©» button after 5 s or at the first touch of the map, a tap reopens it (OSMF's attribution guidelines allow collapsing after the credit was shown; checked 2026-11-15; see 066), above the sheet and above the first-visit sheet; the raw-HTML credit in the panel and the old About sheet
were removed):

> © ICGC · © OpenStreetMap contributors · © Dirección General del Catastro · Data: Ajuntament de Barcelona,
> Generalitat de Catalunya, MITECO · [Data sources](#)

**"About and data sources" dialog** (`AboutDialog`; opened from the ⋯ menu of the brand bar, the info button on a
phone, and the "Data sources" link in the map line; a modal on desktop, a sheet on a phone). One row per source:
publisher, dataset, year or update date, licence with a link, and "modified by time2map" where we transform it.

- Buildings: © Dirección General del Catastro, INSPIRE Buildings and Addresses, update `<date>`, CC BY 4.0.
  Selected and combined by time2map; not official cadastral information.
- Noise: Ajuntament de Barcelona, Strategic Noise Map 2022, CC BY 4.0 (Source of the data: Barcelona City
  Council). Outside Barcelona: Generalitat de Catalunya, Departament de Territori, Habitatge i Transició Ecològica (published by SICA, MITECO), 4th round (2022), delivered 2024-12 to 2025-03; no licence stated, Generalitat default by reading. Aggregated per facade by time2map.
- Residents' opinion: Ajuntament de Barcelona, Enquesta de Serveis Municipals 2022–2026, CC BY 4.0. Small samples
  adjusted towards the gran barri by time2map.
- Sale prices: Generalitat de Catalunya, Departament de Territori, Habitatge i Transició Ecològica / INCASOL,
  sales and prices `<year>`.
- River flood zones: Generalitat de Catalunya, Agència Catalana de l'Aigua, downloaded `<date>`.
- Wildfire: Generalitat de Catalunya, Departament d'Agricultura, basic wildfire hazard map 2024; Protecció Civil
  de Catalunya, WUI zones (ICGC geoservei), CC BY 4.0.
- Street flooding: RESCCUE project (BCASA / Aquatec), Atles de resiliència, Ajuntament de Barcelona. Used with
  `<permission / pending>`.
- Walking times, services, POI: © OpenStreetMap contributors, ODbL 1.0. Derived data available under ODbL on
  request.
- Base map: © ICGC, CC BY 4.0; © OpenMapTiles © OpenStreetMap contributors. Terrain: Mapterhorn (Copernicus
  GLO-30, © CNIG "scne.es" CC BY 4.0).
- Areas: Ajuntament de Barcelona (CartoBCN), CC BY 4.0; municipalities © ICGC, CC BY 4.0.
- Transit: TMB ("TMB open-data licence, cite source and update date", live from the API); FGC (CC BY 4.0, GTFS from the open-data portal).
- Not affiliated with or endorsed by any of these bodies.

Also in the dialog: "not official, not endorsed", "not official cadastral information", the ODbL notice, a note that
street flooding has no licence, what leaves the browser (ICGC, OpenFreeMap, the terrain service and Geoapify see the
IP), and the contact (Alexander Semenov, info@time2map.com).

**In context:** building card (Catastro credit and "not official"; noise source), locals' opinion (Barcelona City
Council, CC BY 4.0, small samples marked), sale price (INCASOL), address results (Geoapify and OSM).

**Dates.** `build_building_tiles.py` writes a `sources` block (date of each input file) into `buildings-meta.json`.
The dialog uses it; the current deployed file was built before this change, so for now sources baked into the
building files show the build date, and the next data rebuild fills the real dates. Sources with a fixed edition
(noise 2022, survey 2022–2026, wildfire 2024) show the edition.

## 7. Action plan

**Done:** TODO-066 (items 1, 3 and 8, the credit in the Geoapify results, the `VITE_COMMERCIAL_USE` switch for the
street-flooding layer and penalty) and TODO-067 (items 5 and 6). Item 4 (TMB) is closed: terms accepted with the
application. **Item 7 (facade photo)** stays off.

**Still open** (need a third party, or a lawyer):

| What | Why |
|---|---|
| Item 2: permission from the Ajuntament / BCASA / Aquatec for the RESCCUE layer, or publication on Open Data BCN under CC BY 4.0 | no licence at all; the layer is off with `VITE_COMMERCIAL_USE=true` |
| Catastro: written confirmation that the buildings data is CC BY 4.0 | the 2016 licence PDF allows commercial use of transformed data only, and the card shows facts almost verbatim |

**Before a commercial launch** (none of it is needed while the product is non-commercial):

| What | Why |
|---|---|
| The three open items above | see the table |
| TMB: update the stated use in the TMB application if it becomes a paid product | the licence is free but tied to the use named in the application; TMB may attach fees to some content |
| Geoapify: paid plan | the Free plan limits commercial production use |
| Catastro DNPRC and Mapterhorn: ask for terms at scale, or self-host | no stated terms for volume |
| Legal notice (LSSI-CE art. 10: owner, contact) and a privacy policy | a site with economic activity needs them; show to a lawyer |
| Set `VITE_COMMERCIAL_USE=true` until the above are settled | switches off the unlicensed layers |

**Housekeeping:**

- Keep a copy of the accepted TMB terms in `local-docs/` (not in git; **not done yet**: only the product owner holds
  the accepted version).
- Keep the Idealista scrape out of git and production.
- `landmark-geometries.json` was deleted (TODO-066).

## 8. Not verified

Re-checked on 2026-11-14 (TODO-067). Links in the registry were re-checked the same day (three were broken and are fixed:
Open Data BCN noise dataset, INCASOL statistics page, ACA).

**Settled:**

- **ACA WFS** (`sig.gencat.cat/ows/AIGUA/wfs`): the capabilities document has empty `Fees` and `AccessConstraints`, and
  no licence in the layer metadata (`AIGUA_LI10`, `LI100`, `LI500`). So there is no per-layer licence, and the Generalitat
  default licence applies by the legal notice below.
- **Legal notice of `habitatge.gencat.cat`** (INCASOL): the site has none of its own; its footer links to the gencat
  notice, https://web.gencat.cat/ca/ajuda/avis_legal/. That notice allows commercial and non-commercial reuse under the
  "Llicència oberta d'ús d'informació – Catalunya" or CC0, on three conditions: **don't alter the content or the
  metadata, cite the source, give the date of the last update**; don't distort the meaning, don't reverse
  anonymisation; no logos. A specific licence of a work prevails. Same conditions as in section 2.
- **FGC GTFS licence**: CC BY 4.0 on FGC's open-data portal (dataset `gtfs_zip`, same file as
  `fgc.cat/google/google_transit.zip`). The portal's own "terms" link redirects to the website's legal notice, which
  forbids commercial exploitation of web content but says nothing about the portal's data; the dataset's CC BY 4.0
  statement is the specific licence and prevails.
- **SICA, 4th round (what we use).** `building_exposure.py` reads five agglomeration deliveries of the 4th round
  (L'Hospitalet, Baix Llobregat I and II, Barcelonès, Vallès Occidental I; 14 AMB municipalities). Read on 2026-11-14:
  - **SICA's page** (https://sicaweb.miteco.gob.es/datos-geoespaciales/4a-fase/, opened with the FNMT intermediate
    certificate that the server leaves out, as `scripts/fetch_exposure_sources.py` does): the files are *"los aportados
    por cada una de las autoridades competentes en Ruido Ambiental, sin cambios"* (originals); the date shown is the
    delivery date to MITECO, *"que se considera como fecha de actualización"*: L'Hospitalet 2025-03-28, Baix Llobregat I
    2025-02-11, Baix Llobregat II 2024-12-13, Barcelonès 2025-02-11, Vallès Occidental I 2024-12-20. No licence.
  - **The XML metadata inside the five zips** (ISO 19139, INSPIRE): the contact and the "AACC" (competent authority) of
    every delivery is the **Generalitat de Catalunya, Departament de Territori, Habitatge i Transició Ecològica,
    Direcció General de Canvi Climàtic i Qualitat Ambiental**; the resource constraints say *"Otras limitaciones no
    listadas"* (no licence stated); lineage: *"La información es responsabilidad de la Autoridad Competente en Ruido
    Ambiental que la genera"*. (Metadata dates, 2024-12-13 to 2025-01-15, differ from the page dates; we show the page's,
    which SICA calls the update date. The Vallès Occidental II delivery has the same authority.)
  - **MITECO's legal notice** (linked from the page, https://www.miteco.gob.es/es/atencion-al-ciudadano/aviso-legal.html):
    reuse without authorisation **if the source is cited**; keep the update-date metadata; don't suggest that the Ministry
    supports the reuse; third-party IP excluded; no licence named, commercial use not mentioned.

  So the author is the Generalitat and MITECO only publishes. With no licence stated, the Generalitat default licence
  applies by its legal notice (same reading as ACA and INCASOL): cite the source, give the update date, don't alter or
  distort, no logos. The card and the dialog now credit the Generalitat department (published by SICA, MITECO) with the
  delivery dates. The earlier "© MITECO" form came from the 3rd-round page and did not fit. State information: Ley 37/2007
  art. 11 applies to MITECO's part (section 1).

**Still open:**

- **SICA 4th round: no licence is stated anywhere** (page, XML metadata, legal notice). The Generalitat default
  licence is our reading, as for ACA and INCASOL. For a commercial launch, ask the Direcció General de Canvi Climàtic i
  Qualitat Ambiental (contact in the metadata, `acusticaluminica.accioclimatica@gencat.cat`) to confirm. (Lead, not
  checked: SICA also lists "Aglomeración del Vallès Occidental II" (same Generalitat authority, delivered 2024-12-13),
  which `TODO-043` does not use; it may cover some of the 21 municipalities that have only corridor maps.)
- Renfe / Rodalies GTFS terms (personal mode only).
- Whether the Catastro 2016 licence PDF is still meant to apply next to the CC BY 4.0 metadata.

## 9. References

- Catastro INSPIRE: https://www.catastro.hacienda.gob.es/webinspire/index.html, licence v1.0 (2016):
  https://www.catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf; metadata (CC BY 4.0, HVD):
  https://www.idee.es/csw-codsi-idee/srv/api/records/ES_SDGC_BU
- Catastro SEC conditions of use: https://www.catastro.hacienda.gob.es/ayuda/condicionesuso.htm
- Ley 37/2007, art. 11 (sanctions): https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814
- Open Data BCN terms: https://opendata-ajuntament.barcelona.cat/en/node/52; datasets `esm-bcn-evo`,
  `rasters-mapa-estrategic-soroll` (CKAN `package_show`, licence CC-BY-4.0)
- Generalitat licences: https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies;
  legal notice: https://tramits.gencat.cat/ca/ajuda/avis_legal/
- ICGC ContextMaps (CC BY 4.0): https://www.icgc.cat/en/Tools-and-viewers/Viewers/ContextMaps
- OSM attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines; Produced Work
  guideline: https://wiki.openstreetmap.org/wiki/Open_Data_License/Produced_Work_-_Guideline
- OpenFreeMap: https://openfreemap.org/
- Mapterhorn sources: https://download.mapterhorn.com/attribution.json
- Geoapify terms: https://www.geoapify.com/terms-and-conditions/
- SICA / MER metadata (CC BY 4.0): https://inspire-geoportal.ec.europa.eu/srv/api/records/7cd6405b-9586-45be-9f5a-78bf0919a250
- Atles de resiliència, RESCCUE: https://coneixement-eu.bcn.cat/widget/atles-resiliencia/en_index_resccue_inun_urbana.html
- `martgnz/bcn-geodata`: https://github.com/martgnz/bcn-geodata
