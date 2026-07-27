# TODO-028 — Internationalisation (EN / ES)

## Idea

Add language switcher (EN / ES as minimum). All UI strings extracted to translation files. Spanish is the priority second language — largest SEO audience for Barcelona content.

## Notes

- SPA: use i18next or similar; language stored in URL prefix (`/es/`, `/en/`) for SEO benefit.
- Static Astro pages (SEO layer): separate EN and ES versions from the start.
- Do not translate data labels (barri names, category names) — they stay in local language.
- French and German are lower priority (smaller expat segment).
