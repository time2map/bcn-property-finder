# TODO-033 — Multi-city architecture

## Idea

Extend the tool beyond Barcelona to other major Spanish (or European) cities: Madrid, Valencia, Málaga, Palma. Each city gets its own livability grid, OTP2 GTFS feed, and SEO pages.

## Decisions needed before launch

- **App name and domain**: must not be Barcelona-specific if multi-city is planned. Candidates: `livability.map`, `cityindex.io`, `time2map.com/cities/...`.
- **City selector UI**: dropdown or city-specific subdomains?
- **Data pipeline**: is the grid generation script city-agnostic already, or needs refactor?

## Notes

- OTP2 can run one graph per city (separate Docker instances) or a combined graph.
- Noise data availability varies by city — some have Lden maps, some don't.
- Walkability POI data (OpenStreetMap-based) is available everywhere.
- Decision on naming should happen before public launch — renaming post-launch is costly for SEO.
