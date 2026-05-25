# 006 · Screenshot parsing (Idealista → pin)

## Goal

Allow the user to drop an Idealista listing screenshot onto the map. The app parses it with a local vision model (Ollama), extracts structured data (price, area, address hint), places a pin at the best-guess location, and pre-fills the comparison table fields.

## Status

Implemented.

## Motivation

The flow from feature 005 requires manually clicking a map location. This feature shortens it to: drag screenshot from browser → pin appears with fields filled.

## Implementation

### Vision provider: Anthropic Claude Haiku

Uses `claude-haiku-4-5` via `@anthropic-ai/sdk`. Fast (~1-2s) and cheap (~$0.002/call).
API key set via `VITE_ANTHROPIC_API_KEY` — acceptable for a personal/local tool.

API call: `messages.create` with `image` content block (base64 + media type).

### Drop target

`ScreenshotDropZone` wraps the map in `App.tsx`. Accepts `dragover` / `drop` for `image/*` files.
Visual overlay ("Drop screenshot here") shown on dragover. Spinner shown during parsing.

### Parsed output

```json
{
  "price": 320000,
  "area": 75,
  "address": "Carrer d'Aragó, Eixample, Barcelona",
  "addressIsApproximate": true
}
```

### Geocoding

Nominatim (OpenStreetMap) — no API key required.
`GET https://nominatim.openstreetmap.org/search?q={address}, Barcelona&format=json&limit=1`

- Success → pin moved to geocoded coordinates
- Failure / no address → pin stays at map center
- `addressIsApproximate: true` or geocoding failed → yellow dismissable banner shown

### Screenshot as photo

Compressed (≤200KB, max 800px) via `compressImage` and attached as the first photo of the pin.

### Error handling

Any parsing / network error → toast "Could not read screenshot — pin placed at map center".

## Env vars

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_ANTHROPIC_MODEL=claude-haiku-4-5
```

## Key files

- `src/services/vision/anthropicProvider.ts` — Claude Haiku API call + JSON parsing
- `src/services/vision/visionService.ts` — entry point: `parseScreenshot()`
- `src/services/geocoding.ts` — Nominatim geocoding
- `src/services/imageUtils.ts` — `compressImage`, `fileToBase64`
- `src/hooks/useScreenshotDrop.ts` — orchestration hook
- `src/components/PropertyPins/ScreenshotDropZone.tsx` — drop UI

## Key risks

- **Idealista hides exact addresses**: geocoding has 100–500m error. Drag-to-reposition (feature 005) mitigates this.
- **Browser API key exposure**: acceptable for a single-user local app. Not for public deployment.

## Out of scope

- Parsing screenshots from other portals (Fotocasa, Habitaclia)
- Backend proxy for the API key

## Done when

1. Dropping an image file on the map triggers vision parsing. ✓
2. Price, area fields are pre-filled in the comparison table. ✓
3. The screenshot appears as the first photo. ✓
4. Pin is placed at geocoded coordinates (or map center on failure). ✓
5. "Address is approximate" banner shown when relevant. ✓
6. Unit tests cover: JSON extraction, geocoding fallback, hook orchestration. ✓
7. `npm test`, `npm run lint`, `npm run typecheck` — all pass. ✓
