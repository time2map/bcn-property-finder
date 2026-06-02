# Barcelona's property finder

The task is to develop a map that helps me (or other people) in Barcelona to compare
candidate apartments and decide where to buy. For now the user is just me, but the app might
be expandable publicly in future. No authentication needed for now. Interface is simple.

## Product positioning — comparison tool

The app is a **comparison tool**, not an area-sculpting tool. The user has already found
listings (e.g. on Idealista) and wants to compare them objectively. The workflow is:

1. The user defines a **workplace** and a transport-accessibility budget (isochrone).
   Transport accessibility is **critical** — it is the one hard constraint on the area of
   interest. Everything reachable within the budget is "in scope"; everything outside is not.
2. The user **manually picks/explores zones** within that reachable area — this selection
   stays human. The app does not auto-shrink the area by other factors.
3. The user adds **candidate apartments as pins** (by clicking the map or dropping a listing
   screenshot, which is parsed and geocoded).
4. Each pin is scored on several factors and the pins are **compared side by side** so the
   user can rank them.

So the core mechanic is: **isochrone defines what's reachable → user drops candidate pins →
each pin gets a composite score → compare and decide.** Other factors do NOT cut the area;
they only inform the per-pin comparison.

## Scoring model

Each pin receives a **composite score** (0–100), a weighted blend of sub-factors. Weights are
ENV-configurable (see `docs/ARCHITECTURE.md`). Current factors:

- **Travel index** — walk / public-transport / cycle / drive time to the workplace. Derives
  from the same transport-accessibility data that is critical above.
- **Noise** — strategic noise map (Lden) at the pin location.
- **Walkability** — coverage of everyday services (supermarket, pharmacy, park, school,
  metro, clinic…) within walking distance of the pin.

Factors are designed to be additive: new factors plug into the same composite as opt-in
weighted sub-scores. If a factor's data is unavailable for a pin, it is skipped and the
composite is computed from the remaining factors.

## MVP includes

- Interactive map of Barcelona.
- Pick a workplace; build an N-minute isochrone (foot or public transport) marking the
  transport-reachable area of interest.
- Add candidate apartments as pins (manual click or screenshot drop → parse → geocode).
- Per-pin analytics and a composite score; compare pins side by side.
- A button to open the current area of interest on Idealista (export of the reachable zone).

## Stack

React + Maplibre. Backend — OTP2 for isochrone/routing. See `docs/ARCHITECTURE.md` for the
full stack and module layout.
