# Raw ideas

Unsorted ideas not yet turned into features. When an idea is picked up, create a
`docs/features/TODO-NNN-*.md` file and link it here.

---

## From: Urban Mash geoanalytics demo

Source: https://m-erts.github.io/geoanalytics-realestate/?lang=ru
(geo-ML for real estate demos on a synthetic city — idea source only, no reusable data or code)

### 1. Undervalued zones map ("reserve")

Highlight hexes where quality is high but price is low — areas the market hasn't priced in yet.

- Per hex: `gap = z(quality) − z(sale_eur_m2)`; both inputs already exist in `livability-h3.geojson`.
- **Quality must exclude the `openPrice` component**, otherwise the gap is predetermined by the
  composite weights.
- No clustering needed — the plain z-score difference is enough.
- SEO angle: "undervalued neighbourhoods Barcelona" content for relocating remote workers.

### 2. Pin price vs area median

Cheap version of the site's Bonus/Malus price decomposition: show a pin's €/m² relative to its
hex/barri median ("+14% vs area median") in the pin card and compare view. Data already
available (019 Idealista prices, 024 INCASOL open price).

Not now: a full hedonic price model with per-feature contributions. Coefficients on the site
are Moscow-specific, we have no transaction data, and Zillow Offers shows the risk of
promising valuations. If ever built — use spatial K-fold (whole building/cluster per fold),
a linear baseline first, and encode missing listing fields as a separate "not specified" category.

### 3. Weight presets

Persona presets ("Family", "Remote worker", "Investor") that set the composite weights in one
click; user can still tweak sliders afterwards. Lighter alternative to the questionnaire in
`TODO-031-weight-questionnaire.md`.
