# Claude. md – BCN Property finder

## Project

- `docs/PROJECT_BRIEF.md` — product goals, MVP scope, filter logic
- `docs/ARCHITECTURE.md` — repository structure, key modules, external services

## Stack

- **Frontend:** React + Vite + TypeScript, MapLibre GL JS, OpenRouteService API
- **Backend:** Python + FastAPI (post-MVP, empty for now)
- **Map tiles:** OpenFreeMap

## Commands

TBD 

## Language

All UI text (labels, buttons, placeholders, tooltips) must be in **English**.

## Workflow

For each new feature:

1. Read `docs/PROJECT_BRIEF.md` for context.
2. Create `docs/features/NNN-feature-name.md` with a description of the task.
3. Discuss the plan in plan mode.
4. Write tests first, then code.
5. Run `npm test` after every change.

## Definition of Done

A feature is not complete until all of the following pass:
1. Unit tests cover all new business logic (≥80% coverage).
2. At least one integration test covers the happy path.
3. `npm test` — all tests green, including existing ones.
4. `npm run lint` — no errors.
5. `npm run typecheck` — no errors.
6. Manually verified the scenario via `npm run dev` (for UI features).

If any step fails — do NOT report "done".
Show the failure output and propose a fix plan.
