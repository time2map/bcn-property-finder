# TODO-034 — OG tags, social sharing, default map state

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
