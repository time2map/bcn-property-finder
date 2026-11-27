# 064 — Area card and share links (L1 follow-up)

Status: implemented 2026-11-14 (branch `feat/064-area-card-share`, not yet merged). Follows 063 (share image).

## Why

063 made pictures and static pages for every barri, but nothing in the app leads to them: a click on an area only flies
there and outlines it, and the Share button copies the whole map state with the generic preview. A person cannot share
"this barri" or "this building" as such.

## What

### 1. Area card (click on a barri, on the map or in the list)

- Opens a card (desktop side panel / phone sheet) in the style of the building card.
- Content: name, short description, statistics for the current settings — homes (`n`), percent good match
  (`shareGood`), percent great (`shareGreat`), mean score, strongest conditions (`strongest`), and a note when many
  buildings have incomplete data (`incomplete`).
- Buttons: **Save image** (the 4:5 picture of the area, same drawing code as 063) and **Share**.
- **Share** of an area: a link to the static page `/share/<profile>/<barri>/` when the settings equal a profile
  (the page has the area's preview picture), otherwise the normal map link with the view on the area.

### 2. Share a building

- A **Share** button next to **Save image** on the building card.
- The link opens the map with that building selected and its card open, with the sender's conditions (`c=`).
- A building is addressed by its coordinates (`b=<lng>,<lat>`, 5 decimals), not by its row number: the row number
  changes with every rebuild of the data, links would break. On load the nearest building within a few metres is
  selected.
- Preview of this link stays generic until there is a server (A1); the picture goes with Save image.

### 3. Area descriptions (decided)

- A short text per barri (2–3 sentences: character, landmarks, what it is known for), written by Claude and stored in
  a static file (`frontend/src/data/areaDescriptions.ts` or JSON), reviewed by the owner before launch.
  No third-party text, so no licence to track. Facts only that are stable (location, well-known landmarks).
- Under it a sentence made from the numbers, as in the area list: "71% of 1,240 homes are a good match; strongest on
  noise and daily services."
- A barri without a text shows only the numbers line.

## Open questions

1. ~~Where do the description texts come from?~~ Decided: written by Claude into a static file + a numbers line.
2. Municipalities of the metro area: card without the static page (no pages are built for them).
3. Districts (distritos) are not clickable areas today; leave out.

## Plan

1. Tests first: `buildingLink` (encode/decode `b=`, nearest building), `areaCardModel`, `useShare` variants.
2. `b=` in `useUrlState` / the loader; select the building after the data is ready.
3. `AreaCard` + the click path (`selectAreaFeature` also sets the selected area in the store).
4. `SaveImageButton` generalised for areas (reuses `areaShareModel`; the map is the live snapshot, the focus point is
   the area centre).
5. Share buttons; docs (`ARCHITECTURE`, `DESIGN`, `FEATURES_OVERVIEW`, `ROADMAP`).
6. Branch from `dev`: `feat/064-area-card-share`.

## As built

- **Area card**: `components/AreaCard/AreaCard.tsx` (lazy-loaded from `App.tsx`: the texts of the 73 barris stay out of
  the 500 KB initial bundle). Opened by a click on an area of the map (`AreasLayer`) or a row of "Your areas"
  (`AreasList`), through `selectAreaFeature(feature, index)`, which sets `selectedArea` in the store. A building and an
  area never have a card together (`setSelectedBuilding` / `setSelectedArea` clear each other). Closes with the ×, Esc,
  or by picking a building; closing also removes the outline.
- Content: name and "Barcelona" / "Metro area"; the description (barris only); the share of good homes as a big number,
  a bar and "of N homes are a good match"; "x% are a great match · average score y"; "Strongest on: …"; a note when
  many homes have incomplete data. An area with too few homes shows only the count and a Share button.
- **Phone**: the card fills the bottom sheet like the building card (peek: name and share; half/full: the rest).
  `useSheetFlow` and the sheet's `view` treat an open area like an open building. The "area picked" note of 062 is no
  longer used by the list (the card replaces it).
- The map fits the area with extra padding on the right while the card is open (`SearchLayer`).
- **Save image** of an area: the same picture as 063's area model (`areaShareModel`), on the live map around the
  centre of the area's bounding box.
- **Share** of an area (`services/areas/areaLink.ts`): a ranked barri with a profile's settings → the static page
  `<site>/share/<profile>/<barri>/` (its own preview picture); anything else → the map's address with `c=`.
  `areaSlug` moved to `shareImageModel.ts` so the app and the build script use the same one (a test checks that the 73
  barri slugs differ).
- **Opening an area from a link**: the static page of a barri sends people on to `/?c=…&zoom&cx&cy&a=<barri code>`, and
  the map link of an area card carries the same `a`. `hooks/useLinkedArea.ts` reads it once at start and, when the ranks
  and polygons are in, flies to the area and opens its card (`selectAreaFeature`), as `b` does for a building.
- **Share** of a building (`services/buildingLink.ts`, `ShareLinkButton`): copies (or, on a phone, offers in the share
  sheet) `?…&zoom=17&cx&cy&b=<lng>,<lat>&c=…`. `hooks/useLinkedBuilding.ts` reads `b` once at start (before
  `useUrlState` rewrites the address) and selects the nearest building within 15 m once the data is in. The link of
  "Save image" on a phone now carries the same `b`.
- **Descriptions**: `services/areas/areaDescriptions.ts`, `{ '<barri code>': { en: '…' } }`, English only for now;
  `areaDescription(code, lang)` falls back to English, so another language can be added without code changes (028).
  A test checks that every barri has a text and that no text is longer than two sentences.
- The preview of a building link stays generic (needs the server, A1).

### To check before launch

- Read the 73 descriptions with someone who knows the city; they are written from general knowledge, not from a source.
- In dev the static pages do not exist (they are made by `npm run build`), so the Share link of a barri 404s there.
