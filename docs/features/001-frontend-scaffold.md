# 001 · Frontend scaffold

## Goal

Bootstrap the React app with MapLibre showing Barcelona. No business logic yet — just a working map that fills the viewport.

## Scope

- Vite + React + TypeScript project in `frontend/`
- MapLibre GL JS with OpenFreeMap vector tiles
- Map centered on Barcelona (`[2.1734, 41.3851]`, zoom 12)
- Zustand store stub with the full AppState shape
- `useUrlState` hook that syncs store ↔ URL params
- **Mantine** as UI framework — components (Button, Slider, SegmentedControl) + CSS variables for theming
- Mobile-first layout: on small screens the filter panel is a bottom drawer, on desktop a floating left panel

## AppState shape

```ts
interface AppState {
  workplace: [number, number] | null   // [lng, lat]
  mode: 'foot-walking' | 'cycling-regular' | 'driving-car'
  minutes: number                       // 15 | 20 | 30 | 45
  resultPolygon: GeoJSON.Polygon | null
}
```

Default: `{ workplace: null, mode: 'foot-walking', minutes: 30, resultPolygon: null }`

## URL param format

`?lng=2.17&lat=41.38&mode=foot-walking&minutes=30`

Workplace is only written to URL when set. `resultPolygon` is never serialized — recomputed on load if workplace is present.

## Layout (mobile-first)

- **Mobile** (`< 768px`): map fills full screen, filter panel slides up from the bottom as a drawer (Mantine `Drawer`), export button pinned to bottom-right
- **Desktop** (`≥ 768px`): floating card panel top-left over the map, export button bottom-right

## Dependencies

```
maplibre-gl zustand @mantine/core @mantine/hooks @mantine/dates
```

Dev: `@types/geojson`

## Done when

`npm run dev` opens a full-screen Barcelona map. URL params restore state on refresh.
