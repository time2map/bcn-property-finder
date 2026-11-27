# Barcelona Livability Map — product brief

Synced with the code on 2026-11-11. Public beta: https://livability.time2map.com (time2map).

## What it is

An interactive map that helps people choose where to buy a home in Barcelona and its metropolitan area (AMB).
Every residential building is coloured by how well it meets the user's own conditions: noise, walkability,
access to the city centre, price, building age, residents' opinion, and climate risks. No account is needed.
Settings stay in the browser.

The product has two modes in one codebase, separated by feature flags (`docs/FEATURE_FLAGS.md`):

| | **Public map** (live) | **Personal comparison** (local only) |
|---|---|---|
| Question it answers | Where in the city would I like to live? | Which of the listings I found should I buy? |
| Unit | residential building (~174k, Catastro) | a candidate apartment (pin) |
| Needs a server | no: static files on GitHub Pages | yes: OpenTripPlanner 2 + API keys |
| Flags | `BEST_ZONES`, `LOCALS_OPINION` | `ISOCHRONE`, `PINS`, `SCREENSHOT`, `EXCLUSIONS`, `IDEALISTA_PRICES` |

## Public map

### User flow

1. The user opens the map. The match score is on, with default conditions. A search box jumps to a district, barri, municipality or an address (address suggestions need the Geoapify key).
2. In the panel the user turns conditions on or off and sets each limit in real units. The panel shows what each
   setting means in words, for example "Up to 65 dB is OK for me — like a busy street" or "I'm ready to pay up
   to €4,000/m²".
3. The map recolours on a fixed 0–100 scale with four bands (Great / Good / Partial / Poor match), so green means
   "fits me" anywhere. An optional **Boost contrast** switch fits the scale to the visible area.
4. A click on a building opens its card. It opens with the match ("83 of 100 · Good match", one row per condition) and, where the building stands out, an award ("Top 10% / Top 20% of homes in the barri / the city"); then, under "Details about this building" (folded), it shows Catastro facts, the photo (flag), noise by facade side, walking
   times, climate risks, and a clearly labelled **Barri-level** block (price, what locals say).
5. **Draw best zones** outlines up to 3–5 compact best areas in view. Each zone opens as an Idealista search
   with the user's saved Idealista filters.

### Conditions

Each condition scores 100 when the building meets it and falls linearly to 0 beyond it:

| Condition | Meaning | Default |
|---|---|---|
| Services on foot | chosen everyday services (supermarket, pharmacy, park, school, kindergarten, clinic, metro station, café, restaurant; beach on request) within N min walk along the streets | on, 10 min |
| Noise on the street side | Lden on the street side of the building, else over all its facades (Barcelona 2022 map; 14 AMB municipalities: SICA 2022) | on, 65 dB |
| City Core Access | chosen places within N min walk (Plaça Catalunya, Barri Gòtic, Passeig de Gràcia by default; 13 to choose from) | on, 30 min |
| Market Price | official INCASOL sale €/m² of the barri or municipality, not of a specific flat; a hard condition: over it a home is at most a partial match | on, €4,000/m² |
| Locals' opinion | residents' satisfaction with their barri, municipal survey; Barcelona city only | off, 7.5 / 10 |
| Building age | year built inside the eras the user likes | off |

The match score (called the Livability Index until 073) is the **mean over the conditions that are on**. A
condition that is on but has no data makes the score a range (it counts 0 to 100) and the building is hatched.
Shares and ranks ("Top N% of homes") count homes (dwellings), not buildings. Climate risks are **penalties**, not averaged in: river flooding, wildfire
and street flooding in heavy rain reduce the score of exposed buildings only, by a strength the user sets.

### Principles

- The building is the unit. Numbers that only exist per area are labelled as barri- or municipality-level.
- Conditions are set in real units, not abstract weights.
- Model limits are stated in the UI: noise is modelled 4 m above the ground; street flooding matters most for
  ground floors and basements.
- Everything is computed in the browser from precomputed open data, so there is no backend to run.

## Personal comparison mode

The original goal of the project: compare listings already found (e.g. on Idealista).

1. **Workplace and commute.** The user clicks the workplace. OTP2 builds the area reachable by public transport
   within N minutes (15–120). Everything outside is darkened.
2. **Exclusion zones.** The user draws no-go areas or picks districts, barris or municipalities. They are cut out
   of the commute zone. Pins inside them are flagged.
3. **Pins.** The user places a pin on the map, uploads a listing screenshot (parsed by Claude Vision, then
   geocoded), or imports a saved Idealista HTML page.
4. **Compare.** Each pin gets travel times by four modes, a travel index, noise, walkability and a composite score.
   The pins are compared side by side in a sortable table with photos, price, €/m², rooms and a personal rating.

The pin score is an older model than the building index: it uses weights, straight-line walkability and the
noise isophone at the pin point. See `docs/ARCHITECTURE.md`.

## Out of scope for now

Accounts, saving settings in the URL or a server, other cities, and languages other than English. Planned
ideas live in `docs/features/TODO-*.md` and `docs/RAW_IDEAS.md`. Dropped ones are in
`docs/features/DEPRECATED-*.md`.

## Stack

React + MapLibre, static data in PMTiles, Python data pipeline. OTP2 for routing in the personal mode. See
`docs/ARCHITECTURE.md`.
