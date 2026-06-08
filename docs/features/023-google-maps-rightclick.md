# Feature 023 — Right-click → Google Maps satellite view

## Goal

Right-click anywhere on the map opens a small popup with a link that jumps directly to
Google Maps in satellite + perspective view (tilted, ~45°) centred on the clicked point.

Useful for ground-level orientation: quickly checking street character, building density,
green space, and proximity to landmarks before deciding whether to investigate a neighbourhood.

## URL format

```
https://www.google.com/maps/@{lat},{lng},{alt}a,{fov}y,0h,{tilt}t/
```

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `{lat},{lng}` | click coords | Centre of the view |
| `{alt}a` | 686 | Camera altitude in metres (neighbourhood scale) |
| `{fov}y` | 35 | Field of view in degrees |
| `0h` | 0 | Heading — north-up |
| `{tilt}t` | 48.8 | Tilt from vertical (0 = top-down, 90 = horizon) |

Parameters sourced from the example URL provided by the user; altitude / tilt produce a
comfortable 45° perspective view at roughly one city block of context.

## UX

- Right-click anywhere on map canvas → MapLibre Popup appears at the clicked coordinate.
- Popup contains one action: **"Open in Google Maps"** (opens `_blank`).
- Popup closes on map click, pan, or the built-in × button.
- Native browser context menu is suppressed on the map canvas.

## Implementation

```
components/Map/
  MapContextMenu.tsx     — registers contextmenu handler; renders MapLibre Popup
  MapContextMenu.test.tsx
```

`buildGoogleMapsUrl(lat, lng)` is exported for unit testing.

`MapContextMenu` is mounted inside `Map.tsx` alongside other null-rendering layer components.

## Definition of Done

- [x] Right-click on map opens popup with Google Maps link.
- [x] URL opens satellite + tilted view at clicked coordinate.
- [x] Native browser context menu suppressed on map canvas.
- [x] Unit test for URL builder function.
- [x] `npm test` — all green.
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
