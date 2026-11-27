# 053 — Shareable state: conditions in the URL

**Status:** Implemented 2026-11-12, checked in the browser (sender, then the link in a private window). Enables
profile links (031), editorial links (SEO) and "send this to my partner". See "As built" at the end.

## Problem

`useUrlState` writes only `minutes`, `zoom`, `cx`, `cy`. Every setting that defines the map (which conditions
are on, the limits, services, places, eras, risk strengths, contrast boost) lives in localStorage. A link to
the map shows the recipient *their* settings, not the sender's. Presets and SEO pages cannot link to a
configured map.

## Decision

- One compact query parameter `c=` carries the whole configuration; absent = the stored / default settings.
- When `c=` is present at load, it wins over localStorage and is then stored (so the recipient keeps it).
- The URL updates on every settings change (debounced, `replaceState`), like the view parameters today.
- A "Share" button copies the URL (and uses the Web Share API on mobile).

## Spec

Encoding (`services/urlConfig.ts`): a short key-value string, URL-safe, human-readable enough to be hand
edited in editorial links:

```
c=on:noise,poi,core,price;n:58;w:10;cc:30;p:3500;l:7.5;svc:supermarket,pharmacy,park;lm:sagrada,placa_cat;
  era:1900-1939,1940-1979;r:5,5,0;cb:1
```

- `on`: conditions that are on (short ids: noise, poi, core, price, locals, age).
- `n`, `w`, `cc`, `p`, `l`: limits. Omitted = default.
- `svc`, `lm`, `era`: lists. Omitted = all.
- `r`: flood, fire, street strengths. `cb`: contrast boost (050). `preset:<id>` (031) expands to its values
  and may be combined with overrides.
- Unknown keys and invalid values are ignored per key (same policy as `loadConditions`).

## Implementation

- `services/urlConfig.ts` (pure): `encodeConfig(state) → string`, `decodeConfig(string) → Partial<Settings>`,
  `applyConfig(store, partial)`.
- `store/index.ts`: at creation, `decodeConfig(params.get('c'))` overrides the loaded values; store writes
  the resulting values to localStorage as today.
- `hooks/useUrlState.ts`: add `c` (debounced 300 ms); keep `minutes`, `zoom`, `cx`, `cy`.
- `components/BrandBar` or the panel header: "Share" `ActionIcon` → clipboard / `navigator.share`.
- `services/presets.ts` (031): `preset:` token.

## Tests

- `urlConfig.test.ts`: round trip for defaults, for every preset, for a custom set; unknown keys ignored;
  invalid values fall back per key; `preset:` + override.
- `store/index.test.ts`: `c=` wins over localStorage at load and is persisted.
- `useUrlState.test.ts`: `c` appears after a settings change; view params unchanged.
- `Share` button test: clipboard called with the current URL.

## Definition of Done

Per `CLAUDE.md`. Manual: open a shared link in a private window → same map; change a limit → URL changes.

## Open questions

- Should the share link also pin the map view? Proposed: yes, the four view params are already there.

## As built (2026-11-12)

- **`c` is a complete configuration.** What a link leaves out is the default, not what the recipient saved earlier;
  otherwise two people would see different maps from the same link. `c=default` means "all defaults".
- Format as in the spec, with these additions: `on` also lists `risk` (its place in the priority order); `fa` is the
  size of the flat of the budget word (031); a profile link is `c=preset:family`, optionally with overrides
  (`c=preset:family;n:55`). Numbers outside a sane range, unknown ids and unknown keys are ignored key by key; a list
  with no valid id is the default (all).
- **Reading** (`services/urlConfig.ts`, pure, `decodeConfig(raw, defaults)`) happens once, when the store is created
  (`readUrlSettings` in `store/index.ts`); the result is saved to localStorage so the recipient keeps it, and a link
  never opens the onboarding. **Writing** (`useUrlState`): the view parameters at once, `c` 300 ms after the last
  change, and only when it differs from the defaults (so a plain visit has a plain address). A profile link is
  rewritten as the expanded configuration.
- The separators `: ; ,` are written as they are, not percent-encoded, so a link can be read and edited by hand
  (`withConfig`, `shareUrl`).
- **Share** is a button in the brand bar. It builds the link from the settings as they are now (the address follows
  after a pause) with `c=default` when everything is default; on a phone (≤ 768 px) with `navigator.share` it opens
  the share sheet, otherwise it copies the link and says "Link copied. It opens your map with your conditions."
  (a closed share sheet is silent; a refused copy says to copy the address bar). The map view is part of the link.
- Not done: the map layer, "Show match colours" and the best areas are not in `c`.

