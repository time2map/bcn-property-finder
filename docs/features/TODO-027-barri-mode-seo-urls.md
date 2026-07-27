# TODO-027 — Barri mode + SEO-friendly URLs

## Idea

Add a second display mode alongside hex: **Zones (barri)** — aggregate hex scores per neighbourhood and colour the barri polygon. Each barri gets a human-readable URL (`/barri/gracia`, `/barri/eixample`) so Google can crawl and index them.

Two-mode toggle at the top of the map (e.g. "Zones / Grid"). Barri cards cross-link to adjacent neighbourhoods to improve internal linking depth.

## Why

- SEO: crawlable URLs + internal links are the foundation of programmatic SEO strategy.
- UX: barri names are familiar to users; raw hex cells are abstract.
- Barri mode is the natural landing page for SEO traffic; hex mode is the power-user view.

## Notes

- Barri polygon data already partially available (feature 020).
- Score aggregation: median or weighted average of contained hex scores.
- URL routing needs to work in the SPA (React Router or hash-based) and in the Astro static layer.
- Consider a detail card per barri with top-3 strengths, score breakdown, link to adjacent barris.
