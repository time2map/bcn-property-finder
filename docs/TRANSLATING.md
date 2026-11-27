# Translating the app

All texts live in `frontend/src/locales/<language>/<namespace>.json`. English (`en`) is the source and the
fallback: a key that is missing in another language shows the English text. Code never contains a sentence, only
keys (`t('brand.share')`).

## Add or improve a language

1. Copy `frontend/src/locales/en/` to `frontend/src/locales/<code>/` (two-letter code: `fr`, `de`, …).
2. Translate the **values**. Never change keys.
3. Add the code to `VITE_ENABLED_LANGS` in `frontend/.env.production` (and `.env.test`, `.env.local.example`). The
   language then appears in the menu by its own name (`languageName()` in `src/i18n/languages.ts`; add the name
   there if `Intl` writes it badly).
4. Run `cd frontend && npm test`. `src/i18n/locales.test.ts` fails with the exact missing or extra keys and
   with placeholders that do not match English.

## Rules

- Keep `{{placeholders}}` and `<tags>` exactly as they are: `Made by <link>time2map</link>`. Only move them.
- Plurals: `key_one`, `key_other` (CLDR categories; a language adds `_few`, `_many`, `_zero`, `_two` where its
  grammar needs them).
- Numbers, percentages and dates are formatted in code with `Intl` in the page language; do not write them into texts.
- Do **not** translate: barri and municipality names, street names, brand names (time2map, Idealista, Catastro).
- Glossary: *barri* stays *barri* in English, *barri* in Catalan, *barrio* in Spanish. *Match* = how well a home fits
  the visitor's conditions. *Livability* = habitability (ES *habitabilidad*, CA *habitabilitat*).
- Tone: plain, second person, no jargon. Short strings stay short: buttons and chips have little room.
- Context for a string is in the key path (`card.meets` = card of a building) and, where needed, in a `_note`
  sibling key that is not shown to visitors.

## Status

| Language | Files | State |
|---|---|---|
| `en` | complete (source) | source |
| `es` | same keys as English | machine draft, needs a native read-through |
| `ca` | same keys as English | machine draft, needs a native read-through |

Namespaces: `common` (brand bar, About, share), `conditions` (condition names, profiles, match texts, services,
places, eras), `editor` (onboarding and the sentence editor), `card` (building and area cards, areas list),
`panel` (settings panel, search, phone, tooltips), `info` (layer legends and info modals). The 73 barri descriptions are in `areas.json` of each
language (not an i18next namespace: loaded when an area card needs them; `areaDescriptions.test.ts` checks every
language has all 73).

## Tools for a team of translators

The JSON files are the standard i18next format: Weblate, Crowdin, Lokalise and Tolgee read them directly and sync
through git, so translators never need the code.
