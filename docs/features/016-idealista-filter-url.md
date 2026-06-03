# Feature 016 — Idealista saved filter URL

## Goal

Let the user paste an Idealista search URL (with their personal filters already set) so that
every generated zone link re-uses those filters — only the `shape=` parameter is replaced with
the computed polygon for each zone.

## Problem

Currently `buildIdealistaUrl` always generates links with the fixed base path
`/areas/venta-viviendas/mapa-google?shape=…`. The user typically opens this link, sets price,
size, bedroom count, condition, etc., and bookmarks the resulting URL. But next time they
recompute zones, the new links lose all those filters and point back to the bare search.

## User story

> As a property hunter, I open Idealista, set my filters (price cap, min area, bedroom count,
> property condition…), then paste the resulting URL into the app. From that point on, every
> zone link applies my filters automatically — I only click, not re-type filters each time.

---

## Behaviour

### Input

A text input in the ExportButton area, visible when an isochrone exists:
- Placeholder: `Paste Idealista URL with your filters…`
- On paste / blur: validate that the input looks like an Idealista URL; if valid, save it.
- A small status line confirms: `Filters saved` (or `Invalid URL` in red).
- The field is pre-filled from the saved value on load.
- A clear (×) button resets to the default template.

### URL processing

On save:
1. Parse the pasted URL with the browser `URL` constructor.
2. Remove the `shape` query parameter (it will be replaced per zone).
3. Store the remaining URL string: path + all other query params.

On link generation (`buildIdealistaUrl`):
- If a base URL is saved: append `?shape=…` (or `&shape=…` if other query params remain).
- If no base URL: fall back to the existing default template.

### Persistence

`idealistaBaseUrl: string | null` stored in Zustand + `localStorage` key
`bcn_idealista_base_url` — same pattern as exclusion zones store.

### Zone link update

When the base URL changes and zones are already computed, all displayed links update
immediately (they are derived from the store, so a re-render suffices — no recomputation).

---

## Example

Pasted URL:
```
https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000,metros-cuadrados-mas-de_60,de-dos-dormitorios/?shape=((old_shape))
```

Saved base:
```
https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000,metros-cuadrados-mas-de_60,de-dos-dormitorios/
```

Generated link for zone 1:
```
https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000,metros-cuadrados-mas-de_60,de-dos-dormitorios/?shape=((new_encoded_shape))
```

---

## Architecture

### New / modified files

```
frontend/src/
  store/idealistaBaseUrlStore.ts   — zustand slice; persists to localStorage
  services/idealista.ts            — buildIdealistaUrl(polygon, baseUrl?) uses baseUrl when set
  components/ExportButton/
    ExportButton.tsx               — add BaseUrlInput below the area links
    BaseUrlInput.tsx               — controlled text input + validation + clear button
    BaseUrlInput.test.tsx          — unit tests for input, validation, clear
  ExportButton.test.tsx            — update: assert links use saved base URL
```

### `buildIdealistaUrl` signature change

```typescript
export function buildIdealistaUrl(polygon: Polygon | MultiPolygon, baseUrl?: string): string
```

- `baseUrl` is the stored string (path only, `shape` already stripped).
- Appends `?shape=…` or `&shape=…` depending on whether `baseUrl` already contains `?`.
- No `baseUrl` → existing default behaviour unchanged.

---

## Validation rules

A URL is accepted if:
- It parses successfully via `new URL(...)`.
- Hostname contains `idealista.com`.
- Path contains `venta-viviendas` or `alquiler-viviendas` (property search pages).

Anything else: show `Invalid URL` and do not save.

---

## Definition of Done

- [x] Unit tests: `buildIdealistaUrl` with/without baseUrl; `parseIdealistaBaseUrl` (valid/invalid,
      strips shape, preserves other params); `idealistaBaseUrlStore` (set, clear, persist);
      `BaseUrlInput` (save, clear, invalid, pre-fill, Enter key); `ExportButton` links use base URL.
- [x] `npm test` — all green (393 tests).
- [x] `npm run lint` — no errors.
- [x] `npm run typecheck` — no errors.
- [ ] Manual: paste URL with filters → recompute zones → links contain correct filters.
- [ ] Manual: clear saved URL → links revert to default template.
- [ ] Manual: reload page → saved URL restored from localStorage.
