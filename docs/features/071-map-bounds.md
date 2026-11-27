# 071 — Map bounds

The map could be scrolled and zoomed out over the whole world. Now the **centre** of the map is kept inside the area
the data covers, so the edge of the zone can be put in the middle of the screen, but the world cannot be scrolled.

## Behaviour
- MapLibre `transformConstrain` clamps the centre to `VITE_MAP_BOUNDS` (`west,south,east,north`). The bounds limit the
  centre, not the viewport: at the edge, half of the screen shows empty map.
- `VITE_MAP_MIN_ZOOM` limits how far the map zooms out (default 8). A custom `transformConstrain` replaces MapLibre's own
  one, which is what enforced `minZoom`, so `constrainToBounds` clamps the zoom (min … 22) itself.
- Defaults (no env): `1.88,41.25,2.31,41.59` = the building data (lng 1.89–2.29, lat 41.26–41.57) plus a small margin.
  A missing or broken value falls back to the default.

## Code
`frontend/src/components/Map/mapBounds.ts` (`clampCenter`, `constrainToBounds`, `parseBounds`), wired in `Map.tsx`.
Tests: `mapBounds.test.ts`.

## Verified (2026-11-15, Playwright, isolated context, dev server)
- Dragging far east / west / north / south stops at the box: cx 2.31 / 1.88, cy 41.59 / 41.25.
- Wheel zoom-out stops at zoom 8 (it went to -0.35 before the zoom clamp was added).
- A link with a far centre (`cx=10&cy=50`) is pulled to the nearest edge on the first move.
