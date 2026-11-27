#!/usr/bin/env python3
"""
Walkability and City Core access per residential building on the OSM walking network (TODO-046, stage 3).

Inputs:
  data/buildings/buildings.gpkg       residential buildings + entrances   scripts/prepare_buildings.py
  backend/otp/data/barcelona.osm.pbf  walking network and services (the extract OTP and feature 010 use)

Output: data/buildings/access.gpkg, table `access` (no geometry), one row per building:
  walk               0–100, feature-010 formula with every category on
  walk_<category>    0–100 per category, so the frontend can recompute walk for the categories a user keeps
  min_<category>     walking minutes to the nearest one (null beyond WALK_MIN_RMAX_M)
  cc_<landmark>      walking minutes to each City Core landmark (021), null beyond CITY_CORE_MAX_MIN
  origin, snap_m     where the walk starts (first entrance, or centroid) and its distance to the network

Distances are walking metres on the network, not straight lines; formulas are unchanged otherwise.
Parks and beaches are reached at their edge (boundary points), not their centre.

Requires pandana in the venv (arch -x86_64 .venv-livability/bin/pip install pandana).
Run: arch -x86_64 .venv-livability/bin/python scripts/building_access.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandana
import pandas as pd
import pyogrio
import shapely
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_poi import (  # noqa: E402
    BEACH_WHERE, MIN_PARK_AREA_M2, OSMCONF, PARK_WHERE, POI_WHERE, SCHOOL_WHERE, centroid,
)
from prepare_buildings import OSM_PBF  # noqa: E402
from prepare_buildings import OUT_GPKG as BUILDINGS_GPKG  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT_GPKG = BUILDINGS_GPKG.parent / "access.gpkg"
CRS = "EPSG:25831"

# Walkability = distance-decay + per-category saturation (feature 010). MUST match the frontend constants in
# src/services/walkability/walkabilityScore.ts and serviceCategories.ts:
#   access_c = Σ exp(-d/D0) over objects with d ≤ RMAX ; sub_c = 1 - exp(-access_c/S_c)
#   walk = 100 * Σ(w_c·sub_c) / Σ w_c
WALK_DECAY_M = float(os.environ.get("WALK_DECAY_M", "400"))  # walking metres
WALK_RMAX_M = float(os.environ.get("WALK_RMAX_M", "1500"))
# How far the minutes to the nearest service (min_<category>) reach (TODO-073). The app's services slider goes to
# 15 min and a service scores 0 at twice the limit, so the minutes must reach 30 min (2,400 m at 80 m/min); with the
# old 1,500 m (19 min) a service 19 min away scored 73 and one a little further 0. The walk_* scores keep WALK_RMAX_M.
WALK_MIN_RMAX_M = float(os.environ.get("WALK_MIN_RMAX_M", "2400"))

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

# City Core landmarks (feature 021); ids and order mirror src/services/cityCore/landmarks.ts.
LANDMARKS: list[dict] = [
    {"id": "sagrada",       "name": "Sagrada Família",    "type": "point", "lat": 41.4036, "lng": 2.1744},
    {"id": "placa_cat",     "name": "Plaça de Catalunya", "type": "point", "lat": 41.3870, "lng": 2.1700},
    {"id": "barceloneta",   "name": "Barceloneta beach",  "type": "point", "lat": 41.3799, "lng": 2.1910},
    {"id": "barri_gotic",   "name": "Barri Gòtic",        "type": "point", "lat": 41.3840, "lng": 2.1762},
    {"id": "pg_gracia",     "name": "Passeig de Gràcia",  "type": "point", "lat": 41.3917, "lng": 2.1649},
    {"id": "arc_triomf",    "name": "Arc de Triomf",      "type": "point", "lat": 41.3909, "lng": 2.1805},
    # Montjuïc — polygon of the hill/park: reached at its edge, 0 from inside.
    {"id": "montjuic", "name": "Montjuïc", "type": "polygon", "coords": [
        [2.1490, 41.3770], [2.1620, 41.3760], [2.1700, 41.3640],
        [2.1680, 41.3510], [2.1620, 41.3440], [2.1480, 41.3430],
        [2.1380, 41.3500], [2.1350, 41.3620], [2.1390, 41.3720],
        [2.1490, 41.3770],  # closing vertex
    ]},
    {"id": "placa_espanya", "name": "Plaça d'Espanya",    "type": "point", "lat": 41.3754, "lng": 2.1489},
    {"id": "glories",       "name": "Torre Glòries",      "type": "point", "lat": 41.4034, "lng": 2.1899},
    {"id": "poblenou",      "name": "Rambla del Poblenou","type": "point", "lat": 41.3975, "lng": 2.2011},
    {"id": "parc_guell",    "name": "Parc Güell",         "type": "point", "lat": 41.4145, "lng": 2.1527},
    # Eixample — rectangular polygon approximation of L'Eixample district.
    # Bounded by Diagonal (N), Gran Via (S), Urgell area (W), Marina area (E).
    {"id": "eixample", "name": "Eixample", "type": "polygon", "coords": [
        [2.1500, 41.3950], [2.1870, 41.3950], [2.1870, 41.3790],
        [2.1500, 41.3790], [2.1500, 41.3950],  # closing vertex
    ]},
    # Barcelona waterfront — LineString from Besòs mouth to Barceloneta.
    # Distance to nearest point on the coastline.
    {"id": "waterfront", "name": "Waterfront", "type": "line", "coords": [
        [2.2279, 41.4106], [2.2200, 41.4065], [2.2090, 41.4015],
        [2.2010, 41.3975], [2.1965, 41.3950], [2.1925, 41.3910],
        [2.1918, 41.3880], [2.1910, 41.3799],
    ]},
]


WALK_K_NEAREST = int(os.environ.get("WALK_K_NEAREST", "30"))
# Slowly saturating categories (S ≥ 3: cafes, restaurants) keep adding up on busy streets; K = 120 is within
# 1 point of K = 240 at p99 (measured 2026-11-03), K = 30 was up to 14 points short.
WALK_K_DENSE = int(os.environ.get("WALK_K_DENSE", "120"))
WALK_SPEED_M_MIN = float(os.environ.get("WALK_SPEED_M_MIN", "80"))  # 4.8 km/h, as 010 / 021
WALK_BOUNDARY_STEP_M = float(os.environ.get("WALK_BOUNDARY_STEP_M", "50"))
NETWORK_MAX_EDGE_M = float(os.environ.get("NETWORK_MAX_EDGE_M", "25"))  # node spacing along streets
NETWORK_MARGIN_M = float(os.environ.get("NETWORK_MARGIN_M", "2000"))  # network kept around the buildings
# 120: the City Core slider goes to 60 min and a place scores 0 at twice the limit (TODO-073).
CITY_CORE_MAX_MIN = float(os.environ.get("CITY_CORE_MAX_MIN", "120"))

WALKABLE = {"footway", "pedestrian", "path", "steps", "living_street", "residential", "service", "unclassified",
            "track", "cycleway", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary",
            "primary_link", "trunk", "trunk_link", "corridor"}
WALK_OSMCONF = """
closed_ways_are_polygons=aeroway,amenity,boundary,building,landuse,leisure,natural
[lines]
osm_id=no
attributes=highway,foot,access
other_tags=no
"""


# ── Graph ────────────────────────────────────────────────────────────────────
def walkable(ways):
    """OSM ways a pedestrian may use: walkable highway types, minus foot=no and private access."""
    allowed_foot = ways["foot"].isin(["yes", "designated", "permissive"])
    closed = ways["access"].isin(["no", "private"]) & ~allowed_foot
    return ways["highway"].isin(WALKABLE) & (ways["foot"] != "no") & ~closed


def build_graph(lines, max_edge_m=np.inf):
    """Walking graph from line geometries (metres) → (nodes: x, y; edges: from, to, weight).

    Nodes are line ends, vertices shared by two or more lines (OSM shares a node there, so the
    coordinates are identical) and, along each line, a vertex every ~max_edge_m — so a door in the middle
    of a block snaps to a node next to it, not to the corner. Other vertices are folded into the edge
    length. A bridge that crosses a street without a shared vertex stays unconnected.
    """
    if np.isfinite(max_edge_m):
        lines = shapely.segmentize(lines, max_edge_m)
    coords, line = shapely.get_coordinates(lines, return_index=True)
    _, vid = np.unique(np.round(coords, 3), axis=0, return_inverse=True)
    vid = vid.ravel()
    uses = np.bincount(np.unique(np.stack([vid, line], axis=1), axis=0)[:, 0])
    first = np.r_[True, line[1:] != line[:-1]]
    last = np.r_[line[1:] != line[:-1], True]

    same = line[1:] == line[:-1]
    cum = np.r_[0.0, np.cumsum(np.where(same, np.hypot(*np.diff(coords, axis=0).T), 0.0))]
    along = cum - cum[np.maximum.accumulate(np.where(first, np.arange(len(line)), 0))]
    bucket = np.floor(along / max_edge_m) if np.isfinite(max_edge_m) else np.zeros(len(line))
    spaced = np.r_[False, same & (bucket[1:] != bucket[:-1])]
    k = np.flatnonzero((uses[vid] >= 2) | first | last | spaced)
    a, b = k[:-1], k[1:]
    keep = (line[a] == line[b]) & (vid[a] != vid[b])
    a, b = a[keep], b[keep]

    node_vid, inv = np.unique(vid[k], return_inverse=True)
    position = dict(zip(node_vid, range(len(node_vid))))
    xy = coords[k][np.unique(inv, return_index=True)[1]]
    nodes = pd.DataFrame({"x": xy[:, 0], "y": xy[:, 1]})
    edges = pd.DataFrame({"from": [position[v] for v in vid[a]], "to": [position[v] for v in vid[b]],
                          "weight": cum[b] - cum[a]})
    return nodes, edges


def largest_component(nodes, edges):
    """Keep the biggest connected piece; a building snapped to an island would get infinite distances."""
    n = len(nodes)
    m = coo_matrix((np.ones(len(edges)), (edges["from"], edges["to"])), shape=(n, n))
    _, label = connected_components(m, directed=False)
    keep = label == np.bincount(label).argmax()
    return nodes[keep], edges[keep[edges["from"].values] & keep[edges["to"].values]]


def load_network(tmp, bounds):
    """pandana network of the walkable ways within bounds (metres, EPSG:25831) plus NETWORK_MARGIN_M."""
    conf = os.path.join(tmp, "walk.ini")
    with open(conf, "w") as f:
        f.write(WALK_OSMCONF)
    path = os.path.join(tmp, "ways.gpkg")
    run(["ogr2ogr", "-f", "GPKG", path, str(OSM_PBF), "lines", "-where", "highway IS NOT NULL"],
        {"OSM_CONFIG_FILE": conf})
    ways = gpd.read_file(path).to_crs(CRS)
    minx, miny, maxx, maxy = bounds
    m = NETWORK_MARGIN_M
    ways = ways.cx[minx - m:maxx + m, miny - m:maxy + m]
    ways = ways[walkable(ways)]
    nodes, edges = largest_component(*build_graph(ways.geometry.values, NETWORK_MAX_EDGE_M))
    print(f"   {len(ways):,} walkable ways → {len(nodes):,} nodes, {len(edges):,} edges (largest component)")
    return pandana.Network(nodes["x"], nodes["y"], edges["from"], edges["to"], edges[["weight"]], twoway=True)


# ── Scores ───────────────────────────────────────────────────────────────────
def category_score(dist, saturation, decay_m=WALK_DECAY_M, rmax_m=WALK_RMAX_M):
    """Feature-010 sub-score 0–1 from each origin's nearest distances (rows; NaN or ≥ rmax = none)."""
    d = np.where(np.isnan(dist) | (dist >= rmax_m), np.inf, dist)
    access = np.exp(-d / decay_m).sum(axis=1)
    return 1 - np.exp(-access / saturation)


def walk_score(subs, weights, enabled=None):
    """walk 0–100 from per-category sub-scores 0–100, over the enabled categories — the frontend's formula."""
    cats = [c for c in subs if enabled is None or c in enabled]
    total = sum(weights[c] for c in cats)
    return np.round(sum(np.asarray(subs[c], float) * weights[c] for c in cats) / total).astype(int)


def dedupe_nearest(dist, obj):
    """Keep only the nearest sample of each object per row (a park reached through several edge points)."""
    out = dist.copy()
    for j in range(1, dist.shape[1]):
        dup = (obj[:, :j] == obj[:, j:j + 1]).any(axis=1)
        out[dup, j] = np.nan
    return out


def to_minutes(dist_m, speed_m_min=WALK_SPEED_M_MIN, max_min=CITY_CORE_MAX_MIN):
    """Walking minutes; null when unknown or beyond max_min."""
    d = np.asarray(dist_m, float)
    d = np.where(np.isfinite(d) & (d < max_min * speed_m_min), d, np.nan)
    return pd.array(np.round(d / speed_m_min), dtype="Int64")


def inside(polygon, origins):
    return origins.within(polygon).values


def boundary_points(polygons, step_m=WALK_BOUNDARY_STEP_M):
    """Points every step_m along each polygon's boundary, with the polygon's position as `obj`."""
    parts, owner = shapely.get_parts(shapely.boundary(polygons), return_index=True)
    n = np.maximum(1, (shapely.length(parts) // step_m).astype(int))
    line = np.repeat(np.arange(len(parts)), n)
    dist = (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)) * step_m
    xy = shapely.get_coordinates(shapely.line_interpolate_point(parts[line], dist))
    return pd.DataFrame({"x": xy[:, 0], "y": xy[:, 1], "obj": owner[line]})


# ── Inputs ───────────────────────────────────────────────────────────────────
def run(cmd, env=None):
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)


def osm_env(tmp):
    osmconf = os.path.join(tmp, "osmconf.ini")
    with open(osmconf, "w") as f:
        f.write(OSMCONF)
    return {"OSM_CONFIG_FILE": osmconf}


def load_pois(tmp):
    """Service points (feature 010 extraction) as (lng, lat, categories); school grounds count by centroid.
    Parks and beaches are reached at their edge instead (load_services)."""
    env = osm_env(tmp)
    poi_pts = os.path.join(tmp, "poi.geojson")
    schools = os.path.join(tmp, "schools.geojson")
    print("Extracting POIs from PBF…")
    run(["ogr2ogr", "-f", "GeoJSON", poi_pts, str(OSM_PBF), "points", "-where", POI_WHERE], env)
    run(["ogr2ogr", "-f", "GeoJSON", schools, str(OSM_PBF), "multipolygons", "-where", SCHOOL_WHERE], env)

    with open(poi_pts) as f:
        feats = json.load(f)["features"]
    # school polygons may carry amenity=school or kindergarten — keep the original amenity
    with open(schools) as f:
        for feat in json.load(f)["features"]:
            amenity = feat["properties"].get("amenity")
            g = feat["geometry"]
            if amenity not in ("school", "kindergarten") or g["type"] not in ("Polygon", "MultiPolygon"):
                continue
            coords = g["coordinates"] if g["type"] == "Polygon" else g["coordinates"][0]
            feats.append({"geometry": {"type": "Point", "coordinates": centroid(coords)},
                          "properties": {"amenity": amenity}})

    pois = []
    for feat in feats:
        cats = frozenset(cid for cid, (pred, _s, _w) in CATEGORIES.items() if pred(feat["properties"]))
        if cats:
            lng, lat = feat["geometry"]["coordinates"]
            pois.append((lng, lat, cats))
    print(f"   {len(pois)} categorised POIs")
    return pois


def load_services(tmp):
    """{category: DataFrame x, y, obj}. Points and schools as in feature 010; parks and beaches as edge points."""
    pois = [p for p in load_pois(tmp) if not p[2] & {"park", "beach"}]
    pts = gpd.GeoSeries(gpd.points_from_xy([p[0] for p in pois], [p[1] for p in pois]), crs=4326).to_crs(CRS)
    out = {}
    for cat in CATEGORIES:
        m = np.array([cat in p[2] for p in pois])
        out[cat] = pd.DataFrame({"x": pts.x.values[m], "y": pts.y.values[m], "obj": np.arange(m.sum())})
    for cat, where, min_area in (("park", PARK_WHERE, MIN_PARK_AREA_M2), ("beach", BEACH_WHERE, 0)):
        path = os.path.join(tmp, f"{cat}.gpkg")
        run(["ogr2ogr", "-f", "GPKG", path, str(OSM_PBF), "multipolygons", "-where", where], osm_env(tmp))
        g = gpd.read_file(path).to_crs(CRS)
        g = g[g.area >= min_area]
        out[cat] = boundary_points(g.geometry.values)
        print(f"   {cat}: {len(g):,} areas → {len(out[cat]):,} edge points")
    return out


# Barris far from the sea: no building there may be within walking range of a beach (found 2026-11-14,
# when a paved pool deck tagged natural=beach put them next to one).
INLAND_BARRI_IDS = {"barri-0845": "Porta", "barri-0960": "Sant Andreu", "barri-0852": "la Prosperitat"}
AREAS_GEOJSON = ROOT / "frontend" / "public" / "data" / "areas.geojson"


def inland_beach_violations(origins, walk_beach, areas):
    """{barri name: buildings with walk_beach > 0} for the inland control barris (areas: GeoDataFrame, CRS of origins)."""
    bad = {}
    for _, a in areas[areas["id"].isin(INLAND_BARRI_IDS)].iterrows():
        n = int(((walk_beach > 0) & inside(a.geometry, origins)).sum())
        if n:
            bad[INLAND_BARRI_IDS[a["id"]]] = n
    return bad


def landmark_geometry(lm):
    to = lambda pts: gpd.GeoSeries(gpd.points_from_xy(*zip(*pts)), crs=4326).to_crs(CRS)  # noqa: E731
    if lm["type"] == "point":
        return to([(lm["lng"], lm["lat"])]).iloc[0]
    xy = [(p.x, p.y) for p in to(lm["coords"])]
    return shapely.Polygon(xy) if lm["type"] == "polygon" else shapely.LineString(xy)


def load_origins(buildings, entrances):
    """First entrance of each building, or its centroid."""
    first = entrances.drop_duplicates("id").set_index("id").geometry
    g = buildings.set_index("id")
    pt = first.reindex(g.index)
    has = pt.notna()
    pt[~has] = g.geometry[~has].centroid
    return gpd.GeoSeries(pt.values, index=g.index, crs=CRS), np.where(has, "entrance", "centroid")


def nearest(net, nodes, name, pois, k, maxdist):
    """Distances (rows = nodes, k columns) and POI positions from pandana."""
    net.set_pois(name, maxdist, k, pd.Series(pois["x"].values), pd.Series(pois["y"].values))
    r = net.nearest_pois(maxdist, name, num_pois=k, include_poi_ids=True).loc[nodes]
    d = r[list(range(1, k + 1))].to_numpy(float, copy=True)
    d[d >= maxdist] = np.nan
    ids = r[[f"poi{i}" for i in range(1, k + 1)]].to_numpy(float)
    return d, ids


def main():
    buildings = gpd.read_file(BUILDINGS_GPKG, layer="buildings", columns=["id"])
    entrances = gpd.read_file(BUILDINGS_GPKG, layer="entrances", columns=["id"])
    origins, origin_kind = load_origins(buildings, entrances)

    with tempfile.TemporaryDirectory() as tmp:
        print("Walking network…")
        net = load_network(tmp, buildings.total_bounds)
        print("Services…")
        services = load_services(tmp)

    node = net.get_node_ids(pd.Series(origins.x.values), pd.Series(origins.y.values)).values
    nxy = net.nodes_df.loc[node, ["x", "y"]].to_numpy()
    out = pd.DataFrame(index=origins.index)
    out["origin"] = origin_kind
    out["snap_m"] = np.hypot(origins.x.values - nxy[:, 0], origins.y.values - nxy[:, 1]).round(1)

    print("Walkability…")
    subs = {}
    for cat, (_pred, saturation, _w) in CATEGORIES.items():
        pois = services[cat]
        k = WALK_K_DENSE if saturation >= 3 else WALK_K_NEAREST
        if cat in ("park", "beach"):
            k *= 4  # several edge points per area; deduped below
        # One query to the farther of the two radii: category_score ignores what lies beyond WALK_RMAX_M.
        d, ids = nearest(net, node, f"walk_{cat}", pois, k, max(WALK_RMAX_M, WALK_MIN_RMAX_M))
        if cat in ("park", "beach"):
            obj = np.where(np.isnan(ids), np.nan, pois["obj"].to_numpy(float)[np.nan_to_num(ids).astype(int)])
            d = dedupe_nearest(d, obj)
        subs[cat] = category_score(d, saturation) * 100
        out[f"walk_{cat}"] = np.round(subs[cat]).astype(int)
        out[f"min_{cat}"] = to_minutes(np.nanmin(np.where(np.isnan(d), np.inf, d), axis=1),
                                       max_min=WALK_MIN_RMAX_M / WALK_SPEED_M_MIN)
    out.insert(0, "walk", walk_score(subs, {c: w for c, (_p, _s, w) in CATEGORIES.items()}))

    print("City Core…")
    maxdist = CITY_CORE_MAX_MIN * WALK_SPEED_M_MIN
    for lm in LANDMARKS:
        geom = landmark_geometry(lm)
        if lm["type"] == "point":
            pois = pd.DataFrame({"x": [geom.x], "y": [geom.y]})
        elif lm["type"] == "polygon":
            pois = boundary_points(np.array([geom]))
        else:
            xy = shapely.get_coordinates(shapely.line_interpolate_point(
                geom, np.arange(0, geom.length, WALK_BOUNDARY_STEP_M)))
            pois = pd.DataFrame({"x": xy[:, 0], "y": xy[:, 1]})
        d, _ = nearest(net, node, f"cc_{lm['id']}", pois, 1, maxdist)
        minutes = to_minutes(d[:, 0])
        if lm["type"] == "polygon":
            minutes[inside(geom, origins)] = 0
        out[f"cc_{lm['id']}"] = minutes

    if AREAS_GEOJSON.exists():
        bad = inland_beach_violations(origins, out["walk_beach"].to_numpy(), gpd.read_file(AREAS_GEOJSON).to_crs(CRS))
        if bad:
            raise SystemExit(f"Inland barris score as near a beach (check natural=beach data): {bad}")

    OUT_GPKG.unlink(missing_ok=True)
    pyogrio.write_dataframe(out.reset_index(), OUT_GPKG, layer="access", driver="GPKG")
    print(f"→ {OUT_GPKG.relative_to(ROOT)}: {len(out):,} buildings")
    print(f"   origin: {pd.Series(origin_kind).value_counts().to_dict()}, snap_m p50/p95 "
          f"{out['snap_m'].median():.0f}/{out['snap_m'].quantile(0.95):.0f}")
    print(f"   walk p10/p50/p90: {out['walk'].quantile([0.1, 0.5, 0.9]).tolist()}")
    print("   City Core null share:", json.dumps({c: round(out[c].isna().mean(), 3)
                                                  for c in out if c.startswith("cc_")}))


if __name__ == "__main__":
    main()
