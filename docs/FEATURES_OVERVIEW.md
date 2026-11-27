# Features overview (2026-11-13)

Summary of everything in `docs/features/`: what is built, what was dropped, what is planned. Details and status live
in the feature files; the order and dependencies of the planned work are in [ROADMAP.md](ROADMAP.md).

## 1. Implemented

### Foundation and routing
| # | Feature |
|---|---|
| 001 | Frontend scaffold: React + Vite + TypeScript, MapLibre, Barcelona map, store |
| 004a | OTP2 local setup in Docker with Barcelona transit data |
| 004 | Public transport isochrone (single mode, OTP2) |
| 002 | Workplace marker (draggable) + isochrone, area outside dimmed |

### Personal mode: pins and comparison
| # | Feature |
|---|---|
| 005 | Property pins with travel times to the workplace, sortable list |
| 006 | Screenshot parsing: Idealista screenshot → pin (local vision model) |
| 013 | Idealista HTML parser: saved listing page → pin with full data |
| 012 | Photo thumbnail on the map pin |
| 014 | Compare panel as a marketplace spec-sheet with split layout |
| 023 | Right-click → Google Maps satellite view |

### Livability index and data layers
| # | Feature |
|---|---|
| 009 | Noise level layer and score |
| 010 | 15-minute-city walkability score |
| 011 | POI map layer (Maki icons) |
| 017 | Livability index map (originally H3 grid, now buildings, see 046) |
| 021 | City core access index |
| 022 | Composite livability index (weighted components) |
| 024 | Open price component (INCASOL) |
| 036 | Climate risk penalties: river flood and wildfire |
| 037 | Street flooding penalty (RESCCUE) + depth layer |
| 042 | Locals' opinion of a barri in the composite index |
| 046 | Building-level index (replaced the H3 hexes) |
| 047 | Building age in the index + plain-word panel labels (includes 045) |
| 045 | Panel labels in real units (merged into 047) |
| 019 | Idealista price heatmap layer |
| 020 | Area boundaries layer (the boundaries layer itself was later removed, the exclusion-zone UX stayed) |

### Finding where to look
| # | Feature |
|---|---|
| 015 | Exclusion ("no-go") zones, subtracted from the search area |
| 016 | Idealista saved filter URL |
| 038 | Best zones: compact zones from the index → Idealista (replaced the isochrone export of 003) |
| 003 | Idealista export button (superseded by 038; `services/idealista.ts` is still used) |
| 032 | Colour scale fitted to the visible area |
| 044 | Address and area search |

### Mass-market UX
| # | Feature |
|---|---|
| 049 | Conditions in real units ("up to 65 dB is OK for me") |
| 050 | Match score: match bands, a row per condition ("Meets N of M" count removed 2026-11-16) |
| 031 | Onboarding: profiles + one sentence |
| 051 | Ranked list "Your areas" and area view at low zoom |
| 052 | Conditions editor as sentences, one expert layer at a time |
| 053 | Shareable state: conditions in the URL, Share button |
| 060 | Incomplete data: score range and hatched fill |
| 061 | No conditions: neutral map with a hint |
| 062 | Mobile web: one bottom sheet (peek / half / full) over a live map, search pill, "Where am I", touch-sized controls |
| 063 | Share image of the result: "Save image" on the building card (4:5), link-preview pictures and pages for the home page and every barri × profile |
| 029 | "Want a map like this?" in the About dialog: a link to time2map.com with the place in `utm_medium` (no email subscription) |
| 064 | Area card (click on a barri or a row of "Your areas"): description, how many homes fit, Save image and Share; Share on the building card opens that exact building |

### Branding and sharing
| # | Feature |
|---|---|
| 034 | OG tags, social sharing, default map state |
| 035 | Branding and basic redesign (MS1) |

## 2. Will not be implemented (deprecated)

| # | Feature | Dropped | Reason |
|---|---|---|---|
| 025 | Hex detail card | 2026-11-04 | Replaced by the building card; removed with the hexes (046) |
| 026 | Noise hex accuracy (area average vs centroid) | 2026-11-04 | Replaced by noise per building facade (046); no area averaging |
| 027 | Territory mode + territory cards with SEO URLs | 2026-10-27 | A district or barri has no meaningful single score (noise, walkability, access change street by street). Built behind a flag, rolled back unmerged. Only price is native to an area |
| 039 | Residential mask for the H3 grid | 2026-11-04 | Replaced by the non-residential building filter in the building tiles pipeline (046) |

Do not propose these again unless the feature file says when to revisit.

## 3. Roadmap (from the TODO features)

Source of truth for order: [ROADMAP.md](ROADMAP.md). A1 + A2 are the minimum before a launch post.

### Now
| Feature | State |
|---|---|
| TODO-058 Frontend performance budget | Partly done: worker scoring, code splitting, faster start, smaller data. Open: cache headers (needs 054), Lighthouse ≥ 80, a real low-end phone, chunk tuning |

### Infrastructure for the launch (before any press link)
| Order | Feature | Depends on |
|---|---|---|
| A1 | TODO-054 Hosting: CDN cache, own server as origin, versioned data | — |
| A2 | TODO-056 Observability: analytics, errors, uptime, data version | A1 for self-hosted parts |
| A3 | TODO-055 Own basemap, static metro, Catastro offline | A1 |
| A4 | TODO-057 CI gate, branch previews, data out of git | A1 |
| A5 | TODO-058 remainder (cache headers, Lighthouse) | A1 |
| — | TODO-059 Edge API for the personal mode (isochrone cache, vision proxy) | A1; design only, when isochrones go public |

### Later (unordered)
| Feature | Idea |
|---|---|
| 065 i18n | EN / ES / CA, any number of languages, `?lang=` in the URL, texts in `frontend/src/locales/` |
| TODO-030 Landing / about page | "What is this?" page for cold visitors |
| TODO-033 Multi-city | Madrid, Valencia, Málaga, Palma; needs a non-Barcelona name and a city-agnostic pipeline |
| TODO-040 Green index | Tree canopy within 300 m as a new component |
| TODO-041 Market activity | Sales and rental turnover per barri, informational block |
| TODO-043 Noise outside Barcelona | Noise data for the AMB municipalities beyond the city map |
| TODO-048 Energy certificates and ground-floor premises | ICAEN rating and what is downstairs; draft, not agreed |
