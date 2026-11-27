# Handoff: Building card (1b) + onboarding and settings panels

Repo: `sempo/bcn-livability` (branch `main`) · frontend: React + Mantine + Tabler icons + i18next + Zustand.

## Overview
A lighter redesign of three parts of the app:
1. **Building card** (desktop overlay card + phone bottom sheet): option **1b** "Ring" for the match header, plus the **details view** (turn 2: 2a desktop, 2b phone).
2. **Onboarding** (3a profiles, 3b build your own).
3. **Settings panel** (3c: conditions, match colours, map layers, best areas, advanced).

Goals: less text, scannable condition rows, clear hierarchy (score first), shorter details. **No facts are removed.** Copy is shortened only where noted below; everything else keeps the existing i18n keys.

## About the design files
`design/House Card.dc.html` is a **design reference built in HTML** — open it in a browser (keep `support.js` next to it). It is not production code. Recreate the designs inside the existing React/Mantine components, reusing current data hooks, store, i18n keys and helpers (`scoreColor`, `matchSummary`, `buildingRanks`, `countWithin`, etc.). Do not copy the HTML/inline styles over.

Ids on the canvas: `1b` (card header), `2a`/`2b` (details open), `3a`/`3b`/`3c` (panels). **1b is the chosen direction**; the other card options were removed from this file.

## Fidelity
**High-fidelity** for layout, hierarchy, spacing, type sizes and colours. Data values in the mock are samples. Where the mock and the real data rules disagree, the code's rules win (e.g. which sections show depends on enabled conditions).

---

## Design tokens
| Token | Value | Use |
|---|---|---|
| Font | IBM Plex Sans 400/500/600 (already the app font) | all text |
| Ink | `#1f2937` | text, selected states, switches on |
| Dim | `#6b7280` | secondary text, units, notes |
| Body-2 | `#4b5563` | profile blurbs |
| Hairline | `#eceef0` | row dividers |
| Field grey | `#f6f7f8` | number badges, chips in details |
| Button grey | `#f3f4f6` (hover `#e9ebee`) | Save / Share |
| Ring track | `#e9ecef` (big) / `#e3e6ea` (small) | |
| Rank tile bg | `#faf5ea` | rank percentage tiles |
| Warning bg | `#fbe6e3` | ground-floor flood warning |
| Brand coral | `#F06965` (hover `#ee5a56`) | primary CTA bg (ink text on it), slider fill, editable-word underline |
| Editable word tint | `#fdeceb` + inset bottom `2px #F06965` | tappable words in sentences |
| Score ramp | use existing `scoreColor()` / `BAND_COLOR` (mock: `#1a9850` great, `#91cf60` good, `#fee08b` partial, `#fc8d59`, `#d73027` poor) | rings, dots, match bar |
| Radius | card 12, sheet top 18, panels/tiles 10–12, buttons 8 (desktop) / 10 (phone), pills 999 | |
| Shadow | card `0 8px 28px rgba(0,0,0,.14)`; sheet `0 -4px 24px rgba(0,0,0,.14)` | |
| Spacing | card padding 18 (desktop) / 20 (phone); row gap 8 / 11 | |
| Phone scale | phone sizes ≈ desktop × 1.08; **every tap target ≥ 44px** | |

Links: ink colour + underline (offset 3px). **Not coral** (fails contrast at 12–13px).

---

## Screen 1 — Building card header (1b)
Files: `BuildingCard/MatchHeader.tsx`, `RankLines.tsx`, `BuildingCard.tsx`, `SaveImageButton.tsx`, `ShareLinkButton.tsx`.

Desktop card width stays 300–320px. Order top → bottom:
1. **Header row**: address (15/600, phone 16) + use line (12 dim, phone 13); close button 36×36 (phone 44×44). Keep `AddressTitle` "+N more addresses".
2. **Match block** (flex, gap 16, align center):
   - **Ring** 92px desktop / 104px phone: `conic-gradient(color 0 score%, #e9ecef 0)`, inner white disc 74/84px, score number 32/36px 600. Colour = `scoreColorForRange(score…)` as today. Incomplete data: show range `min–max` in the ring at smaller size + hatch track.
   - Right column: `match.label` "Match with your conditions" (11 dim) · band label e.g. "Great match" (21/23px 600) · `match.meets` "Meets 2 of 3 conditions" (13).
3. **Condition rows** (gap 8 / 11, 13 / 14px), one per enabled condition, in priority order:
   `[status icon 20px] [label 500, flex 1] [value][dim: " / limit" or extra]`
   - Status: met = filled green circle with white ✓; partial = half-filled amber circle (`conic-gradient(#b7791f 0 50%, #f1e2c6 0)`); failed = red circle with ✕.
   - Value text examples: `50 dB` + ` / 58` · `5 of 5` + ` in 10 min` · `€3,693` + ` / €3,571 per m² · +3%`.
   - Risk penalty (if any) as one extra row: `riskLine` text.
4. **Rank tiles** (from `buildingRanks`): **0, 1 or 2 tiles** depending on data.
   - 2 → grid 2 columns, gap 8. Tile: padding 10×12, radius 10, bg `#faf5ea`; big % 22px 600; sentence 11.5px.
   - 1 → single full-width tile, flex row: % (24px) left, sentence right (12.5px).
   - 0 → nothing (buttons move up). If `composite.hasGap` → show `rank.incomplete` as a dim line instead.
   - Copy (shortened): tied → "21% of homes in el Raval fit as well. Among the best."; better → "90% of homes in Barcelona are a weaker match." (new i18n keys; keep EN/CA/ES in sync).
5. **Save image / Share**: two equal buttons, gap 8, height 34 (phone 44), bg `#f3f4f6`, no border, 13/15px 500.
6. **"Details about this building"** toggle row: full width, border-top hairline, 12×18 padding (phone height 48), chevron right (closed) / down (open). Same store flag `cardDetailsOpen`.

Phone peek (sheet header, collapsed): small ring 52px + address + "Great match · Meets 2 of 3" + close 44×44.

## Screen 2 — Details open (2a desktop, 2b phone)
File: `BuildingCard.tsx` (the `detailsOpen` block), `cardParts.tsx`.

Everything in 1 stays above. Below the toggle:

**a. Photo + building strip** (padding 0 18 14):
- Facade photo, height 140 (phone 170), radius 10, `object-fit: cover`; credit 11px dim.
- 4-column strip (`justify-content: space-between`): value 16/600 over label 12 dim → `1 dwelling` · `2 floors` · `1850 Historic` · `103 m² built area`. Add `+ N below ground`, `renovated YYYY`, condition, other premises when present (wrap to a second line).
- Note 12 dim: uncertain-year note (if `UNCERTAIN_YEAR`), Catastro credit, then **"Open in Catastro ↗"** link (ink + underline; on phone its own line, min-height 44).

**b. Section rows** — one per section, separated by hairlines. Row = `min-height 52 (phone 56)`, padding 8×18, flex gap 12:
`[small ring 36px: section score, colour via scoreColor] [title 13/600 + one-line verdict 12.5] [chevron]`
Tap the row to open its body (indented 66px = ring + gap). Each section keeps its own open state; **Noise and Climate risk open by default**.

| Section (show rule = today's) | Verdict line | Body |
|---|---|---|
| Walkability | `countWithin(...)` "5 of 5 services within 10 min" | 2-col list `Service · N min` (no emoji, no per-service bars); `ui.walkNote` |
| Noise | `noiseVsLimit` "50 dB · within your 58 dB" | Row 1: `50 dB` (20px 600, no wrap) + `NoiseLabel` pill (right). Row 2: "typical window · night 42". Noise bar 6px: bands green < 53, yellow 53–55, orange 55–65, red ≥ 65 on a 40–75 dB scale, ink marker at the value; `noise.who` line. Then key-value list: street side, courtyard side, loudest / quietest. Then **"Facade by facade"** sub-toggle (min-height 44 on phone) → facade groups + 2017 map + leisure. Notes: `noise.modelled`, SICA note, source. |
| City Core Access | `countWithin(..., 'places')` | key-value list landmark · minutes |
| Building age | `ui.ageLine` | no body (row not tappable); renovated note if present |
| Climate risk | "−3 pts · street flooding" (sum of penalties + names); lead = amber circle with the points instead of a ring | warning box (bg `#fbe6e3`, 12.5px 500) if `groundFloorWarning`; then 3 risk rows: coloured dot · label 13/500 · penalty right (12 dim) · text below 12.5 |
| — Barri-level header — | plain row: "Barri-level · the same for every building in the barri" (12 dim) + area name right (13/600) | |
| Sale price | `priceVsBudget` | average + your limit; source line |
| What locals say | `ratingVsMin` | satisfaction, would stay, trend (key-value), "Main problems" chips (bg `#f6f7f8`, pill), survey source |

Key-value lists: grid `1fr auto`, gap 6×12, label regular / value 600 right-aligned, 13px.

## Screen 3a — Onboarding: profiles
File: `Onboarding/OnboardingPanel.tsx`, `PresetCards.tsx`, `index.css` (`.onboarding-panel`, `.preset-card`).
- Panel width 360 (desktop), padding 18; phone = bottom sheet, padding 20.
- Title `onboarding.title` 20/600, `text-wrap: balance`. Sub `onboarding.sub` 13/1.45.
- **Profiles as one bordered list** (border 1px hairline, radius 12, overflow hidden), rows separated by hairlines: name 14/600 + blurb 12.5 `#4b5563`, chevron right. Row min-height 54 (phone 60), hover bg `#f6f7f8`. **No icons or images.**
- "or" divider (hairlines either side, 12 dim).
- "Build your own": full-width outline button, height 40 (phone 44), border `#d9dce1`, radius 10.
- "Just show me the map": text button, underlined, height 36 (phone 44).

## Screen 3b — Build your own
Files: `OnboardingPanel.tsx` (build screen), `Conditions/ConditionsEditor.tsx`, `SentenceRow.tsx`, `AddConditionChips.tsx`, `MatchBar.tsx`.
- "‹ Back" text button (height 36 / 44). Heading `onboarding.heading` 20/600. `onboarding.tapHint` 13.
- **Condition row** (border-top hairline, padding 10 0, grid `22px 1fr 36px` / phone `22px 1fr 44px`, gap 10):
  - Priority badge 22px circle bg `#f6f7f8`, 12/600.
  - **New:** short name above the sentence (`conditions:short.*`, 12 dim) — e.g. "Quiet", "On foot", "Budget".
  - Sentence 14px / line-height 1.8 (phone 15px / 1.95). Editable words: padding 3×6, radius 5, bg `#fdeceb`, `box-shadow: inset 0 -2px #F06965`, 600, nowrap.
  - Remove "×" button 36 / 44 square, dim.
  - Phone: make the **whole row** open the first word's picker too (inline words are < 44px).
- **Add chips**: dashed border `#c3c8d0`, pill, height 30 (phone 44), "+ Close to the centre"…
- **Match bar**: caption "Homes by match" 12 dim; 8px bar of 4 segments (gap 2, rounded ends) in band colours; legend grid 4 columns `**12%** Great`.
- **CTA** "Show me the map": full width, height 42 / 46, bg coral, **ink text**, 14/600, radius 10.

## Screen 3c — Settings panel
Files: `FilterPanel/FilterPanel.tsx`, `YourConditionsRow.tsx`, `MatchColoursSwitch.tsx`, `MapLayersControl.tsx`, `BestZones/BestAreasControls.tsx`, `AdvancedSettings.tsx`, `StrengthRow.tsx`, `Conditions/WordPicker.tsx`, `OptionList.tsx`, `CheckList.tsx`.
- Tabs "Settings" / "Your areas": 2 equal columns, height 42 / 46, active = 600 + `inset 0 -2px ink`.
- "Your conditions" (15/600) + "Start from a profile" link (ink underline, min-height 44 on phone).
- Condition rows as in 3b.
- **Word picker opens in place** under the sentence (instead of a popover) — panel indented 32px, bg `#f6f7f8`, radius 12, padding 12×14: title 13/600, radio rows (16px radio; selected = 5px ink border; label + value right in dim), min-height 32 / 44.
  - **"Custom…" selected** → slider below it: "Custom value" label + current value (600) right; track 4px `#e3e6ea`, fill coral, thumb 18 (phone 24) white with 2px coral border; min/max labels below; hit area 26 / 44. The sentence word shows the number (e.g. "61 dB"). Use `CONDITION_RANGES[field]` for min/max/step (mock shows 45–75 dB as a placeholder).
  - Multi-select words (services, places, eras) keep `CheckList` inside the same in-place panel.
- Add chips + match bar (as 3b).
- "Show match colours" switch (34×20, on = ink) + "About Livability Index" link right; hatched note 12 dim.
- **Map layers**: section title 13/600; chips (single select): None / Noise / River floods / Street flooding / Wildfire — height 30 (phone 44), selected = ink bg white text; hint line 12 dim.
- "Show my best areas" switch row (existing controls appear below when on).
- **Advanced** (collapsed by default, chevron): intro 12 dim; "How much each risk counts"; per risk: label + importance word right (`strength.s1–s5`) and a **5-step meter** (5 segments 6px tall, gap 3, filled ink up to the level; hit area 44 on phone). Map 1–10 strength → 5 steps (2 per step). Keep a way to turn a risk off (tap the active first step again, or keep the checkbox) — **open decision, see below**. Then "Boost contrast for this view" switch.

---

## Interactions & state
- `cardDetailsOpen` (store, existing) — details toggle.
- New local state in details: `openSections: Record<'walk'|'noise'|'core'|'risk'|'price'|'locals', boolean>` default `{ noise: true, risk: true }`; `facadesOpen: boolean` default false. Reset on new building is optional.
- Rank tiles: derive count from `ranks` (0/1/2).
- Picker in place: one open picker at a time per panel; Escape / tapping the word again closes it; selecting a preset option closes it; Custom keeps it open while dragging.
- Hover: rows and buttons → bg `#f6f7f8` / `#e9ebee`. No animations needed beyond a 150ms height/opacity on expand (optional).
- Loading: keep existing `ui.loading` text in the verdict line while detail loads.

## i18n
Reuse existing keys. New / changed strings (add to `locales/en|ca|es`): rank tile sentences (two), "Custom value" exists (`picker.customValue`), climate verdict "−{{n}} pts · {{names}}", building strip short labels (dwelling/floors/built area — lowercase forms). Keep the Catalan and Spanish files in sync (`locales.test.ts` checks keys).

## Assets
No new images or icons. Use Tabler `IconChevronRight/Down`, `IconX`, `IconCheck` for the status marks if preferred over text glyphs. Remove service emoji from the card.

## Open decisions (ask the owner)
1. Risk strength: 5-step meter (as drawn) vs existing 1–10 slider + checkbox.
2. Word picker: in place (as drawn) vs existing popover.
3. Selected states: ink (as drawn) vs coral.

## Files
- `design/House Card.dc.html` — open in a browser; ids 1b, 2a, 2b, 3a, 3b, 3c. Tweaks: `rankLines` 0/1/2, `expandAllDetails`.
- `design/support.js` — runtime for the HTML file only.
- `CLAUDE_CODE_STEPS.md` — step-by-step prompts for Claude Code.
