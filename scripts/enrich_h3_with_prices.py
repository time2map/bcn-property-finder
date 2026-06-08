#!/usr/bin/env python3
"""
Enrich livability-h3.geojson with open sale price data (INCASOL).

For each H3 cell centroid:
  1. Point-in-polygon → BCN barri  → sale_total_latest  (barri-level, ~73 zones)
  2. Fallback → Catalonia municipality → latest sale_total_* (muni-level, ~358 zones)

Writes two new fields per cell:
  sale_eur_m2  : number | null   (EUR/m² of built area)
  sale_src     : 'barri' | 'muni' | null

Also writes frontend/public/data/open-price-meta.json with p5/p95 bounds.
"""

import json
import numpy as np
import geopandas as gpd
from pathlib import Path

ROOT    = Path(__file__).parent.parent
GPKG    = ROOT / "data" / "open-prices" / "bcn_prices.gpkg"
H3_IN   = ROOT / "frontend" / "public" / "data" / "livability-h3.geojson"
H3_OUT  = H3_IN
META_OUT = ROOT / "frontend" / "public" / "data" / "open-price-meta.json"


def latest_sale_total(row, year_cols: list[str]) -> float | None:
    """Return most recent non-null sale_total_* value from a GeoDataFrame row."""
    for col in reversed(year_cols):
        val = row[col]
        if val is not None and not (isinstance(val, float) and np.isnan(val)) and val > 0:
            return float(val)
    return None


def main() -> None:
    print("Loading data...")

    # ── BCN barri layer (has sale_total_latest pre-computed) ──────────────────
    barri = gpd.read_file(GPKG, layer="bcn_sale_barri")[["geometry", "sale_total_latest"]]
    barri = barri[barri["sale_total_latest"].notna()].to_crs(epsg=4326)

    # ── Catalonia municipality layer (compute latest on the fly) ──────────────
    muni_raw = gpd.read_file(GPKG, layer="catalonia_sale_muni")
    total_cols = sorted(c for c in muni_raw.columns if c.startswith("sale_total_"))
    muni_raw["_latest"] = muni_raw.apply(lambda r: latest_sale_total(r, total_cols), axis=1)
    muni = muni_raw[["geometry", "_latest"]].rename(columns={"_latest": "sale_total_latest"})
    muni = muni[muni["sale_total_latest"].notna()].to_crs(epsg=4326)

    # ── H3 grid ───────────────────────────────────────────────────────────────
    print("Loading H3 grid...")
    h3_gdf = gpd.read_file(H3_IN).to_crs(epsg=4326)
    centroids = h3_gdf.copy()
    centroids["geometry"] = h3_gdf.geometry.centroid
    print(f"  {len(centroids)} H3 cells")

    # ── Spatial join: barri ───────────────────────────────────────────────────
    print("Spatial join → barri...")
    joined_barri = gpd.sjoin(
        centroids[["h3_idx" if "h3_idx" in centroids.columns else "geometry", "geometry"]
                  if False else ["geometry"]],
        barri,
        how="left",
        predicate="within",
    )
    # sjoin adds index_right — check result
    if "sale_total_latest" not in joined_barri.columns:
        joined_barri["sale_total_latest"] = np.nan

    barri_price = joined_barri["sale_total_latest"].values  # one per H3 cell (may have NaN)

    # ── Spatial join: municipality (fallback for cells not in any barri) ──────
    print("Spatial join → municipality (fallback)...")
    no_barri_mask = np.isnan(barri_price.astype(float))
    print(f"  Cells without barri match: {no_barri_mask.sum()}")

    muni_price = np.full(len(centroids), np.nan)
    if no_barri_mask.sum() > 0:
        fallback_cells = centroids[no_barri_mask].copy()
        joined_muni = gpd.sjoin(
            fallback_cells[["geometry"]],
            muni,
            how="left",
            predicate="within",
        )
        if "sale_total_latest" in joined_muni.columns:
            muni_price[no_barri_mask] = joined_muni["sale_total_latest"].values

    # ── Combine ───────────────────────────────────────────────────────────────
    sale_eur_m2 = np.where(~np.isnan(barri_price.astype(float)), barri_price, muni_price)
    sale_src = np.where(
        ~np.isnan(barri_price.astype(float)), "barri",
        np.where(~np.isnan(muni_price), "muni", None)
    )

    # ── p5 / p95 normalisation bounds ─────────────────────────────────────────
    valid = sale_eur_m2[~np.isnan(sale_eur_m2.astype(float))]
    p5  = float(np.percentile(valid, 5))
    p95 = float(np.percentile(valid, 95))
    print(f"  p5={p5:.0f} €/m², p95={p95:.0f} €/m², coverage={len(valid)}/{len(centroids)} cells")

    # ── Write meta JSON ───────────────────────────────────────────────────────
    with open(META_OUT, "w") as f:
        json.dump({"sale_p5": round(p5), "sale_p95": round(p95)}, f)
    print(f"  -> {META_OUT.name}")

    # ── Inject fields into original GeoJSON ───────────────────────────────────
    print("Writing enriched GeoJSON...")
    with open(H3_IN) as f:
        geojson = json.load(f)

    for i, feat in enumerate(geojson["features"]):
        v = sale_eur_m2[i]
        feat["properties"]["sale_eur_m2"] = round(float(v), 2) if not np.isnan(float(v)) else None
        feat["properties"]["sale_src"]    = str(sale_src[i]) if sale_src[i] is not None and sale_src[i] != "None" else None

    with open(H3_OUT, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))  # compact — no whitespace

    null_count = sum(1 for f in geojson["features"] if f["properties"]["sale_eur_m2"] is None)
    barri_count = sum(1 for f in geojson["features"] if f["properties"].get("sale_src") == "barri")
    muni_count  = sum(1 for f in geojson["features"] if f["properties"].get("sale_src") == "muni")
    print(f"  -> {H3_OUT.name}")
    print(f"     barri={barri_count}, muni={muni_count}, null={null_count}")
    print("Done.")


if __name__ == "__main__":
    main()
