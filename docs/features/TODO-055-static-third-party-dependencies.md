# TODO-055 — Remove runtime third-party dependencies: own basemap, static metro, Catastro in the pipeline

**Status:** Planned, not started. Scale track; after 054 (needs the data host). Details:
`local-docs/architecture/03-basemap-options.md`, `05-runtime-dependencies.md`.

## Problem

Every visit depends on servers we do not control and that have no obligation to us: the ICGC map style and
tiles (Catalan government), OpenFreeMap as fallback (a donation-run project that asks not to be hit with
spikes), and the TMB API for metro lines (per-visit calls with an app key that ships in the bundle). A press
spike of 20 M basemap tile requests can get us blocked, and the map without a basemap is unusable. Every
building click calls Catastro DNPRC.

## Decision

1. **Own basemap**: a Protomaps PMTiles extract of the metro area + Catalonia on our server (`/basemap/`,
   behind the CDN cache), with the
   `@protomaps/basemaps` light/grayscale style, fonts and sprites hosted with it. Order in
   `resolveStyleUrl`: Protomaps → ICGC → OpenFreeMap.
2. **Metro as static GeoJSON**, built offline from the TMB API by a script (like FGC today). The TMB key leaves
   the frontend and CI; `MetroLayer` loads `metro-lines.geojson` / `metro-stations.geojson`.
3. **Catastro below-ground uses precomputed** in `build_building_tiles.py` into `buildings-detail.pmtiles`
   (layer `d`: `below_uses`), so the card makes no runtime call. The facade photo stays behind its flag.

## Spec

- `scripts/build_basemap.sh`: `pmtiles extract <planet-url> basemap-bcn.pmtiles --bbox=<metro+Catalonia>`,
  style JSON generated from `@protomaps/basemaps` (`flavor: light`), fonts and sprites alongside, published
  with `publish_data.sh` to `/basemap/v/<date>/`.
  Attribution "© OpenStreetMap contributors · Protomaps" in the style sources.
- `Map.tsx`: `STYLE_URLS = [protomaps, ICGC, OpenFreeMap]`, first that responds within 3 s; the chosen style's
  attribution is still read into `mapAttribution`.
- `scripts/fetch_tmb_metro.py`: TMB `/linies/metro` + `/estacions` → `frontend/public/metro-lines.geojson`,
  `metro-stations.geojson` with the same properties `MetroLayer` reads today (`PICTO`, colours). Key from
  `backend/.env` (already there for GTFS).
- `MetroLayer.tsx`: fetch the two files; drop `VITE_TMB_APP_ID/KEY`; `deploy.yml` loses the secrets.
- `build_building_tiles.py`: call DNPRC per building with ≥ 1 floor below ground (rate-limited, cached in
  `data/buildings/dnprc/`), write `below_uses` (e.g. `parking|storage`). `catastroUnits.ts` → removed; the
  card reads the field. Buildings without the field show nothing (as when the call fails today).
- Docs: `ARCHITECTURE.md` external services table; `FEATURE_FLAGS.md` unchanged.

## Tests

- `Map.test.tsx` / `resolveStyleUrl`: order and fallback when the first URL fails or times out.
- `MetroLayer.test.tsx`: loads the static files; no network call to `api.tmb.cat`.
- `test_build_building_tiles.py`: `below_uses` parsed from a recorded DNPRC response fixture; buildings
  without basement skip the call.
- Visual check: index colours on the Protomaps light style vs ICGC (screenshots in `local-docs/design/out/`).

## Definition of Done

Per `CLAUDE.md`, plus: the network panel of a fresh visit shows requests only to our domains (app + data) and
to nothing else until a user clicks an external link.

## Open questions

- Basemap extract size (metro area only ≈ 100 MB vs Catalonia ≈ 1 GB): start with metro area + a low-zoom
  (z ≤ 10) Catalonia layer. To be measured.
- Keep ICGC as second rather than drop it? Proposed: keep, it costs nothing.
