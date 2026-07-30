# TODO-035 — Branding & basic redesign (MS1)

Make the app read as a finished product, aligned with the time2map "glass" style used on
catalunya-crimes.time2map.com — but keeping white/light panels.

## Decisions (agreed)

- **Name / wordmark:** **time2map livability**. Domain: `live.time2map.com`.
- **Brand bar:** top-left glass mini-panel, separated from the layers panel — mirrors the crime
  map's `.app-brand`. Content: **time2map logo (SVG) + text**. Logo reused from the crime-map repo
  (`public/time2map-logo.svg`); it's white-on-dark, so a dark-on-light variant
  (`public/time2map-logo-dark.svg`, wordmark recoloured to `#1f2937`, coral mark kept) is used on
  the white panel. Links to time2map.com.
- **Font:** IBM Plex Sans, self-hosted via `@fontsource/ibm-plex-sans` (weights 400/500/600/700),
  fallback `system-ui, sans-serif`. Applied via Mantine theme + body.
- **Glass panels:** white translucent (`rgba(255,255,255,~0.82)`) + `backdrop-filter: blur(16px)`,
  rounded, thin border + soft shadow. White stays. Layers panel restyled to match.
- **Icons:** add `@tabler/icons-react`; replace emoji/default icons (`⚙`, `ⓘ`, `ℹ`, mobile `⚙`)
  with clean SVG icons.
- **Depth:** basic redesign incl. panel internals (toggles/checkboxes/legend spacing) — not a full
  rebuild. Score ramp (red→green) unchanged.

## Favicon

From `public/favicon.png` (1254×1254) via `sips`: `favicon-32.png`, `favicon-16.png`,
`apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`. Declared in `index.html`
(PNG `rel=icon` + apple-touch-icon) — removes the `/favicon.ico` 404. (No `.ico`: sips can't emit
it; modern browsers use the PNG links.)

## Default map state

Fresh visitor: **Livability ON, Noise OFF**. (store: `compositeVisible` default `true`,
`noiseLayerVisible` default `false`.)

## Meta / OG — see TODO-034

`<title>`, `<meta description>`, OG + Twitter (`summary_large_image`), `theme-color`.

## Out of scope (Wave 2)

Deep layout rework, legend rework, dynamic score scale, ES i18n.
