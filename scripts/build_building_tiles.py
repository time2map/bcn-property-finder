#!/usr/bin/env python3
"""
Map data for the building-level Livability Index (TODO-046, stage 4).

Inputs (stages 1–3): data/buildings/buildings.gpkg, exposure.gpkg, access.gpkg; prices from
data/open-prices/bcn_prices.gpkg; OSM tags from backend/otp/data/barcelona.osm.pbf.

Outputs (frontend/public/data/):
  buildings.pmtiles         layer `b`, feature id = row i. z10–13: centroid points; z14–16: footprints with
                            ref (cadastral ref), floors and h (height in m, for 3D extrusion). No other attributes:
                            the app colours features through feature-state.
  buildings-scores.bin.gz   score inputs per building, one little-endian typed array per column (see meta);
  buildings-positions.bin.gz  lng / lat of each building. Format: scripts/building_blob.py
  buildings-meta.json       columns (name, type, scale, offset, sentinel, file, layout), areas (barri / municipality: code,
                            name, price), price bounds, categories, landmarks, minutes_cap (how far the minutes
                            columns reach, TODO-073)
  buildings-detail.pmtiles  z14 only — layer `d`: one point per building with the card fields;
                            layer `f`: the facade noise points of stage 2
Review: data/buildings/nonresidential.gpkg — buildings left out as clearly not housing, with the reason.

Run: arch -x86_64 .venv-livability/bin/python scripts/build_building_tiles.py
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from building_access import CITY_CORE_MAX_MIN, WALK_MIN_RMAX_M, WALK_SPEED_M_MIN  # noqa: E402
from building_access import OUT_GPKG as ACCESS_GPKG  # noqa: E402
from building_blob import FILES, write_files  # noqa: E402
from building_exposure import OUT_GPKG as EXPOSURE_GPKG  # noqa: E402
from prepare_buildings import CRS, OSM_PBF  # noqa: E402
from prepare_buildings import OUT_GPKG as BUILDINGS_GPKG  # noqa: E402

ROOT = Path(__file__).parent.parent
PUBLIC = ROOT / "frontend" / "public" / "data"
PRICES_GPKG = ROOT / "data" / "open-prices" / "bcn_prices.gpkg"
NONRES_GPKG = BUILDINGS_GPKG.parent / "nonresidential.gpkg"

# Clearly not housing — only ever for buildings with this many dwellings or fewer, and never student residences.
NONRES_MAX_DWELLINGS = int(os.environ.get("NONRES_MAX_DWELLINGS", "2"))
NONRES_MAX_M2_PER_DWELLING = float(os.environ.get("NONRES_MAX_M2_PER_DWELLING", "5000"))
FLOOR_HEIGHT_M = float(os.environ.get("FLOOR_HEIGHT_M", "3"))

# OSM tags of the object itself (not land use: real houses stand in industrial estates).
NONRES_OSM_WHERE = (
    "historic IN ('castle','monastery','fort','church','palace') OR "
    "amenity IN ('school','university','college','hospital','place_of_worship','prison','police','fire_station',"
    "'townhall','courthouse','library','theatre','arts_centre','monastery') OR "
    "tourism IN ('museum','attraction','zoo','theme_park') OR "
    "building IN ('church','cathedral','chapel','school','university','college','hospital','public','civic',"
    "'government','train_station','stadium','museum','castle','monastery','industrial','warehouse','office',"
    "'retail','commercial')"
)
OSM_TAG_COLS = ["historic", "amenity", "tourism", "building"]

U8, U16 = 255, 65535  # sentinels = no data


# ── Rules and joins ──────────────────────────────────────────────────────────
def nonresidential(b, osm_tag):
    """Why each building is clearly not housing (None = keep). b: use, dwellings, area_m2, student."""
    few = (b["dwellings"] <= NONRES_MAX_DWELLINGS) & (b["student"] == 0)
    m2 = b["area_m2"] / b["dwellings"].clip(lower=1)
    reason = np.full(len(b), None, dtype=object)
    reason[(few & (m2 > NONRES_MAX_M2_PER_DWELLING)).values] = "area_per_dwelling"
    osm = pd.Series(osm_tag, index=b.index)
    reason[(few & osm.notna()).values] = ("osm:" + osm[few & osm.notna()]).values
    reason[(few & b["use"].notna() & (b["use"] != "1_residential")).values] = "catastro_use:" + \
        b.loc[few & b["use"].notna() & (b["use"] != "1_residential"), "use"].values
    return reason


def osm_tags_at(points, objects):
    """First non-residential OSM tag of the object each point falls in, or None."""
    out = np.full(len(points), None, dtype=object)
    if len(objects) == 0:
        return out
    pt, obj = shapely.STRtree(objects.geometry.values).query(points, predicate="within")
    tag = objects[OSM_TAG_COLS].bfill(axis=1).iloc[:, 0].values
    out[pt] = tag[obj]
    return out


def assign_areas(points, barris, munis):
    """Barri (Barcelona) or municipality of each point → (area index per point, areas table)."""
    areas = pd.concat([barris.assign(kind="barri"), munis.assign(kind="muni")], ignore_index=True)
    idx = np.full(len(points), -1)
    for kind in ("muni", "barri"):  # barri wins where both match
        sub = areas[areas["kind"] == kind]
        pt, poly = shapely.STRtree(sub.geometry.values).query(points, predicate="within")
        idx[pt] = sub.index.values[poly]
    used = np.unique(idx[idx >= 0])
    remap = np.full(len(areas), -1)
    remap[used] = np.arange(len(used))
    table = areas.loc[used, ["code", "name", "kind", "price"]].reset_index(drop=True)
    return np.where(idx >= 0, remap[np.maximum(idx, 0)], -1), table


def source_dates(files: dict) -> dict:
    """Date each input file was written (YYYY-MM-DD), by data-source id of the app registry (TODO-066).

    The input files are the downloads the fetch scripts produced, so their date is the date the source was fetched.
    A missing file is left out: the app then shows the build date.
    """
    out = {}
    for source_id, path in files.items():
        path = Path(path)
        if path.exists():
            out[source_id] = date.fromtimestamp(path.stat().st_mtime).isoformat()
    return out


def height_m(floors):
    return (pd.to_numeric(floors) * FLOOR_HEIGHT_M).round(1)


def encode(values, kind, scale=1):
    """Column → little-endian typed array; missing values become the sentinel (u8 255, u16 65535, f32 NaN)."""
    v = pd.to_numeric(pd.Series(values), errors="coerce").astype(float).to_numpy() * scale
    if kind == "f32":
        return v.astype("<f4")
    top = U8 if kind == "u8" else U16
    out = np.where(np.isnan(v), top, np.clip(np.round(np.nan_to_num(v)), 0, top - 1))
    return out.astype("<u1" if kind == "u8" else "<u2")


# ── Inputs ───────────────────────────────────────────────────────────────────
def latest_sale_total(row, year_cols):
    """The most recent positive yearly price of a municipality (INCASOL), or None."""
    for col in reversed(year_cols):
        val = row[col]
        if val is not None and not (isinstance(val, float) and np.isnan(val)) and val > 0:
            return float(val)
    return None


def load_areas():
    barri = gpd.read_file(PRICES_GPKG, layer="bcn_sale_barri")
    barri = gpd.GeoDataFrame({"code": barri["BARRI"].astype(str).str.zfill(2), "name": barri["NOM"],
                              "price": barri["sale_total_latest"]}, geometry=barri.geometry.values,
                             crs=barri.crs).to_crs(CRS)
    muni = gpd.read_file(PRICES_GPKG, layer="catalonia_sale_muni")
    years = sorted(c for c in muni.columns if c.startswith("sale_total_"))
    muni = gpd.GeoDataFrame({"code": muni["ine5"].astype(str), "name": muni["NOMMUNI"],
                             "price": muni.apply(lambda r: latest_sale_total(r, years), axis=1)},
                            geometry=muni.geometry.values, crs=muni.crs).to_crs(CRS)
    return barri, muni


def run_tippecanoe(out, layers, minzoom, maxzoom, extra=()):
    cmd = ["tippecanoe", "-q", "-f", "-o", str(out), "-Z", str(minzoom), "-z", str(maxzoom), *extra]
    for name, path in layers:
        cmd += ["-L", f"{name}:{path}"]
    subprocess.run(cmd, check=True)


def write_seq(path, features):
    with open(path, "w") as f:
        for feat in features:
            f.write(json.dumps(feat, separators=(",", ":"), allow_nan=False) + "\n")


def clean(v):
    if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA:
        return None
    return v.item() if hasattr(v, "item") else v


def dwelling_weight(dwellings):
    """Dwellings of each building for the dwelling-weighted ranks and shares (TODO-073); at least 1, so a student
    residence (0 dwellings in Catastro) or a building with no count still counts as one home."""
    d = pd.to_numeric(pd.Series(dwellings), errors="coerce").fillna(0).to_numpy(float)
    return np.maximum(d, 1)


def minutes_cap():
    """How far the minutes columns reach: beyond it a building has no value (TODO-073)."""
    return {"walk": round(WALK_MIN_RMAX_M / WALK_SPEED_M_MIN, 2), "cityCore": CITY_CORE_MAX_MIN}


def main():
    b = gpd.read_file(BUILDINGS_GPKG, layer="buildings")
    e = pyogrio.read_dataframe(EXPOSURE_GPKG, layer="exposure", read_geometry=False)
    a = pyogrio.read_dataframe(ACCESS_GPKG, layer="access", read_geometry=False)
    x = b.merge(e, on="id", how="left").merge(a, on="id", how="left")
    pts = x.representative_point().values

    print("Clearly non-residential…")
    osm = pyogrio.read_dataframe(OSM_PBF, layer="multipolygons", where=NONRES_OSM_WHERE,
                                 columns=OSM_TAG_COLS).to_crs(CRS)
    reason = nonresidential(x, osm_tags_at(pts, osm))
    drop = pd.notna(reason)
    gpd.GeoDataFrame(x.loc[drop, ["id", "address", "use", "dwellings", "area_m2"]].assign(reason=reason[drop]),
                     geometry=x.geometry[drop].values, crs=CRS).to_file(NONRES_GPKG, driver="GPKG")
    print(f"   left out {drop.sum():,} buildings ({x.loc[drop, 'dwellings'].sum():,} dwellings): "
          f"{pd.Series(reason[drop]).str.split(':').str[0].value_counts().to_dict()}")
    x, pts = x[~drop].reset_index(drop=True), pts[~drop]

    print("Areas and prices…")
    area, areas = assign_areas(pts, *load_areas())
    prices = areas["price"].to_numpy(float)[area[area >= 0]]
    prices = prices[~np.isnan(prices)]
    bounds = {"p5": round(float(np.percentile(prices, 5))), "p95": round(float(np.percentile(prices, 95)))}

    cats = [c[len("walk_"):] for c in a.columns if c.startswith("walk_")]
    landmarks = [c[len("cc_"):] for c in a.columns if c.startswith("cc_")]
    ll = gpd.GeoSeries(pts, crs=CRS).to_crs(4326)
    columns = [("lng", "f32", 1, ll.x.values), ("lat", "f32", 1, ll.y.values),
               ("lden_avg", "u16", 10, x["lden_avg"]), ("river_zone", "u16", 1, x["river_zone"]),
               ("street_t10_cm", "u16", 1, x["street_t10_cm"]), ("street_t100_cm", "u16", 1, x["street_t100_cm"]),
               ("fire_hazard", "u16", 1000, x["fire_hazard"]), ("area", "u16", 1, np.where(area >= 0, area, np.nan)),
               ("fire_wui", "u8", 1, x["fire_wui"]), ("year_built", "u16", 1, x["year_built"]),
               # TODO-073: noise is scored on the street side (null = no street side; the app falls back to lden_avg),
               # and ranks and shares are weighted by dwellings.
               ("lden_street", "u16", 10, x["lden_street"]),
               ("dwellings", "u16", 1, dwelling_weight(x["dwellings"]))]
    # Walking minutes to the nearest service of each category (null beyond WALK_MIN_RMAX_M): the services condition
    # of 049 ("everyday services within N min").
    columns += [(f"min_{c}", "u8", 1, x[f"min_{c}"]) for c in cats]
    columns += [(f"cc_{lm}", "u8", 1, x[f"cc_{lm}"]) for lm in landmarks]
    PUBLIC.mkdir(parents=True, exist_ok=True)
    meta = write_files(PUBLIC, [(name, kind, scale, encode(values, kind, scale)) for name, kind, scale, values in columns], {
        "generated": date.today().isoformat(), "count": len(x),
        "sources": source_dates({"catastro": BUILDINGS_GPKG, "osm": ACCESS_GPKG, "flood-aca": EXPOSURE_GPKG,
                                 "wildfire": EXPOSURE_GPKG, "street-flooding": EXPOSURE_GPKG, "prices": PRICES_GPKG}),
        "areas": [{k: clean(v) for k, v in r.items()} for r in areas.to_dict("records")],
        "price_bounds": bounds, "categories": cats, "landmarks": landmarks, "minutes_cap": minutes_cap(),
        "river_zone": "10 / 100 / 500 = ACA return period; sentinel = outside every zone"})
    (PUBLIC / "buildings-meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))

    print("Tiles…")
    wgs = x.to_crs(4326)
    llp = gpd.GeoSeries(pts, crs=CRS).to_crs(4326)
    h = height_m(x["floors"])
    with tempfile.TemporaryDirectory() as tmp:
        seq = os.path.join(tmp, "b.geojsonl")
        write_seq(seq, (
            f for i in range(len(x)) for f in (
                {"type": "Feature", "id": i, "tippecanoe": {"minzoom": 10, "maxzoom": 13}, "properties": {},
                 "geometry": shapely.geometry.mapping(llp.iloc[i])},
                {"type": "Feature", "id": i, "tippecanoe": {"minzoom": 14},
                 "properties": {"ref": x.at[i, "id"], "floors": clean(x.at[i, "floors"]), "h": clean(h.iat[i])},
                 "geometry": shapely.geometry.mapping(wgs.geometry.iat[i])},
            )))
        run_tippecanoe(PUBLIC / "buildings.pmtiles", [("b", seq)], 10, 16,
                       ["--drop-densest-as-needed", "--no-tiny-polygon-reduction"])

        card = ["id", "address", "use", "dwellings", "units", "floors", "floors_below", "year_built", "year_renov",
                "area_m2", "condition", "student", "noise_src", "lden_avg", "ln_avg", "lden_street", "ln_street",
                "lden_inner", "ln_inner", "lden_max", "ln_max", "lden_min", "ln_min", "f17_lden_max", "f17_ln_max",
                "f17_leisure_ln_max", "river_zone", "street_t10_cm", "street_t100_cm", "fire_wui", "fire_class",
                "fire_dist_m"] + [f"min_{c}" for c in cats]
        d = os.path.join(tmp, "d.geojsonl")
        write_seq(d, ({"type": "Feature", "properties": {"i": i, **{k: clean(x.at[i, k]) for k in card}},
                       "geometry": shapely.geometry.mapping(llp.iloc[i])} for i in range(len(x))))
        fac = gpd.read_file(EXPOSURE_GPKG, layer="facades").to_crs(4326)
        index = pd.Series(np.arange(len(x)), index=x["id"])
        fac = fac[fac["id"].isin(index.index)]
        f = os.path.join(tmp, "f.geojsonl")
        write_seq(f, ({"type": "Feature", "properties": {"i": int(index[r.id]), "side": r.side, "dir": r.dir,
                                                         "length_m": clean(r.length_m), "lden": clean(r.lden),
                                                         "ld": clean(r.ld), "le": clean(r.le), "ln": clean(r.ln)},
                       "geometry": shapely.geometry.mapping(r.geometry)} for r in fac.itertuples()))
        run_tippecanoe(PUBLIC / "buildings-detail.pmtiles", [("d", d), ("f", f)], 14, 14,
                       ["--no-feature-limit", "--no-tile-size-limit"])

    for name in ("buildings.pmtiles", *FILES.values(), "buildings-meta.json", "buildings-detail.pmtiles"):
        print(f"→ frontend/public/data/{name}: {(PUBLIC / name).stat().st_size / 1e6:.1f} MB")
    print(f"   {len(x):,} buildings, {len(areas)} areas, price p5/p95 {bounds}")


if __name__ == "__main__":
    main()
