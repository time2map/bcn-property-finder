# 035 — Branding & basic redesign (MS1)

App branded as "time2map livability" with a light "glass" redesign aligned with the time2map
style. Shipped in commit "branding & basic redesign".

## Status — DONE (MS1), shipped

- [x] Page name / `<h1>`: **Barcelona livability map**. time2map is the agency (icon attribution).
      Domain target: `livability.time2map.com`.
- [x] BrandBar (`src/components/BrandBar/`): top-left glass mini-panel, separated from the layers
      panel. Content: time2map **agency mark** (coral, `public/time2map-mark.svg`, links to
      time2map.com) + the page `<h1>` "Barcelona livability map". IBM Plex Sans.
- [x] Font: IBM Plex Sans self-hosted via `@fontsource/ibm-plex-sans` (400/500/600/700), applied
      through the Mantine theme + body.
- [x] Glass panels: translucent white (`rgba(255,255,255,0.82)`) + `backdrop-filter: blur(16px)`,
      rounded, thin border + soft shadow (`.glass-panel`, `.app-brand`, `.top-panel`). White stays.
- [x] Brand colour: Mantine `primaryColor` = time2map coral `#F06965` → checkboxes, switches and
      weight sliders are coral (were blue / green).
- [x] Icons: `@tabler/icons-react` replaces emoji (`⚙` gear, `ⓘ`/`ℹ` info, mobile toggle).
- [x] Favicon: `public/time2map-mark.svg` (solid coral mark, centred via viewBox) as primary +
      transparent PNG fallbacks generated from `favicon.png` with its **black background stripped**
      (one-off Node/pngjs script). apple-touch-icon included. Removes the `/favicon.ico` 404.
- [x] Meta: `<title>`, `<meta description>`, OG / Twitter, `theme-color` (see 034).
- [x] Default map state: Livability ON, Noise OFF.
- [x] DoD: 502 tests green, lint / typecheck / build clean; coverage gate re-tuned (MapLibre /
      browser-integration files excluded like PinLayer; branches threshold 70%, rest 80%).

## Notes / decisions

- Brand-mark iterations: logotype+text → hexagon PNG → settled on the **agency mark (coral pin)**
  as a solid, centred SVG (bold, not pale; crisp at any size), reused for BrandBar and favicon.
- Empty-state / onboarding intentionally NOT added — map + barri mode should read on their own.

## Out of scope — Wave 2

Deep layout rework, legend rework + dynamic/percentile score scale, mobile layout deep-dive,
ES i18n. Custom domain (`livability.time2map.com`) tracked in `docs/MS1-Plan.md`.
