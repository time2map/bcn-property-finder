# How to implement with Claude Code in VS Code

## 1. Setup (once)
1. Install the **Claude Code** extension in VS Code (or run `npm install -g @anthropic-ai/claude-code` and use `claude` in the VS Code terminal).
2. Open your local clone of `bcn-livability`. Create a branch: `git checkout -b redesign/card-panels`.
3. Unzip this handoff into the repo at `docs/design_handoff_card_and_panels/` (so Claude can read it). Open `design/House Card.dc.html` in a browser to see the mock.
4. Make sure the app runs and tests pass before you start: `cd frontend && npm install && npm run dev` and `npm test`.

## 2. Prompts — run one at a time, review, commit after each
Paste each prompt into Claude Code. After each step: check the running app on desktop and a phone-width window, run `npm test`, then `git commit`.

**Step 1 — Read and plan**
> Read docs/design_handoff_card_and_panels/README.md and docs/DESIGN.md. Then read frontend/src/components/BuildingCard/*, Onboarding/*, Conditions/*, FilterPanel/FilterPanel.tsx, AdvancedSettings.tsx, StrengthRow.tsx and the related CSS in frontend/src/index.css. Write a short implementation plan mapping each section of the README to the files you will change. Don't change code yet.

**Step 2 — Card header (1b)**
> Implement "Screen 1 — Building card header (1b)" from the README in MatchHeader.tsx, RankLines.tsx and BuildingCard.tsx: score ring, band label, meets line, condition rows with status icons, 0/1/2 rank tiles, grey Save/Share buttons, details toggle row. Desktop and the phone sheet (embedded). Reuse existing helpers and i18n keys; add new keys to en, ca and es. Update tests that break because of changed markup, without weakening what they check.

**Step 3 — Details view (2a/2b)**
> Implement "Screen 2 — Details open" from the README: photo + 4-column building strip, then one collapsible row per section with a small score ring and verdict line; Noise and Climate risk open by default; "Facade by facade" sub-toggle; Barri-level header row. Keep every fact and the show/hide rules the current code has. Remove service emoji and per-service bars.

**Step 4 — Onboarding (3a/3b)**
> Implement "Screen 3a" and "Screen 3b" from the README in OnboardingPanel.tsx, PresetCards.tsx, ConditionsEditor.tsx, AddConditionChips.tsx and MatchBar.tsx: profiles as one bordered list, short condition name above each sentence, editable-word style, add chips, match bar, coral CTA with ink text.

**Step 5 — Settings panel (3c)**
> Implement "Screen 3c" from the README: tabs, Your conditions header, word picker opening in place with the Custom slider (use CONDITION_RANGES), switches in ink, map layers as single-select chips, Advanced with the 5-step risk meter (keep a way to switch a risk off).

**Step 6 — Phone pass and accessibility**
> Check every screen at 375px width: all tap targets at least 44px, text contrast at least 4.5:1 (links ink + underline, not coral), no horizontal overflow, the whole condition row opens its picker on phones. Fix anything that fails and run the full test suite.

## 3. Finish
- Run `npm run build` and `npm test`.
- Push the branch and open a pull request; deploy the way you do today (GitHub Pages).

## Tips
- If Claude changes too much at once, say: "Only change files for this step; show me the diff first."
- Point at the mock by id: "Match the layout of 2a in the HTML file."
- Resolve the three "Open decisions" in the README before Step 5, or tell Claude which way to go.
