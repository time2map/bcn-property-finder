# TODO-056 — Observability: analytics, error reporting, uptime, data version in the app

**Status:** Planned, not started. Scale track; independent, do before any press link.

## Problem

There is no way to know how many people came, what they did, what broke, or whether the site is up. Under a
spike we would learn about a failure from a tweet. The app also does not tell which data version it runs.

## Decision

- **Analytics**: cookie-less, privacy-first, no consent banner needed — **Plausible self-hosted** on our
  server (docker compose, `local-docs/architecture/06-server.md`); Cloudflare Web Analytics as the zero-setup
  stopgap if 054 step 0 lands first. Page views + a handful of custom events: quiz completed, preset
  chosen, condition changed, building card opened, best zones drawn, Idealista link clicked, share copied.
- **Errors**: **GlitchTip self-hosted** (Sentry-compatible; the `@sentry/browser` SDK) with performance off,
  errors on; release = git SHA; data version as a tag. Source maps uploaded in CI (not served). Sentry's
  free tier is the fallback if we don't want another container.
- **Uptime**: an **external** monitor (must not run on the same server) on `https://livability.time2map.com/` and on one data file
  (`manifest.json`) every minute; alerts to email/Telegram.
- **Version footer**: `App version <sha> · data <version>` in the attribution line.

## Spec

- `services/telemetry.ts`: `track(event, props)`; no-op when `VITE_ANALYTICS_ID` is empty (tests, local).
  Events are names only, no personal data, no coordinates finer than barri.
- `main.tsx`: Sentry SDK init when `VITE_SENTRY_DSN` is set (GlitchTip DSN); `beforeSend` strips URLs' `c=` parameter (user
  settings) — keep only its length.
- Build injects `VITE_APP_VERSION` (git SHA) in CI; `manifest.json` gives the data version (054).
- Monitor: UptimeRobot / Better Stack free plan; document the URL and the alert channel in
  `local-docs/architecture/06-runbook.md` (to write with this feature), not in the repo.

## Tests

- `telemetry.test.ts`: no-op without id; event names from a typed union; props never contain `lng`/`lat`.
- `main` smoke: Sentry not initialised in tests.

## Definition of Done

Per `CLAUDE.md`, plus: a dashboard shows live visits; a forced test error appears in Sentry with the release
SHA; the uptime monitor has sent one test alert.

## Open questions

- Plausible needs ~2 GB RAM (ClickHouse). If the server is tight, start with Cloudflare Web Analytics and
  move when funnels (quiz → map → Idealista) need more than page views.
