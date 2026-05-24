# Claude. md – BCN Property finder

## Project

- `docs/PROJECT_BRIEF.md` — product goals, MVP scope, filter logic
- `docs/ARCHITECTURE.md` — repository structure, key modules, external services
- `docs/DESIGN.md` — design rules
## Stack

- **Frontend:** React + Vite + TypeScript, MapLibre GL JS
- **Backend:** OpenTripPlanner 2 (OTP2) via Docker — isochrone/routing engine
- **Map tiles:** OpenFreeMap

## Commands

### Frontend
cd frontend && npm test          # run tests
cd frontend && npm run lint      # eslint
cd frontend && npm run typecheck # tsc
cd frontend && npm run dev       # dev server (port 5173)

### Backend (OTP2)
cd backend && docker compose up -d   # start OTP2 on http://localhost:8080
cd backend && docker compose down    # stop OTP2
cd backend && docker compose logs -f # stream OTP logs

### Full stack (dev)
#### Terminal 1:
cd backend && docker compose up
#### Terminal 2:
cd frontend && npm run dev


## Language

All UI text (labels, buttons, placeholders, tooltips) must be in **English**.

## Workflow

For each new feature:

1. Read `docs/PROJECT_BRIEF.md` for context.
2. Create `docs/features/TODO-NNN-feature-name.md` with a description of the task.
3. Discuss the plan in plan mode.
4. Write tests first, then code.
5. Run `npm test` after every change.

## Feature file naming

- **Not yet implemented:** prefix with `TODO-` — e.g. `TODO-005-property-pins.md`
- **Implemented:** remove the prefix — e.g. `005-property-pins.md`

When a feature is marked done (Definition of Done satisfied), rename the file by dropping the `TODO-` prefix.

## Playwright MCP

Run Playwright tests only when:
- A new feature is fully implemented, OR
- A substantial change was made to an existing feature

Test only the affected component(s) — do NOT run a full system-wide Playwright pass for small changes.

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

## Changes request

– When I ask to change feature implementation – check and change corresponding features description in `features` folder if needed

## Git

– Never commit & push until you will be explicitly asked for it. 
– Don't ask for adding files to git – always add (if not in gitignore).

## ENV

If you specify any default variables that may explicitly affect the result of calculations in the application, put them in the environment variables and in the corresponding ENV file.
