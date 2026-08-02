# TODO-034 — OG tags, social sharing, default map state

## Status — DONE (MS1), shipped

Implemented in `frontend/index.html` (+ store default), commit "branding & basic redesign".

- [x] `<title>`: "Barcelona livability map — compare neighbourhoods by price, core access, noise
      and walkability". `og:title` / `twitter:title`: "Barcelona livability map";
      `og:site_name`: "time2map livability".
- [x] `<meta description>` (+ og/twitter): "Compare Barcelona neighbourhoods by price, city-core
      access, noise and walkability — an interactive map for deciding where to live."
- [x] OG + Twitter tags: `og:type=website`, `og:site_name/title/description/url/image` (+
      `image:type/width/height`), `twitter:card=summary_large_image` + title/description/image.
- [x] `theme-color`.
- [x] OG image: `frontend/public/og-image.jpg`, 1200×630, ~306 KB (compressed from Alex's
      2400×1260 screenshot; source removed to keep the deploy lean).
- [x] Default map state: Livability ON, Noise OFF (see 035).

### Remaining (follow-ups, not blocking)

- `og:url` / `og:image` / `twitter:image` are absolute URLs on the current GitHub Pages address.
  **Switch to `https://livability.time2map.com/…` when the custom domain is wired** (domain task).
- Per-barri OG images — deferred to TODO-027 (Wave 2 SEO), a big SEO multiplier.
- Optional "typical expat workplace" default — parked (isochrone off in public); revisit later.

## Idea

Add proper Open Graph and Twitter Card meta tags so sharing the URL on social media or Slack shows a rich preview with image + description.

## Default map state

The map currently shows the composite layer but with no workplace set. Since the livability index (noise + walkability) is workplace-independent, the default state is already meaningful — no changes needed to the data layer.

Open question: should the default map state show Barcelona with a "typical expat workplace" pre-set (e.g. Poblenou tech hub) to make the first experience more compelling? This would affect OG image too.

## OG image

- A pre-rendered screenshot of Barcelona with the composite overlay active — striking, distinctive.
- Static image (simpler) or dynamic per-barri image (more SEO value, harder to generate).
- Tool: Playwright headless screenshot, or manually designed image in Figma.

## Notes

- `<title>` and `<meta description>` also needed, currently probably empty or default Vite.
- Per-barri OG images (TODO-027) would be a significant SEO multiplier but can come later.
