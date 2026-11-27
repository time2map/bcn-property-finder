# TODO-057 — CI quality gate, branch previews, data out of git, reproducible pipeline

**Status:** Planned, not started. Scale track; parts can start now (gate), parts depend on 054 (the server as origin).

## Problem

`deploy.yml` builds and publishes on every push to `main` without running tests, lint or typecheck; there is
no preview of `dev`. 88 MB of data binaries live in git (repo 100 MB and growing with each rebuild). The
Python pipeline runs only on one Mac (`arch -x86_64 .venv-livability`, some scripts via `uv run --with`), with
no lock file. Under load, a hotfix must be safe to ship in minutes.

## Decision

- **Gate**: `ci.yml` on pull requests and pushes: `npm ci`, `npm run lint`, `npm run typecheck`,
  `npm test` (coverage thresholds already in `vite.config.ts`), `python -m unittest scripts/test_*.py`.
  Deploy only after the gate on `main`. Branch protection on `main`: PR + green checks.
- **Previews**: the deploy job builds every pushed branch and `rsync`s it to `/preview/<branch>/` on our
  server (054), `noindex`, cleaned when the branch is deleted; the URL is posted in the PR by the job.
- **Data out of git**: `.pmtiles` and `.bin.gz` ignored once published to the server (054); `fetch_data.sh` restores them for local
  work; CI needs none of them (tests use fixtures; `buildings-meta.json` stays in git).
- **Pipeline reproducible**: `scripts/requirements.txt` + `uv.lock` (or `pyproject.toml` in `scripts/`),
  a `Makefile` with the step order from `ARCHITECTURE.md` (`make buildings`, `make tiles`, `make vibe`,
  `make publish VERSION=…`), each step idempotent and skipping when its output is newer than its inputs.
- **Flags and env in CI**: `.env.production` stays the single source of public config; the only CI secret is
  the deploy SSH key (after 055 the TMB keys are gone from the build).

## Spec

- `.github/workflows/ci.yml`: matrix not needed; Node 22, Python 3.12; cache npm and uv.
- `deploy.yml`: `needs: ci`; `main` → `/srv/livability/www/`, other branches → `/preview/<branch>/`.
- `scripts/Makefile`, `scripts/pyproject.toml`, `scripts/README.md` (how to run on Apple Silicon:
  `arch -x86_64` only where a wheel is missing; list which).
- `docs/ARCHITECTURE.md`: pipeline section points at the Makefile.

## Tests

- The gate itself: a PR with a failing unit test is red; a PR with a lint error is red.
- `make -n` prints the full order; `make tiles` on a machine with the intermediate GPKGs rebuilds the four
  public files byte-identically (except timestamps) — checked once, result noted in the feature file.

## Definition of Done

Per `CLAUDE.md`, plus: `main` cannot receive a push that fails tests; a fresh clone + `fetch_data.sh` +
`npm run dev` works in under 10 minutes on a clean machine.
