#!/usr/bin/env python3
"""
Climate-risk exposure per H3 cell + view-layer tiles (feature 036).

For every cell of frontend/public/data/livability-h3.geojson compute (sampled at H3 children, like lden_avg):
  - flood_t10 / flood_t100 / flood_t500 : share of cell area (0–1) in ACA river flood zones, forced nested
  - fire_wui    : share of cell area (0–1) in the wildland–urban interface (Protecció Civil, Llei 5/2003)
  - fire_hazard : mean over samples of max_px(class/10 · exp(−d/FIRE_DECAY_M)) over forest pixels
                  (Generalitat wildfire hazard 2024, classes 1–10) within FIRE_SEARCH_RADIUS_M
  - fire_class / fire_dist_m : class and distance of the strongest pixel at the cell centre (detail card)
Risk scores and penalties are computed in the frontend (src/services/climateRisk/climateRisk.ts).

Also builds the view layers:
  frontend/public/data/flood-zones.pmtiles — source-layer `flood` (prop `zone`: t10 | t100 | t500)
  frontend/public/data/wildfire.pmtiles    — source-layers `hazard` (prop `class` 1–10) and `wui`

Inputs come from scripts/fetch_climate_risk.py (data/climate-risk/, gitignored).
All geometry work is done in EPSG:25831 (metres).

Requirements: gdal (gdal_translate, gdal_polygonize.py), tippecanoe; pip install h3 shapely geopandas pyproj numpy
On this machine h3 is an x86_64 wheel, so run python under Rosetta:
  arch -x86_64 python3 scripts/climate_risk.py              # enrich existing grid + build tiles
  arch -x86_64 python3 scripts/climate_risk.py --tiles-only # rebuild only the view-layer tiles
  arch -x86_64 python3 -m unittest scripts/test_climate_risk.py
prepare-livability-grid.py calls enrich_grid() so a full grid rebuild keeps the fields.
"""

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass

import h3
import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, box
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRID_PATH = os.path.join(ROOT, "frontend/public/data/livability-h3.geojson")
FLOOD_TILES_OUT = os.path.join(ROOT, "frontend/public/data/flood-zones.pmtiles")
WILDFIRE_TILES_OUT = os.path.join(ROOT, "frontend/public/data/wildfire.pmtiles")

CLIMATE_RISK_DIR = os.path.join(ROOT, os.environ.get("CLIMATE_RISK_DIR", "data/climate-risk"))
FLOOD_GPKG = os.path.join(CLIMATE_RISK_DIR, "flood_catalonia.gpkg")
FIRE_GPKG = os.path.join(CLIMATE_RISK_DIR, "fire_catalonia.gpkg")
FIRE_TIF = os.path.join(CLIMATE_RISK_DIR, "fire_hazard_2024.tif")
BCN_GPKG = os.path.join(CLIMATE_RISK_DIR, "flood_bcn.gpkg")  # barri polygons for calibration stats only

FLOOD_LAYERS = {"t10": "aca_flood_zone_t10", "t100": "aca_flood_zone_t100", "t500": "aca_flood_zone_t500"}
WUI_LAYER = "pcivil_fire_wui_zone"
FIRE_NODATA = 15

# Sample resolution defaults to grid resolution + 2 (~49 points per res-9 cell), like NOISE_SAMPLE_RES.
CLIMATE_SAMPLE_RES = os.environ.get("CLIMATE_SAMPLE_RES")
FIRE_SEARCH_RADIUS_M = float(os.environ.get("FIRE_SEARCH_RADIUS_M", "500"))
FIRE_DECAY_M = float(os.environ.get("FIRE_DECAY_M", "150"))
# Margin around the grid when clipping inputs, so edge cells still see nearby forest.
CLIP_MARGIN_M = FIRE_SEARCH_RADIUS_M + 500

_TO_METRIC = Transformer.from_crs("EPSG:4326", "EPSG:25831", always_xy=True)


def to_metric(lat, lng):
    """WGS84 lat/lng → EPSG:25831 (x, y) in metres."""
    return _TO_METRIC.transform(lng, lat)


def cell_samples(cell, sample_res):
    """Child-cell centroids of `cell` at `sample_res`, as metric (x, y)."""
    return [to_metric(*h3.cell_to_latlng(c)) for c in h3.cell_to_children(cell, sample_res)]


# ── Flood ────────────────────────────────────────────────────────────────────
def zone_share(samples, zone):
    """Share of sample points covered by a prepared geometry (0 when zone is None)."""
    if zone is None or not samples:
        return 0.0
    return sum(1 for x, y in samples if zone.covers(Point(x, y))) / len(samples)


def flood_shares(samples, zones):
    """Area shares in T10/T100/T500 zones, forced nested (T10 ⊆ T100 ⊆ T500)."""
    t10 = zone_share(samples, zones.get("t10"))
    t100 = max(zone_share(samples, zones.get("t100")), t10)
    t500 = max(zone_share(samples, zones.get("t500")), t100)
    return {"flood_t10": round(t10, 3), "flood_t100": round(t100, 3), "flood_t500": round(t500, 3)}


# ── Wildfire ─────────────────────────────────────────────────────────────────
@dataclass
class Forest:
    tree: STRtree
    xs: np.ndarray
    ys: np.ndarray
    classes: np.ndarray


def make_forest(points_xy, classes):
    """Forest pixel centres (metric x, y) with hazard class 1–10, indexed for radius queries."""
    xs = np.array([p[0] for p in points_xy], dtype=float)
    ys = np.array([p[1] for p in points_xy], dtype=float)
    return Forest(STRtree([Point(x, y) for x, y in points_xy]), xs, ys, np.array(classes, dtype=int))


def pixel_hazard(x, y, forest, radius_m, decay_m):
    """Strongest distance-decayed hazard class/10 · exp(−d/decay) within radius → (value, class, dist)."""
    if len(forest.classes) == 0:
        return 0.0, None, None
    idx = forest.tree.query(Point(x, y).buffer(radius_m, quad_segs=4))
    if len(idx) == 0:
        return 0.0, None, None
    d = np.hypot(forest.xs[idx] - x, forest.ys[idx] - y)
    ok = d <= radius_m
    if not ok.any():
        return 0.0, None, None
    idx, d = idx[ok], d[ok]
    contrib = forest.classes[idx] / 10.0 * np.exp(-d / decay_m)
    best = int(np.argmax(contrib))
    return float(contrib[best]), int(forest.classes[idx[best]]), float(d[best])


def forest_polygons(forest, pixel_m=100):
    """Forest pixels → one dissolved (Multi)Polygon per hazard class: [(class, geometry)].

    Pure-shapely replacement for gdal_polygonize (GDAL Python bindings are not installed here).
    """
    half = pixel_m / 2
    out = []
    for cls in sorted(set(int(c) for c in forest.classes)):
        m = forest.classes == cls
        squares = [box(x - half, y - half, x + half, y + half) for x, y in zip(forest.xs[m], forest.ys[m])]
        out.append((cls, unary_union(squares)))
    return out


def fire_exposure(samples, centre_xy, wui, forest, radius_m, decay_m):
    """WUI share + mean decayed forest hazard over samples; class/distance of the strongest pixel at the centre.

    The WUI gate (fireRisk = fire_wui · fire_hazard) is applied in the frontend, so urban-park pixels
    outside the WUI keep their hazard value here but carry no risk.
    """
    hazard = [pixel_hazard(x, y, forest, radius_m, decay_m)[0] for x, y in samples] if samples else [0.0]
    _, cls, dist = pixel_hazard(*centre_xy, forest, radius_m, decay_m)
    return {
        "fire_wui": round(zone_share(samples, wui), 3),
        "fire_hazard": round(float(np.mean(hazard)), 3),
        "fire_class": cls,
        "fire_dist_m": None if dist is None else int(round(dist)),
    }


# ── Grid enrichment ──────────────────────────────────────────────────────────
@dataclass
class ClimateInputs:
    zones: dict  # {"t10" | "t100" | "t500": prepared geometry}
    wui: object  # prepared geometry
    forest: Forest


CLIMATE_FIELDS = ("flood_t10", "flood_t100", "flood_t500", "fire_wui", "fire_hazard", "fire_class", "fire_dist_m")


def enrich_with_climate(features, inputs, sample_res, radius_m=FIRE_SEARCH_RADIUS_M, decay_m=FIRE_DECAY_M):
    """Inject climate fields into grid features in-place. inputs=None → all fields null (no penalty)."""
    for n, feat in enumerate(features):
        props = feat["properties"]
        if inputs is None:
            props.update({k: None for k in CLIMATE_FIELDS})
            continue
        cell = props["h3"]
        samples = cell_samples(cell, sample_res)
        centre = to_metric(*h3.cell_to_latlng(cell))
        props.update(flood_shares(samples, inputs.zones))
        props.update(fire_exposure(samples, centre, inputs.wui, inputs.forest, radius_m, decay_m))
        if (n + 1) % 1000 == 0:
            print(f"   {n + 1}/{len(features)} cells")


def grid_bounds_metric(features, margin_m=CLIP_MARGIN_M):
    """Metric bbox (minx, miny, maxx, maxy) of the grid cells plus a margin."""
    xs, ys = [], []
    for f in features:
        for lng, lat in f["geometry"]["coordinates"][0]:
            x, y = to_metric(lat, lng)
            xs.append(x)
            ys.append(y)
    return min(xs) - margin_m, min(ys) - margin_m, max(xs) + margin_m, max(ys) + margin_m


def _read_union(gpkg, layer, bounds):
    import geopandas as gpd

    gdf = gpd.read_file(gpkg, layer=layer, bbox=bounds).to_crs(25831)
    return gdf.geometry.union_all() if len(gdf) else None


def _clip_raster(bounds, dst):
    minx, miny, maxx, maxy = bounds
    subprocess.run(["gdal_translate", "-q", "-projwin", str(minx), str(maxy), str(maxx), str(miny),
                    FIRE_TIF, dst], check=True)


def load_forest(bounds):
    """Forest pixel centres (class 1–10) of the hazard raster within bounds."""
    with tempfile.TemporaryDirectory() as tmp:
        clip = os.path.join(tmp, "clip.tif")
        _clip_raster(bounds, clip)
        out = subprocess.run(["gdal_translate", "-q", "-of", "XYZ", clip, "/vsistdout/"],
                             check=True, capture_output=True, text=True).stdout
    pts, classes = [], []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        v = int(float(parts[2]))
        if 1 <= v <= 10:
            pts.append((float(parts[0]), float(parts[1])))
            classes.append(v)
    return make_forest(pts, classes)


def load_inputs(bounds):
    """Loads flood zones, WUI and forest pixels clipped to bounds, or None when data is missing."""
    missing = [p for p in (FLOOD_GPKG, FIRE_GPKG, FIRE_TIF) if not os.path.exists(p)]
    if missing:
        print(f"   Climate-risk inputs missing ({', '.join(missing)}) — fields will be null.", file=sys.stderr)
        return None
    print("Loading flood zones…")
    zones = {}
    for key, layer in FLOOD_LAYERS.items():
        g = _read_union(FLOOD_GPKG, layer, bounds)
        zones[key] = prep(g) if g is not None else None
    print("Loading WUI zone…")
    wui = _read_union(FIRE_GPKG, WUI_LAYER, bounds)
    print("Loading forest hazard pixels…")
    forest = load_forest(bounds)
    print(f"   forest pixels: {len(forest.classes)}")
    return ClimateInputs(zones=zones, wui=prep(wui) if wui is not None else None, forest=forest)


def enrich_grid(features, h3_res):
    """Entry point used by prepare-livability-grid.py."""
    sample_res = int(CLIMATE_SAMPLE_RES) if CLIMATE_SAMPLE_RES else h3_res + 2
    inputs = load_inputs(grid_bounds_metric(features))
    print(f"Scoring climate exposure (sample res {sample_res}, radius {FIRE_SEARCH_RADIUS_M:.0f} m, "
          f"decay {FIRE_DECAY_M:.0f} m)…")
    enrich_with_climate(features, inputs, sample_res)
    return inputs is not None


# ── View layers (PMTiles) ────────────────────────────────────────────────────
def _write_geojson(gdf, path):
    gdf.to_crs(4326).to_file(path, driver="GeoJSON")


def build_view_tiles(features):
    """Flood zones + wildfire hazard/WUI clipped to the grid → PMTiles for the map layers."""
    import geopandas as gpd
    import pandas as pd

    bounds = grid_bounds_metric(features, margin_m=0)
    with tempfile.TemporaryDirectory() as tmp:
        print("Building flood-zones.pmtiles…")
        parts = []
        for key, layer in FLOOD_LAYERS.items():
            gdf = gpd.read_file(FLOOD_GPKG, layer=layer, bbox=bounds).to_crs(25831)
            if len(gdf):
                g = gdf.geometry.union_all().simplify(5)
                parts.append(gpd.GeoDataFrame({"zone": [key]}, geometry=[g], crs=25831))
        flood = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=25831).explode(index_parts=False)
        flood_json = os.path.join(tmp, "flood.geojson")
        _write_geojson(flood, flood_json)
        _tippecanoe(FLOOD_TILES_OUT, [("flood", flood_json)])

        print("Building wildfire.pmtiles…")
        polys = forest_polygons(load_forest(bounds))
        hz = gpd.GeoDataFrame({"class": [c for c, _ in polys]}, geometry=[g for _, g in polys], crs=25831)
        hz = hz.explode(index_parts=False)
        hazard_json = os.path.join(tmp, "hazard.geojson")
        _write_geojson(hz[["class", "geometry"]], hazard_json)
        wui = gpd.read_file(FIRE_GPKG, layer=WUI_LAYER, bbox=bounds).to_crs(25831)
        wui = gpd.GeoDataFrame(geometry=[wui.geometry.union_all().simplify(5)], crs=25831).explode(index_parts=False)
        wui_json = os.path.join(tmp, "wui.geojson")
        _write_geojson(wui, wui_json)
        _tippecanoe(WILDFIRE_TILES_OUT, [("hazard", hazard_json), ("wui", wui_json)])


def _tippecanoe(out, layers):
    cmd = ["tippecanoe", "--output", out, "--minimum-zoom", "9", "--maximum-zoom", "15", "--force",
           "--no-tile-size-limit", "--detect-shared-borders"]
    for name, path in layers:
        cmd += ["-L", f"{name}:{path}"]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"   -> {os.path.basename(out)} ({os.path.getsize(out) // 1024} KB)")


# ── Calibration stats ────────────────────────────────────────────────────────
def print_stats(features):
    """Share of cells touched by each hazard, split Barcelona / rest of the grid."""
    import geopandas as gpd

    bcn = None
    if os.path.exists(BCN_GPKG):
        bcn = prep(gpd.read_file(BCN_GPKG, layer="bcn_resccue_property_damage_barri").to_crs(25831).union_all())
    groups = {"Barcelona": [], "Rest of grid": []}
    for f in features:
        p = f["properties"]
        x, y = to_metric(*h3.cell_to_latlng(p["h3"]))
        in_bcn = bcn is not None and bcn.covers(Point(x, y))
        groups["Barcelona" if in_bcn else "Rest of grid"].append(p)
    for name, ps in groups.items():
        if not ps or ps[0].get("flood_t500") is None:
            continue
        n = len(ps)
        pct = lambda cond: 100 * sum(1 for p in ps if cond(p)) / n  # noqa: E731
        fire = [p["fire_wui"] * p["fire_hazard"] for p in ps]
        print(f"   {name}: {n} cells | T10 {pct(lambda p: p['flood_t10'] > 0):.1f}% · "
              f"T100 {pct(lambda p: p['flood_t100'] > 0):.1f}% · T500 {pct(lambda p: p['flood_t500'] > 0):.1f}% | "
              f"WUI {pct(lambda p: p['fire_wui'] > 0):.1f}% | fire exposure p50/p90/max "
              f"{np.percentile(fire, 50):.2f}/{np.percentile(fire, 90):.2f}/{max(fire):.2f}")


def main():
    if not os.path.exists(GRID_PATH):
        sys.exit(f"Grid not found: {GRID_PATH} — run prepare-livability-grid.py first")
    with open(GRID_PATH) as f:
        grid = json.load(f)
    features = grid["features"]
    if "--tiles-only" not in sys.argv:
        h3_res = h3.get_resolution(features[0]["properties"]["h3"])
        if not enrich_grid(features, h3_res):
            sys.exit("Climate-risk inputs missing — run scripts/fetch_climate_risk.py first")
        with open(GRID_PATH, "w") as f:
            json.dump(grid, f, separators=(",", ":"))
        print(f"   -> {os.path.basename(GRID_PATH)} ({os.path.getsize(GRID_PATH) // 1024} KB)")
    build_view_tiles(features)
    print("\nCalibration:")
    print_stats(features)


if __name__ == "__main__":
    main()
