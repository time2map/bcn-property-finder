# 031 — Onboarding: profiles and one sentence ("Where would you like to live?")

**Changed by 073 (2026-11-16):** the City profile is 25 min to the centre (was 15: almost no home met it with the three central places; 20 still failed the audit guard), and the centre steps of the sentence are 25 / 30 / 45 min. Profiles without their own list now get the default services (no beach) and the three central places.

**Status:** Implemented 2026-11-12, checked in the browser at 375 px and 1440 px; on in production together with 052
(flag `VITE_FEATURE_ONBOARDING`). Redesigned 2026-11-12: the multi-screen quiz (tiles → one follow-up screen per
tile → risks → done) is replaced by **profiles + one editable sentence**. Mock-up reviewed and approved
2026-11-12 (`local-docs/design/`, artifact "Mad-libs Onboarding"). Earlier versions: 2026-11-11 (conditions
model, 049) and the original weights 0–10 questionnaire (gone).
Part of the mass-market UX track: 050 (match score) → 031 (this) → 051 (ranked areas) → 052 (conditions
panel) → 053 (shareable URL).

## Problem

A first-time visitor lands on a map already coloured by defaults they never chose, over a panel with ~20
controls. There is no entry point: no question, no explanation, no way to say "I'm a family on a budget" in
10 seconds. Best-in-class tools (Rightmove "Where can I live?", Teleport, the NYT "Where should you live"
quiz) start with a few choices and show a result; the settings panel comes after.

## Decision

- The first screen offers **four profiles** (Family, Remote worker, City life, Retiree; Investor replaced in 069) and "Build your own".
- Both paths lead to **one sentence** made of tappable words ("mad-libs"): *"No louder than [a calm street] outside my
  window"*, *"[Everyday services] within [10 min] on foot"*. The sentence **is** the control for each
  condition; the same component later becomes the conditions panel (052). One component, two places.
- **The map is live**: every tap recolours it. On desktop, hovering a profile previews it on the map.
- Nothing new in the model: every word maps to an existing store value (`compositeWeights` on/off,
  `conditions` limits, `enabledWalkCategories`, `enabledLandmarkIds`, `ageEras`, `compositeRiskStrengths`).
  The only addition is the **order** in which conditions were added (priority, used by 051).
- The detail layer stays: "Custom…" in every picker, full checklists, risk strengths, map layers, best areas
  and search settings live under **Advanced** and **Map layers** in the panel (see 052).

## User story

*As someone moving to Barcelona, I want to say in a few taps what matters to me and see where I'd like to
live, without learning what Lden or €/m² of a barri means.*

## Flow (three screens, same component)

> **Changed 2026-11-14 (068):** a profile card applies the profile and goes straight to screen 3 (the main panel);
> only "Build your own" opens screen 2. The "Family profile" tag on screen 2 is gone because screen 2 is no longer
> shown for a profile.

1. **Start** — headline *Where in Barcelona would you like to live?*, sub *Pick a profile or build your own.
   We'll colour every home on the map by how well it fits.*, four profile cards (each with a thumbnail of its
   own map), "Build your own", link "Just show me the map" (keeps the app defaults).
2. **Sentence** — heading *I'd like to live somewhere…*, one row per condition (number = priority, sentence,
   × to remove), "Add" chips for the missing conditions, a bar "Homes by match" (Great / Good / Partial / Poor
   shares), primary button **Show me the map**, Back. A profile pre-fills the rows (tag "Family profile"); "Build
   your own" starts with quiet, on foot and budget at their defaults.
3. **In the panel** — only the chip row "Your conditions: Quiet · On foot · Budget — Change" (Change → screen 1)
   at the top of the existing filter panel. Replacing the old condition controls with the same rows, Map layers,
   Best areas and Advanced is **052** (mock-up screen 3).

## Sentences and pickers

Each condition is one row. A tap on a highlighted word opens a small picker with 3–4 verbal options and,
for numeric values, "Custom…" with a slider. A value that is not one of the steps is shown as an exact number
("62 dB") and "Custom" is highlighted in the picker.

| Condition | Sentence | Picker options |
|---|---|---|
| Quiet | No louder than **[a calm street]** outside my window | a courtyard 50 dB · a calm street 58 dB · normal city noise 65 dB |
| On foot | **[Everyday services]** within **[10 min]** on foot | services: all 10 / profile sets / checklist · 5 · 10 · 15 min |
| Centre | **[The centre]** within **[30 min]** on foot | the centre (13 landmarks) / my places · 15 · 30 · 45 min |
| Budget | A **[70 m²]** flat costs up to **[€250,000]** on average | size: 50 · 70 · 90 · 120 m²; budget: €150,000 · €250,000 · €350,000 · €500,000, each with "≈ N % of homes" |
| Locals | Residents rate the area at least **[7.5]** out of 10 | 7.0 Happy · 7.5 Very happy · 8.0 Among the happiest (only with `VITE_FEATURE_LOCALS_OPINION`) |
| Buildings | Built in **[1900–1939]** | the 5 eras with their one-line text (`AGE_ERAS`), several can be picked |
| Risks | **[Avoid]** flood and wildfire risk | Avoid (strength 5) · Strongly avoid (8); "Don't care" = remove the row |

**Budget.** The data is the average sale price per m² of the area (INCASOL), not the price of a flat, so a budget
for a flat of a given size is a price per m²: budget ÷ size. The condition still stores `priceMaxEurM2`; the size
is a separate preference (`flatAreaM2`, key `bcn_flat_area_m2`, default 70 m²) and the budget shown is
`priceMaxEurM2 × flatAreaM2` to the nearest €1,000. Changing the size keeps the budget in euros and moves the
price per m² (`setFlatArea`); changing the budget sets `priceMaxEurM2 = budget ÷ size`. "On average" is in the
sentence because it is an estimate from the area's average price. Scoring and the 25 % fall-off are unchanged.
The share per option ("≈ N % of homes") is computed at load from the building rows and the area price table in
`buildings-meta.json` (`price_bounds` only holds p5/p95), for the limit budget ÷ size.

## Profiles

Values in `services/presets.ts`, overridable by ENV `VITE_PRESET_<NAME>` as JSON (optional; defaults in code).
Order of the rows = order listed.

- **Family** — quiet 58, on foot 10 min with school + kindergarten + park + supermarket + pharmacy, budget
  €250,000 for 70 m², risks avoid. *Quiet street, school and park on foot, a 70 m² flat up to €250,000*
- **Remote worker** — on foot 10 min with café + supermarket + park, centre 30, quiet 58. *Café and park
  nearby, 30 min to the centre*
- **City life** — centre 15, on foot 5 min with café + restaurant + metro, noise 65. *15 min to the centre,
  bars and metro at the door*
- **Retiree** (069, replaced Investor) — on foot 5 min with clinic + pharmacy + supermarket + park, quiet 58, risks avoided, no price. *Clinic, pharmacy and shops within 5 min, a calm street*

A profile is just the sentence pre-filled; the user can edit every word.

## UI

- **Desktop:** panel top left over the map (same place as the filter panel, 372 px wide instead of 264), map live
  to the right.
- **Mobile (≤ 768 px):** bottom sheet up to 70 % of the height, map live above it (the "visible part of the
  map" logic of the colour scale accounts for the sheet). The sheet scrolls; the primary button is pinned.
- Tap targets ≥ 32 px high (pills 32, rows with line height 2.2), picker options ≥ 40 px. On a phone the word picker
  is a bottom sheet with 52 px rows (062). The first-visit sheet keeps its own component; the full name bar stays on
  top until the onboarding is closed, then the search pill takes over.
- Shown on first visit only (see "When it appears"); skippable.
- Copy in English (`docs/DESIGN.md`). Pills: brand-tint background, dark brand text (`#B8322F`; the coral
  `#F06965` itself is too light for text), dotted underline.

## When it appears

Only when there is nothing to lose: no `bcn_onboarded` flag, no saved settings in `localStorage`, no settings
in the URL (053). Returning users and shared links go straight to the map. "Change" in the panel reopens
screen 1; picking a profile or "Build your own" replaces the current settings (a one-line warning if the
current values differ from every profile and from the defaults).

## Later (not in this pass)

- Hover preview of a profile on the map, and a thumbnail map on each profile card. A full rescoring takes
  ~0.4 s on the main thread, so the preview needs cached per-profile scores replayed through `setFeatureState`,
  and the thumbnails need images rendered offline.
- Move scoring into a worker if a tap in the sentence editor feels heavy (058).

## Implementation (as built)

- `components/Conditions/` (shared with 052): `ConditionsEditor.tsx`, `SentenceRow.tsx`, `WordPicker.tsx`,
  `OptionList.tsx`, `CheckList.tsx`, `AddConditionChips.tsx`, `MatchBar.tsx`.
- `components/Onboarding/`: `OnboardingPanel.tsx` (screens 1–2), `PresetCards.tsx`.
- `components/FilterPanel/YourConditionsRow.tsx` — the chip row (screen 3).
- `services/conditionOptions.ts` (pure): option sets from ENV, `optionFor`, `riskLevel` / `strengthsFor`,
  `activeConditions`, `profileToPatch`, budget shares (`sortedPrices`, `shareUnder`); `services/presets.ts`
  (`PRESETS`, `applyOverride`); `hooks/useBudgetShares.ts`; `bandShares` in `services/match/matchSummary.ts`.
- Store: `conditionOrder` (`bcn_condition_order`), `onboarded` (`bcn_onboarded`), `onboardingOpen`,
  `applySettings(patch)` (one `set`, one rescoring), `completeOnboarding()`, `openOnboarding()`,
  `hasSavedSettings()`.
- `App.tsx`: desktop shows `OnboardingPanel` in `.top-panel--wide` instead of the filter panel; phone shows it in
  `.onboarding-sheet` (no overlay) and hides the filter button meanwhile. `visibleBounds` subtracts the sheet.
- Flag `VITE_FEATURE_ONBOARDING` (off in production until 052 lands; on in `.env.test`).
- ENV: `VITE_QUIZ_NOISE_OPTIONS=50,58,65`, `VITE_QUIZ_WALK_OPTIONS=5,10,15`,
  `VITE_QUIZ_CENTRE_OPTIONS=15,30,45`, `VITE_QUIZ_BUDGET_OPTIONS=150000,250000,350000,500000`, `VITE_QUIZ_FLAT_AREA_OPTIONS=50,70,90,120`, `VITE_FLAT_AREA_M2=70`,
  `VITE_QUIZ_LOCALS_OPTIONS=7.0,7.5,8.0`. Add to `.env.local.example`, `.env.production`, `ARCHITECTURE.md`.
  (052 reuses them.)

## Tests

- `conditionOptions.test.ts`: every option produces valid store values; `nearestOption` picks the step or
  reports custom; risk preset mapping both ways; budget shares are monotonic.
- `presets.test.ts`: every preset passes the same checks; names and ids unique; unchosen conditions are off.
- `SentenceRow.test.tsx` / `WordPicker.test.tsx`: tapping a word opens the picker; choosing an option
  updates the store once; "Custom…" shows the slider and an exact value; remove / add chips keep the order.
- `OnboardingPanel.test.tsx` and `App.test.tsx`: first visit shows it (desktop panel, phone sheet); returning
  user / saved settings do not; profile → sentence pre-filled; "Show me the map" sets `bcn_onboarded`; skip keeps
  defaults; "Change" reopens. Store tests cover `applySettings` (one update) and the order migration.

## Definition of Done

Per `CLAUDE.md`, plus:
- a profile gets the user to a coloured map in **2 taps** (profile, Show me the map); "Build your own" with
  the default words in 2 taps; each changed word costs 2 taps (word, option) — a two-word change takes ≤ 6
  taps on a phone (375 px);
- the map shows a visible difference between any two profiles;
- screens 1–3 work at 375 px and at 1440 px (Playwright, affected components only).

## Open questions

- Cap on the number of conditions (the old quiz allowed 1–4)? Decide after seeing screen 2 on a phone.
