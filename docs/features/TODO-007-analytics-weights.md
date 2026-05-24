# 007 · Analytics weight configuration

## Goal

Allow the user to configure the importance weights for the four transport modes used to compute `travelIndex`. Currently the weights are hardcoded in 005 (walk=4, pt=3, cycle=2, car=1).

Also improves the scoring formula: replace the linear decay with a concave curve that better reflects real-world intuition, and establish a composite score architecture that future factors (crime, noise, POI proximity) can plug into.

## Status

Not implemented. Depends on [005-property-pins](005-property-pins.md) being done.

## Scope

### Decay curve

Replace the linear `norm(t) = max(0, 1 − t/60)` with a concave power curve:

```
norm(t) = max(0, 1 − t / CAP_MINUTES) ^ 0.7
```

Comparison at CAP = 60 min:

| Time | Linear | New (^0.7) |
|------|--------|------------|
| 5 min | 92 | 93 |
| 10 min | 83 | 87 |
| 20 min | 67 | 74 |
| 30 min | 50 | 59 |
| 45 min | 25 | 39 |

The curve rewards short commutes more and compresses the mid-range less.

### `travelIndex` formula (updated)

```
norm(t) = max(0, 1 − t / 60) ^ 0.7

travelIndex = round(
  Σ norm(mode_minutes_i) × weight_i   [for available modes where weight_i > 0]
  / Σ weight_i
  × 100
)
```

`Σ weight_i` sums only over modes that have a measured value AND a non-zero user weight. If no mode qualifies → `travelIndex` is `undefined`.

### Composite score architecture

`travelIndex` is renamed to `propertyScore` in preparation for future factors. While only travel data is available, `propertyScore === travelIndex`. When future factors are added each contributes its own 0–100 sub-score, and the composite is their weighted average:

```
propertyScore = Σ (factor_score_i × factor_weight_i) / Σ factor_weight_i
```

Future factors and their placeholder weights:
- Travel accessibility (this feature): weight TBD by user
- Crime level (008): weight TBD
- Noise level (009): weight TBD
- POI proximity (010): weight TBD

For now only travel is implemented, so `propertyScore = travelScore`.

### Settings UI

A "Weights" section in the settings sidebar, with four sliders:

| Mode | Default | Range |
|------|---------|-------|
| Walking | 4 | 0–5 |
| Public transport | 3 | 0–5 |
| Cycling | 2 | 0–5 |
| Driving | 1 | 0–5 |

Setting a weight to 0 excludes that mode from the index entirely.

Weights are stored in `localStorage` under `bcn_analytics_weights` and loaded on app start.

### Reactivity

When weights change, `travelIndex` / `propertyScore` for all existing pins is recalculated immediately — client-side only, no re-fetching of route durations.

The list re-sorts in the same tick.

## Out of scope

- Per-pin weight overrides
- Named weight presets ("prioritize transit", "cyclist setup")
- Server-side weight persistence

## Done when

1. Sliders shown in UI with correct defaults (4/3/2/1).
2. Changing a weight immediately re-ranks the list.
3. Weights persist across reloads.
4. Decay curve updated to `^0.7` power function.
5. Unit tests cover: `travelIndex` with custom weights, decay curve values, zero-weight exclusion.
6. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
