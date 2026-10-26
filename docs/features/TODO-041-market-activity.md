# TODO-041 — Market activity (sale & rental turnover per barri)

**Status:** Draft. Not planned yet.

## Goal

Show how active the housing market is in each barri, as an informational block (not a composite component):
how often homes are sold and new rental contracts are signed relative to the housing stock, and whether
long-term rental supply is shrinking.

User story: *As someone buying or renting in Barcelona, I want to see if a barri has unusually high or low
market churn, so I can spot red flags (distressed sales, investor buy-ups) and judge how hard it will be to
find, or later resell, a flat there.*

## Why

- Original idea: "housing deficit" from listing counts (too many listings means something is wrong with the area).
  A raw listing count is misleading: it depends on barri size, tenant churn (expats and students), new builds,
  and portal duplicates.
- Standard market metrics are months of supply and days on market. They need the **stock of active listings**,
  and that data is not open at barri level. Scraping Idealista is legally unclear, so we don't use it.
- Open data does give **flows** (registered sales, new rental contracts). Turnover rate, meaning flow divided by
  housing stock, is a standard substitute.

## Pre-analysis (2026-10-20, 2025 data, 73 barris)

| Metric | Median | Highest | Lowest |
|---|---|---|---|
| Sale turnover (INCASOL sales / cadastral dwellings) | 1.77% / yr | Ciutat Meridiana 5.0%, Trinitat Vella 3.6%, Roquetes 3.3%, Diagonal Mar 3.2% | Sagrada Família 1.33%, Camp de l'Arpa 1.35% |
| Rental turnover (INCASOL new contracts / cadastral dwellings) | 3.3% / yr | Gòtic 5.2%, Vila de Gràcia 5.0%, Putxet 4.9%, Barceloneta 4.9% | Nou Barris periphery 1–1.5% |

- Pearson correlation between sale and rental turnover is **0.05**. They are independent signals.
- High **sale** turnover clusters in the cheapest Nou Barris barris (likely investor buy-ups and post-eviction
  sales). Diagonal Mar is high because of new builds.
- High **rental** turnover clusters in central, expat-heavy barris. This is tenant churn, not a red flag.
- City-wide new rental contracts: 38,683 (2023) → 30,789 (2025), −20%. Long-term rental supply is shrinking.
- Cross-check: notary residential sales 2025 = 16,645, INCASOL = 15,869. The two sources agree.

## Data sources (all open, CC-BY)

| Data | Source | Level | Cadence | In repo |
|---|---|---|---|---|
| Registered sales (new free / new protected / used / total), columns "Nre. Compravendes" | INCASOL `BCN_acumulat_{year}.xlsx` | barri | quarterly (cumulative) | File already fetched by `fetch_incasol_sale_prices.py`, but only price columns are parsed |
| New rental contracts (fiances) | INCASOL `.../03_Mercat_de_lloguer/03_Lloguers_Barcelona_per_districtes_i_barris/anual_bcn_contractes.xlsx`, `trimestral_bcn_contractes.xlsx` | barri | annual since 2000, quarterly (latest 2026 Q1) | Same folder as `fetch_bcn_rental_barri.py`; not fetched |
| Notary sales by use type | Open Data BCN `notaris_compravendes_trans_tip_us` (`Tipologia_Us_Desc = Residencial`) | barri × month | monthly | No. Alternative or fresher source for sales |
| Housing stock (denominator) | Open Data BCN `est-cadastre-habitatges-any-const` (sum `Nombre`) | census section | annual | No |
| Optional: rental stock | Open Data BCN `habit-ppal-segons-regim-tin` (census tenure) | tbd | census | No. Check the census year |
| Optional: households registered in the padró | Open Data BCN `pad_dom_mdbas_n-persones` | census section | annual | No. Stock minus padró households gives the share of dwellings with no registered residents. Mixed signal (empty, second homes, tourist flats, unregistered expats) |

Not available as open data: active listing counts per barri (OHB / Adevinta reports are PDF only), SERPAVI bulk
export (interactive map only), notary portal bulk export.

## Formulas (draft)

```
sale_turnover   = sales_total(year)        / dwellings × 100   # % of stock per year
rent_turnover   = rental_contracts(year)   / dwellings × 100   # or / rental stock, if available
rent_trend_2y   = rental_contracts(year) / rental_contracts(year − 2) − 1
```

- Smooth small barris: average over `MARKET_SMOOTH_YEARS`, and hide the value when the count is below
  `MARKET_MIN_COUNT`. Example: Can Peguera rental trend +650% comes from 2 → 15 contracts.
- Show each value with its city percentile.

## Parameters (env)

| Variable | Default | Where |
|---|---|---|
| `MARKET_SMOOTH_YEARS` | tbd (2–3) | pipeline |
| `MARKET_MIN_COUNT` | tbd (~30) | pipeline |
| `MARKET_TREND_YEARS` | 2 | pipeline |

## UI (draft)

- Barri / hex detail card: **Market activity** block with sale turnover, rental turnover and 2-year rental trend,
  each with its city percentile.
- ℹ modal: what is measured, sources and years, and how to read it (high sale churn in cheap areas = caution;
  high rental churn in central areas = normal tenant turnover).
- Not part of the composite score, because high and low values can both be good or bad depending on context.

## Known limitations

- Barri level only. It does not map to hexes.
- Seasonal rentals and room rentals are probably under-counted in fiances, so central barris are understated.
- Notary data hides small values as `..`.
- Turnover is not the same as listing stock. It can't give months of supply or days on market.

## Open questions

- Show it on the barri card only, or on the hex card too (inheriting the barri value)?
- Sales source: INCASOL (quarterly, already fetched) or notaries (monthly, fresher)?
- Denominator for rental turnover: total stock or rental stock (census tenure data)?
- Include the "no registered residents" share, or drop it as too noisy?

## Definition of Done

Standard (see `CLAUDE.md`).
