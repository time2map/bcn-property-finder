# TODO-032 — Score range display / dynamic legend

## Problem

The colour ramp is fixed 0–100 but actual scores cluster in a narrower band (e.g. 45–85). The map looks flat — little contrast between cells.

## Idea

Two options:

**A) Dynamic ramp** — stretch the colour scale to the actual min/max of visible cells. More contrast, but the same colour means different scores at different zoom levels.

**B) Percentile-based ramp** — colour = percentile rank within the city, not absolute score. Always looks vibrant; clearly communicates "top 10%" vs "bottom 10%".

**C) User-adjustable range** — let user drag handles on the legend to set the visible range. Most flexible, most complex.

## Notes

- Option B is simplest to implement and most visually effective for a map product.
- Absolute score still shown in HexDetailCard tooltip — percentile is only for the colour.
- Consider showing "top / average / below average" labels on legend instead of raw numbers.
