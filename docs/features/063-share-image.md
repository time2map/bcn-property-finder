# 063 — Share image of the result (launch track, L1)

**Status:** Implemented 2026-11-13 (see "As built"). Checked in the browser on desktop and in a phone viewport;
**open: paste a shared page into WhatsApp, Telegram and X after the first deploy** (a preview can only be checked on a
public address). Part of the launch track in `docs/ROADMAP.md`; depends on 053 (settings in the URL), 050 (match
bands) and 044 (search).

## Problem

A link without a picture does not travel. The current `og-image.jpg` is a bare crop of the map: no name, no number,
no brand. In a chat or a feed it says nothing. People share a result about themselves ("my street is a Good match
for a family"), and for that the picture must carry the result.

## Decision

- Two kinds of image, three formats:
  1. **Link preview of the site** (Open Graph / Twitter card, 1200×630): replaces `og-image.jpg`.
  2. **Link preview of a result** (1200×630): for a shared link that points at a place.
  3. **Saved image of a result, 4:5 (1080×1350)**: "Save image" / native share. 4:5 is the main format (feed and
     messengers). A 9:16 story variant is drawn but **not in scope** until 4:5 works.
- Place name on the image: **barri, or the building's first address with its house number** (changed
  2026-11-16 from "street without number": a bare street name does not say which home the picture is about; the
  number is public Catastro data, the same as on the card).
- Language: a picture saved in the app is drawn in the page language (texts in `card:share.*`, `card:rank.*`, band and
  condition labels, brand from `common:brand.title`). Pictures built ahead of time (site and barri link previews) stay in
  English.
- Domain on the image: `https://livability.time2map.com` (the final domain, decided 2026-11-13).
- The map attribution ("Map: ICGC, OpenStreetMap contributors") is on every image.

## Design

Mockups: Claude design canvas "Share image mockups (L1)" (artboards: result preview, site preview, 4:5, 9:16).
Type IBM Plex Sans; colours from `docs/DESIGN.md` (match ramp, brand coral for the mark).

Content of a result image, in priority order (must read at 300 px wide):

1. **Score and band**: big number and band name on the band colour (`Good match · 83`).
2. **Place**: street or barri, then the barri and city.
3. **For whom**: the profile ("For a family"). No profile, no line.
4. **3–4 condition rows** with ✓ / ◐ / ✗ and the shortfall in words (same statuses as the card header, 050).
   Risk penalty row if any.
5. **Map**: the area around the place with the match colours, the place marked with the brand pin.
6. **Brand and URL** at the bottom.

Site image: map of the city by barri, the line "How liveable is your street?", one sentence, the four-band scale.

Layout rules: 60 px safe margin on every side (previews crop differently), no text under 20 px at 1200 wide, panel
on the right of the 1200×630 image and at the bottom of the 4:5 image, the map fills the rest.

## Spec

**L1a — Save image (no infrastructure)**

- Button "Save image" on the building card (the area card does not exist on the desktop; see "As built"). On a phone with `navigator.share`
  and file support, share the PNG; otherwise download it.
- Rendered in the browser from the current state (selected building or area, conditions, profile) on a canvas.
  The map part comes from the live map (`map.getCanvas()` re-rendered with a simplified style).
- **Simplified map style for the image:** no POI icons, no elevation contours, no labels except streets and the
  barri name; the match colours stay. At building level the live map is too noisy for a picture.
- Footer attribution and URL are drawn on the canvas.

**L1b — Link previews (needs hosting, A1)**

- New site-wide `og-image.jpg` from the "site" mockup. Needs no server: replace the file and the meta tags.
- Pre-rendered result images for every barri × profile (~70 × 4), static pages `/share/<profile>/<barri>/` with their own
  meta tags (built that way). The link preview of a `c=` link is a generic one (preview by arbitrary settings would need scoring on
  a server; not planned for the launch).

## Decisions on the content (2026-11-13)

- **No "Meets X of Y" line** on the image. The rows carry the detail; the band and score carry the verdict.
  (This also removes the "Great match · 92" next to "Meets 0 of 3" contradiction on a shared image. The card
  header itself is unchanged by this feature.)
- **"For whom" line only with a profile.** Custom conditions: the line is not drawn, the place moves up.
- **Incomplete data (060): show the maximum**, the same number as the colour and the band (the best case), with no
  range on the image. The card keeps its range.

## Open questions / known issues

- Rounding at the limit: `matchText.ts` compares the **rounded** dB with the limit ("58 dB, under your 58"), while
  the row status uses the unrounded score (a component at 99 is "partly met"). So a building at 58.4 dB reads
  "58 dB, under your 58" with a ◐. Not caused by this feature, but visible on the image: fix by comparing the same
  value in both places (a small separate fix, to be agreed before L1a ships).

## As built (2026-11-13)

One drawing code for both worlds, `services/shareImage/`:

- `shareImageModel.ts` (pure): `buildingShareModel` / `areaShareModel` → what the picture says; `firstAddress()` (first address,
  with number), `profileOf()` (the settings equal a profile exactly, else null), `wrapLines()`, `shareFileName()`.
- `shareImageDraw.ts`: paints any Canvas 2D context, 1200×630 (`og`) or 1080×1350 (`post`, 4:5), plus the site
  picture (`drawSiteImage`). The map behind the panel is passed in. Rows shrink from the full size down to 18 px until
  they fit; the brand drops out of the footer when it does not fit beside the address.
- **L1a (browser):** `captureMap.ts` + `shareImageBrowser.ts` + `components/BuildingCard/SaveImageButton.tsx`. The
  button is on the building card (desktop card and phone sheet; 44 px on a phone). A click draws the live map around
  the building without shop icons, contour lines and labels other than street names, with the map set to at least
  pixel ratio 2 for the moment of the snapshot (so a 4:5 picture is sharp from a landscape map), then restores it. A
  phone that can share files opens the share sheet with the picture and the link; everything else downloads
  `barcelona-livability-<street>.png`. The drawing code loads on the first click (the initial bundle budget).
- **L1b (build):** `npm run build` ends with `scripts/build-share-images.mjs` (`@napi-rs/canvas`, the same drawing
  code, IBM Plex Sans from `@fontsource`). It scores all buildings for the first-visit settings and for each of the four
  profiles, then writes `dist/og-image.jpg` (the home page: the city by barri, "How liveable is your street?") and, for
  every ranked barri and profile, `dist/share/<profile>/<barri>/index.html` (its own Open Graph / Twitter tags and a
  redirect to the map with `c=preset:<profile>`, `zoom=14` on the barri) and `dist/share/<profile>/<barri>.jpg`.
  284 pages, ~21 MB, ~5 s. The map in these pictures is the areas coloured by mean score (no tiles), boundaries from
  the Ajuntament, credited on the picture. Municipalities of the metro area have no page yet.
- `index.html` takes its absolute addresses (`og:url`, `og:image`, `twitter:image`) from `VITE_SITE_URL` too (`%VITE_SITE_URL%`),
  so a fork's home page shows its own picture, not the upstream domain's.
- ENV: `VITE_SITE_URL` (default `https://livability.time2map.com`) is printed on the pictures and used in the tags;
  the deploy workflow sets the `github.io` address on a fork.

**Not done / decisions for later**

- No "Save image" on an area: the app has no area card on the desktop (only the outline and the list). The area
  pictures exist as the static pages above; a "Share this area" action in the list can link to them.
- The link preview of a shared `c=` link (any custom place or settings) stays the generic site picture, as agreed (a preview by arbitrary settings needs scoring
  on a server).
- Nothing links to the barri pages yet except people who know the address; they are the material for the press
  stories (L5) and a sitemap.
- The card header contradiction ("Great match · 92" with "Meets 0 of 3") and the rounding at the limit are not
  fixed here (see open questions).

## Tests

- Pure builder `shareImageModel(state) → { place, score, band, profile, rows }`: unit tests for every band,
  every row status, a custom set, incomplete data, a place without a barri name.
- Canvas render: a smoke test that the PNG has the expected size (1080×1350) and is non-empty.
- Share button: `navigator.share` called with a file where supported, download otherwise.

## Definition of Done

Per `CLAUDE.md`. Manual: save an image on the card of a building and an area, on desktop and on a phone;
paste the site link into WhatsApp, Telegram and X and check the preview.


Follow-up: the area card with Save image / Share and the share link of a building are in `064-area-card-and-share-links.md`.

## Follow-up: 070 (2026-11-15)

The building picture carries the award lines ("This home is better than N% of homes in …") when the building stands
out. The 1080×1350 picture is stacked on white: brand line on top, the map in a rounded rectangle, the result below.
The 1200×630 preview is unchanged. See `070-building-rank-in-barri-and-city.md`.

## Follow-up: rank tiles (2026-11-16)

The award lines became tiles: the building picture shows the rank as the card's tiles, two side by side or one across the width ("Top 10%" over "of homes in l'Hospitalet de Llobregat"; first build "87%" over "… are a weaker match."), instead of two sentences "This home is better than N% of homes in …". The sentences repeated their start, wrapped badly in Spanish and Catalan, and "better" read as a verdict on the home to whoever got the picture. When the 1200×630 preview cannot hold everything, the condition rows go (last first, the risk row last), not the tiles. A long band name shrinks to fit the plaque.

The tiles are drawn as **award badges** (2026-11-16): a round medal with a star beside "Top 10%", the place under it, in a
rounded box. Gold for the narrowest tier (10), silver for a wider one (20), so the two read as different prizes. The card
keeps plain cream tiles and has the "area with a lot of good homes" note; the picture has neither the note nor the colours of
the card. `ShareRank` carries the `tier` for the colour.
