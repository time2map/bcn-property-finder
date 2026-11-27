# 029 — CTA: "Want a map like this?" (B2B contact)

**Status:** Implemented 2026-11-15. Narrowed to one thing: an invitation to commission a map, in the About dialog.

## Why

The launch goal is contacts of people who want a map made, not visits ([STRATEGY.md](../media/STRATEGY.md)). The
research in [VIRAL_CASES.md](../media/VIRAL_CASES.md) ("How the companies put themselves next to the free product")
shows the pattern: the free product stays quiet, and the invitation sits in an About section and on a separate page,
in soft words ("Let's Talk", "Project Inquiries").

## Decisions (owner, 2026-11-15)

- The CTA leads to time2map's own page, not to a form inside the app (the site is static; no server to receive it).
- The only place is the About dialog. No pitch inside the map, the card or the menu.
- No "Get updates" email subscription: dropped from this feature (needs a mailing service and a privacy-text change;
  can come back as its own feature).

## As built

- About dialog: after "Made by time2map", a line "time2map builds maps and geodata projects to order. Want a map like
  this for your city or your company?" and a "Let's talk" button (`about.cta.*` in en, es, ca).
- `services/ctaLink.ts`: `buildCtaUrl(medium)` adds `utm_source` and `utm_medium` to the target address, so the
  company site's analytics can count requests by place. Mediums: `about` (the button), `about-credit` (the name in
  "Made by time2map").
- ENV: `VITE_CTA_URL` (default `https://time2map.com`; set to the case-study page once it exists) and
  `VITE_CTA_UTM_SOURCE` (`livability`), in `.env.production`, `.env.test`, `.env.local.example`.
- Fixed on the way: the "time2map" link in "Made by time2map" was empty (the tag `<link>` in the translation is a
  void HTML element, so the parser dropped its content); the tag is now `<brand>`.

## Not in this feature (still open in the launch checklist, [LAUNCH_PLAN.md](../media/LAUNCH_PLAN.md))

Credit on the share images, the case-study page, the "I want my city" button with a company tick box, counting
requests in the app's own analytics (needs A2).
