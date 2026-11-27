# Barcelona Livability Map

An interactive map of Barcelona and its metropolitan area that colours every residential building by how well it
meets your conditions: walkability, noise, access to the city centre, price, building age and residents'
opinion, with penalties for flood and wildfire risk. You can click any building for its details, and draw the
best zones in view as ready-made Idealista searches.

A local-only mode adds commute isochrones (OpenTripPlanner) and side-by-side comparison of candidate apartments.

**Beta:** https://livability.time2map.com/

![Barcelona Livability Map](docs/screenshot.jpg)

## Run locally

Public map only (no backend needed):

```bash
cd frontend && cp .env.local.example .env.local && npm install && npm run dev   # http://localhost:5173
```

For the personal mode, set `VITE_FEATURE_ISOCHRONE` / `VITE_FEATURE_PINS` / … to `true` in `.env.local`, add the
keys there, and start the routing backend:

```bash
(cd backend && docker compose up -d)   # OTP2 on http://localhost:8080
```

## Docs

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md): what the product does and for whom
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): code, data pipeline, scoring, ENV, external services
- [`docs/FEATURE_FLAGS.md`](docs/FEATURE_FLAGS.md): what is public and what is gated
- [`docs/ROADMAP.md`](docs/ROADMAP.md): planned tracks and their order
- [`docs/features/`](docs/features/): one file per feature
