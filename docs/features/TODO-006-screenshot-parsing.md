# 006 · Screenshot parsing (Idealista → pin)

## Goal

Allow the user to drop an Idealista listing screenshot onto the map. The app parses it with Claude Vision, extracts structured data (price, area, address hint), places a pin at the best-guess location, and pre-fills the edit drawer fields.

## Status

Not implemented. Depends on [005-property-pins](TODO-005-property-pins.md) being done.

## Motivation

The current flow (005) requires manually clicking a location on the map. This feature shortens it to: drag screenshot from browser → pin appears with fields filled.

## Scope

### Drop target

The map area accepts `dragover` / `drop` events for image files (`image/*`).

A visual hint ("Drop screenshot here") is shown on `dragover`.

### Parsing: Claude Vision API

On drop:
1. Read the file as base64.
2. Send to Claude API (claude-haiku-4-5 for cost efficiency) with a structured extraction prompt:
   - Price (EUR)
   - Area (m²)
   - Address or neighborhood string (best effort — Idealista often omits house number)
   - A boolean `addressIsApproximate`
3. Parse the JSON response.

The request is a `messages` call with `image` content block (base64 + media type).

Prompt instructs the model to return JSON only:
```json
{
  "price": 320000,
  "area": 75,
  "address": "Carrer d'Aragó, Eixample, Barcelona",
  "addressIsApproximate": true
}
```

API key comes from env var `VITE_ANTHROPIC_API_KEY`. Note: this exposes the key to the browser — acceptable for a personal/local tool, not for public deployment.

### Geocoding

If `address` is returned:
- Call a geocoding API (e.g. Photon / OpenStreetMap Nominatim) with `address + ", Barcelona"`.
- Place the pin at the returned coordinates.
- If geocoding fails or returns low confidence → place pin at map center.
- Show a dismissable banner: "Address is approximate — drag the pin to correct location."

If no address → place pin at map center with the same banner.

### Edit drawer

Opens immediately after pin placement with pre-filled fields. The screenshot is automatically added as the first photo.

### Error handling

- Parsing fails (API error, malformed JSON) → show toast "Could not read screenshot — pin placed at map center".
- Network error → same fallback.

## Key risks

- **Idealista hides exact addresses**: listings show street + neighborhood, not house number. Geocoding will have 100–500m error. The drag-to-reposition UX (from 005) mitigates this.
- **Browser API key exposure**: acceptable for a single-user local app. Document in README.
- **localStorage photo quota**: each dropped screenshot is stored as base64. Large files should be compressed before storage (target ≤ 200KB).

## Out of scope

- Parsing screenshots from other portals (Fotocasa, Habitaclia)
- Real-time screen capture / tab integration
- Backend proxy for the Anthropic API key

## Done when

1. Dropping an image file on the map triggers Vision parsing.
2. Price, area, and address fields are pre-filled in the edit drawer.
3. The screenshot appears as the first photo.
4. Pin is placed at geocoded coordinates (or map center on failure).
5. "Address is approximate" banner shown when relevant.
6. Unit tests cover: JSON extraction from mock Vision response, geocoding fallback.
7. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
