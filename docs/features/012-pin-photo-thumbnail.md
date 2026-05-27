# Feature 012 — Property photo thumbnail on map pin

## Goal

Show the first photo attached to a pin as a small thumbnail above the map pin marker, so the user can visually identify listings directly on the map without opening the comparison table.

## Data model contract

`photos[0]` is the canonical thumbnail source for the map pin, regardless of how it was added:
- **Screenshot drop** → compressed screenshot stored as `photos[0]`
- **Manual photo upload** (via PinCompareTable) → user's first uploaded photo → already `photos[0]`

The map pin always reads `photos[0]`. No special-casing per source.

## Approach

### Thumbnail displayed above the pin marker

When a pin has `photos[0]`, render a small rounded image (64×48 px) attached above the existing 28 px rank circle:

```
┌──────────────┐
│  [apt photo] │  ← 64×48px, rounded corners
└──────┬───────┘
       ①         ← existing 28px circle with rank
```

Pins without a photo keep the current appearance (no regression).

The MapLibre marker anchor offset (`[0, -25]`) is adjusted so the rank circle center stays at the property's geographic coordinates when a thumbnail is present.

## Files changed

| File | Change |
|------|--------|
| `frontend/src/components/PropertyPins/PinLayer.tsx` | `renderMarkerContent` builds composite marker with optional thumbnail; offset adjusted per photo presence |
| `frontend/src/index.css` | `.pin-marker`, `.pin-marker__thumb` styles |

## Definition of Done

- [x] Drop an Idealista screenshot → thumbnail (compressed screenshot) appears above the pin on the map
- [x] Manually uploaded photo appears as thumbnail when it is `photos[0]`
- [x] Pins without photos look identical to current behavior
- [x] `npm test` — all green
- [x] `npm run lint` — no errors
- [x] `npm run typecheck` — no errors
- [x] Manually verified in `npm run dev`
