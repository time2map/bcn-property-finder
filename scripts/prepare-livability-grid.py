#!/usr/bin/env python3
"""
Build the static H3 livability grid.

For every H3 cell covering Barcelona + AMB (from frontend/public/data/areas.geojson) compute:
  - walk        : walkability index 0-100 (feature 010)
  - lden        : area-average noise level (dB) sampled across H3 child cells (feature 009)
  - sale_eur_m2 : open market sale price €/m² — barri level, muni fallback (INCASOL data)
  - sale_src    : 'barri' | 'muni' | null
  - flood_* / fire_* : climate-risk exposure (feature 036, see scripts/climate_risk.py)

Outputs:
  frontend/public/data/livability-h3.geojson   — one hexagon polygon per cell
  frontend/public/data/open-price-meta.json    — p5/p95 bounds for price normalisation

Requirements:
  brew install gdal
  pip install h3 shapely geopandas numpy

Usage:
  LIVABILITY_H3_RES=9 python3 scripts/prepare-livability-grid.py
"""

import json
import math
import os
import re
import subprocess
import sys
import tempfile

import geopandas as gpd
import h3
import numpy as np
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

# Reuse POI extraction constants/helpers from the feature-010 script (no duplication of OSM config).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_poi import (  # noqa: E402
    OSMCONF,
    POI_WHERE,
    PARK_WHERE,
    BEACH_WHERE,
    SCHOOL_WHERE,
    MIN_PARK_AREA_M2,
    centroid,
    polygon_area_m2,
)
import climate_risk  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREAS_PATH = os.path.join(ROOT, "frontend/public/data/areas.geojson")
PBF_PATH = os.path.join(ROOT, "backend/otp/data/barcelona.osm.pbf")
NOISE_GPKG = os.path.join(ROOT, "data/noise/2022_Isofones_Total_Lden_BCN.gpkg")
NOISE_GEOJSON = os.path.join(ROOT, "data/noise/noise-isophones-tmp.geojson")
NOISE_LAYER = "2022_Isofones_Total_Lden_Mapa_Estrategic_Soroll_BCN"
PRICES_GPKG = os.path.join(ROOT, "data/open-prices/bcn_prices.gpkg")
OUTPUT_PATH = os.path.join(ROOT, "frontend/public/data/livability-h3.geojson")
PRICES_META_OUT = os.path.join(ROOT, "frontend/public/data/open-price-meta.json")

H3_RES = int(os.environ.get("LIVABILITY_H3_RES", "9"))
# Sub-sampling resolution for noise: child cells at this resolution are used to compute a
# weighted average Lden across the hex area instead of a single centroid sample.
# Default H3_RES+2 → ~49 sample points per cell at ~26 m spacing (for base res 9).
NOISE_SAMPLE_RES = int(os.environ.get("NOISE_SAMPLE_RES", str(H3_RES + 2)))

# Walkability = distance-decay + per-category saturation. MUST match the frontend constants in
# src/services/walkability/walkabilityScore.ts and serviceCategories.ts:
#   access_c = Σ exp(-d/D0) over objects with d ≤ RMAX ; sub_c = 1 - exp(-access_c/S_c)
#   walk = 100 * Σ(w_c·sub_c) / Σ w_c
WALK_DECAY_M = float(os.environ.get("WALK_DECAY_M", "400"))
WALK_RMAX_M = float(os.environ.get("WALK_RMAX_M", "1500"))

# (match predicate, saturation S, weight w) — mirrors serviceCategories.ts.
CATEGORIES = {
    "supermarket": (lambda p: p.get("shop") == "supermarket", 1.0, 1),
    "pharmacy": (lambda p: p.get("amenity") == "pharmacy", 0.8, 1),
    "park": (lambda p: p.get("leisure") == "park", 1.2, 1),
    "school": (lambda p: p.get("amenity") == "school", 1.0, 1),
    "kindergarten": (lambda p: p.get("amenity") == "kindergarten", 1.0, 1),
    "clinic": (lambda p: p.get("amenity") in ("doctors", "clinic"), 0.8, 1),
    "metro": (lambda p: p.get("station") == "subway", 0.7, 1),
    "cafe": (lambda p: p.get("amenity") == "cafe", 3.0, 1),
    "restaurant": (lambda p: p.get("amenity") == "restaurant", 3.0, 1),
    "beach": (lambda p: p.get("natural") == "beach", 0.6, 1),
}
TOTAL_WEIGHT = sum(w for _, _, w in CATEGORIES.values())


def run(cmd, env=None):
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Coverage → H3 cells ──────────────────────────────────────────────────────
def coverage_cells():
    with open(AREAS_PATH) as f:
        fc = json.load(f)
    cells = set()
    for feat in fc["features"]:
        geom = feat["geometry"]
        polys = (
            [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        )
        for rings in polys:
            outer = rings[0]  # [lng, lat]; holes ignored (barris rarely have them)
            try:
                poly = h3.LatLngPoly([(lat, lng) for lng, lat in outer])
                cells |= set(h3.h3shape_to_cells(poly, H3_RES))
            except Exception as e:  # noqa: BLE001
                print(f"   skip ring ({e})", file=sys.stderr)
    return cells


# ── POI extraction (reuses feature-010 ogr2ogr config) ───────────────────────
def load_pois(tmp):
    osmconf = os.path.join(tmp, "osmconf.ini")
    with open(osmconf, "w") as f:
        f.write(OSMCONF)
    env = {"OSM_CONFIG_FILE": osmconf}

    poi_pts = os.path.join(tmp, "poi.geojson")
    parks = os.path.join(tmp, "parks.geojson")
    beaches = os.path.join(tmp, "beaches.geojson")
    schools = os.path.join(tmp, "schools.geojson")

    print("Extracting POIs from PBF…")
    run(["ogr2ogr", "-f", "GeoJSON", poi_pts, PBF_PATH, "points", "-where", POI_WHERE], env)
    run(["ogr2ogr", "-f", "GeoJSON", parks, PBF_PATH, "multipolygons", "-where", PARK_WHERE], env)
    run(["ogr2ogr", "-f", "GeoJSON", beaches, PBF_PATH, "multipolygons", "-where", BEACH_WHERE], env)
    run(["ogr2ogr", "-f", "GeoJSON", schools, PBF_PATH, "multipolygons", "-where", SCHOOL_WHERE], env)

    feats = []
    with open(poi_pts) as f:
        feats += json.load(f)["features"]

    def add_centroids(path, tag_key, tag_val, min_area=0):
        with open(path) as f:
            for feat in json.load(f)["features"]:
                g = feat["geometry"]
                coords = (
                    g["coordinates"]
                    if g["type"] == "Polygon"
                    else g["coordinates"][0]
                    if g["type"] == "MultiPolygon"
                    else None
                )
                if coords is None:
                    continue
                if min_area and polygon_area_m2(coords) < min_area:
                    continue
                feats.append({
                    "geometry": {"type": "Point", "coordinates": centroid(coords)},
                    "properties": {tag_key: tag_val},
                })

    add_centroids(parks, "leisure", "park", MIN_PARK_AREA_M2)
    add_centroids(beaches, "natural", "beach")
    # schools polygons may carry amenity=school or kindergarten — keep the original amenity
    with open(schools) as f:
        for feat in json.load(f)["features"]:
            amenity = feat["properties"].get("amenity")
            if amenity not in ("school", "kindergarten"):
                continue
            g = feat["geometry"]
            coords = (
                g["coordinates"]
                if g["type"] == "Polygon"
                else g["coordinates"][0]
                if g["type"] == "MultiPolygon"
                else None
            )
            if coords is None:
                continue
            feats.append({
                "geometry": {"type": "Point", "coordinates": centroid(coords)},
                "properties": {"amenity": amenity},
            })

    # Reduce each POI to (lng, lat, frozenset of category ids it satisfies).
    pois = []
    for feat in feats:
        props = feat["properties"]
        cats = frozenset(cid for cid, (pred, _s, _w) in CATEGORIES.items() if pred(props))
        if not cats:
            continue
        lng, lat = feat["geometry"]["coordinates"]
        pois.append((lng, lat, cats))
    print(f"   {len(pois)} categorised POIs")
    return pois


# ── Noise polygons (reuses feature-009 Rang→lden parsing) ────────────────────
def rang_to_lden(rang):
    if not rang:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)", rang)
    if m:
        return (float(m.group(1)) + float(m.group(2))) / 2.0
    m = re.search(r"<\s*(\d+(?:\.\d+)?)", rang)
    if m:
        return float(m.group(1)) - 2.5
    m = re.search(r"[>≥]\s*=?\s*(\d+(?:\.\d+)?)", rang)
    if m:
        return float(m.group(1)) + 2.5
    return None


def load_noise(tmp):
    if not os.path.exists(NOISE_GEOJSON):
        if not os.path.exists(NOISE_GPKG):
            print("   No noise data found — lden will be null for all cells.", file=sys.stderr)
            return None
        print("Converting noise GPKG → GeoJSON…")
        raw = os.path.join(tmp, "noise_raw.geojson")
        run([
            "ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:4326", "-select", "Rang",
            "-lco", "COORDINATE_PRECISION=5", raw, NOISE_GPKG, NOISE_LAYER,
        ])
        with open(raw) as f:
            src = json.load(f)
        out = []
        for feat in src["features"]:
            lden = rang_to_lden(feat["properties"].get("Rang", ""))
            if lden is None:
                continue
            out.append({"type": "Feature", "geometry": feat["geometry"], "properties": {"lden": lden}})
        os.makedirs(os.path.dirname(NOISE_GEOJSON), exist_ok=True)
        with open(NOISE_GEOJSON, "w") as f:
            json.dump({"type": "FeatureCollection", "features": out}, f, separators=(",", ":"))

    print("Loading noise polygons…")
    with open(NOISE_GEOJSON) as f:
        feats = json.load(f)["features"]
    geoms = [shape(f["geometry"]) for f in feats]
    ldens = [f["properties"]["lden"] for f in feats]
    tree = STRtree(geoms)
    print(f"   {len(geoms)} noise polygons indexed")
    return tree, geoms, ldens


def lden_at(noise, lng, lat):
    if noise is None:
        return None
    tree, geoms, ldens = noise
    pt = Point(lng, lat)
    for i in tree.query(pt):
        if geoms[i].covers(pt):
            return ldens[i]
    return None


def lden_avg(noise, cell, sample_res):
    """Return area-average Lden by sampling at H3 child centroids at sample_res.

    Smooths boundary artefacts for hexes that straddle a noise-isophone edge.
    Returns None when the cell has no noise coverage at any sample point.
    """
    if noise is None:
        return None
    samples = []
    for child in h3.cell_to_children(cell, sample_res):
        clat, clng = h3.cell_to_latlng(child)
        v = lden_at(noise, clng, clat)
        if v is not None:
            samples.append(v)
    if not samples:
        return None
    return sum(samples) / len(samples)


def _latest_sale_total(row, year_cols):
    for col in reversed(year_cols):
        val = row[col]
        if val is not None and not (isinstance(val, float) and np.isnan(val)) and val > 0:
            return float(val)
    return None


def enrich_with_prices(features):
    """Inject sale_eur_m2 / sale_src into features in-place; write open-price-meta.json."""
    if not os.path.exists(PRICES_GPKG):
        print("   Price GPKG not found — sale_eur_m2 will be null for all cells.", file=sys.stderr)
        for f in features:
            f["properties"]["sale_eur_m2"] = None
            f["properties"]["sale_src"] = None
        return

    print("Loading price data…")
    barri = gpd.read_file(PRICES_GPKG, layer="bcn_sale_barri")[["geometry", "sale_total_latest"]]
    barri = barri[barri["sale_total_latest"].notna()].to_crs(epsg=4326)

    muni_raw = gpd.read_file(PRICES_GPKG, layer="catalonia_sale_muni")
    total_cols = sorted(c for c in muni_raw.columns if c.startswith("sale_total_"))
    muni_raw["_latest"] = muni_raw.apply(lambda r: _latest_sale_total(r, total_cols), axis=1)
    muni = muni_raw[["geometry", "_latest"]].rename(columns={"_latest": "sale_total_latest"})
    muni = muni[muni["sale_total_latest"].notna()].to_crs(epsg=4326)

    # Build centroid GeoDataFrame directly from H3 cell IDs (no file I/O needed).
    cent_pts = []
    for f in features:
        clat, clng = h3.cell_to_latlng(f["properties"]["h3"])
        cent_pts.append(Point(clng, clat))
    centroids = gpd.GeoDataFrame(geometry=cent_pts, crs="EPSG:4326")

    print("Spatial join → barri…")
    j_barri = gpd.sjoin(centroids[["geometry"]], barri, how="left", predicate="within")
    barri_price = j_barri["sale_total_latest"].values.astype(float)

    no_barri = np.isnan(barri_price)
    print(f"   Cells without barri match: {no_barri.sum()}")
    muni_price = np.full(len(features), np.nan)
    if no_barri.sum() > 0:
        print("Spatial join → municipality (fallback)…")
        j_muni = gpd.sjoin(centroids[no_barri][["geometry"]], muni, how="left", predicate="within")
        if "sale_total_latest" in j_muni.columns:
            muni_price[no_barri] = j_muni["sale_total_latest"].values.astype(float)

    sale = np.where(~no_barri, barri_price, muni_price)
    src = np.where(~no_barri, "barri", np.where(~np.isnan(muni_price), "muni", None))

    valid = sale[~np.isnan(sale)]
    p5  = float(np.percentile(valid, 5))
    p95 = float(np.percentile(valid, 95))
    print(f"   p5={p5:.0f} €/m², p95={p95:.0f} €/m², coverage={len(valid)}/{len(features)} cells")

    with open(PRICES_META_OUT, "w") as f:
        json.dump({"sale_p5": round(p5), "sale_p95": round(p95)}, f)
    print(f"   -> {os.path.basename(PRICES_META_OUT)}")

    for i, feat in enumerate(features):
        v = sale[i]
        feat["properties"]["sale_eur_m2"] = round(float(v), 2) if not np.isnan(v) else None
        feat["properties"]["sale_src"] = str(src[i]) if src[i] not in (None, "None") else None

    null_c  = sum(1 for f in features if f["properties"]["sale_eur_m2"] is None)
    barri_c = sum(1 for f in features if f["properties"].get("sale_src") == "barri")
    muni_c  = sum(1 for f in features if f["properties"].get("sale_src") == "muni")
    print(f"   barri={barri_c}, muni={muni_c}, null={null_c}")


def main():
    if not os.path.exists(AREAS_PATH):
        sys.exit(f"areas.geojson not found: {AREAS_PATH}")
    if not os.path.exists(PBF_PATH):
        sys.exit(f"PBF not found: {PBF_PATH}")

    print(f"H3 resolution: {H3_RES}")
    cells = coverage_cells()
    print(f"Coverage: {len(cells)} H3 cells")

    with tempfile.TemporaryDirectory() as tmp:
        pois = load_pois(tmp)
        noise = load_noise(tmp)

        # Spatial index of POIs for fast per-cell neighbourhood queries.
        poi_pts = [Point(lng, lat) for lng, lat, _ in pois]
        poi_tree = STRtree(poi_pts)

        # Degree padding for the bbox query (refined by haversine + RMAX afterwards).
        pad = WALK_RMAX_M / 111000 * 1.2

        print("Scoring cells…")
        features = []
        for n, cell in enumerate(cells):
            lat, lng = h3.cell_to_latlng(cell)
            access = {cid: 0.0 for cid in CATEGORIES}
            box = Point(lng, lat).buffer(pad, quad_segs=1)
            for i in poi_tree.query(box):
                plng, plat, cats = pois[i]
                d = haversine_m(lat, lng, plat, plng)
                if d > WALK_RMAX_M:
                    continue
                contrib = math.exp(-d / WALK_DECAY_M)
                for c in cats:
                    access[c] += contrib
            sub_scores: dict[str, int] = {}
            weighted = 0.0
            for cid, (_pred, s, w) in CATEGORIES.items():
                sub = 1 - math.exp(-access[cid] / s)
                sub_scores[cid] = round(sub * 100)
                weighted += sub * w
            walk = round(weighted / TOTAL_WEIGHT * 100)
            lden = lden_avg(noise, cell, NOISE_SAMPLE_RES)

            boundary = h3.cell_to_boundary(cell)  # [(lat, lng), …]
            ring = [[lng2, lat2] for lat2, lng2 in boundary]
            ring.append(ring[0])
            features.append({
                "type": "Feature",
                "properties": {
                    "h3": cell,
                    "walk": walk,
                    "lden": lden,
                    **{f"walk_{cid}": sub_scores[cid] for cid in CATEGORIES},
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            })
            if (n + 1) % 1000 == 0:
                print(f"   {n + 1}/{len(cells)} cells")

        print("\nEnriching with market prices…")
        enrich_with_prices(features)

        print("\nEnriching with climate-risk exposure…")
        climate_risk.enrich_grid(features, H3_RES)

        with open(OUTPUT_PATH, "w") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) // 1024
    print(f"\nDone. {OUTPUT_PATH} ({size_kb} KB, {len(features)} cells)")


if __name__ == "__main__":
    main()
