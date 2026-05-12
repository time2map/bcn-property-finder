# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An interactive map tool for finding residential properties in Barcelona. Users start with the entire city and progressively narrow their area of interest by applying filters (commute isochrones, proximity to amenities, noise levels, green spaces, etc.). The resulting zone is exported to property portals like Idealista.

**Stack:** React + MapLibre (frontend), Python backend if needed, database TBD. No authentication.

## MVP Scope

1. Interactive map of Barcelona
2. User picks a workplace on the map → an isochrone is computed (walk or public transport, configurable duration) → area outside the isochrone is eliminated
3. "View on Idealista" button that opens Idealista filtered to the resulting zone

Future filters (post-MVP): supermarket proximity, bar/noise avoidance, green area proximity.
