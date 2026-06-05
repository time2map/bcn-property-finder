#!/usr/bin/env python3
"""
prepare-city-core-access.py

Pre-computes walking times from each H3 cell centroid to each Barcelona city-core
landmark using haversine (straight-line) distance with an urban tortuosity correction.

Supports three landmark geometry types:
  - "point"   : point-to-point haversine
  - "polygon" : distance to nearest point on polygon boundary (0 if cell centroid is inside)
  - "line"    : distance to nearest point on a LineString

All geometry uses a flat-earth projection (accurate to <0.1% over Barcelona's extent).
No external dependencies required.

Walking model:
  - Speed:      4.8 km/h  (80 m/min, typical unhurried pedestrian)
  - Tortuosity: 1.35      (urban street network detour factor for Barcelona)
  - Formula:    minutes = distance_km * TORTUOSITY / WALK_SPEED_KMH * 60

Usage:
    python3 scripts/prepare-city-core-access.py
"""

import json
import math
import os

INPUT_GRID  = "frontend/public/data/livability-h3.geojson"
OUTPUT_FILE = "frontend/public/data/city-core-access.geojson"

WALK_SPEED_KMH = 4.8    # km/h — standard pedestrian speed
TORTUOSITY     = 1.35   # Barcelona urban street-network factor
MAX_MINUTES    = 90     # cells beyond this threshold stored as null

# Flat-earth projection constants for Barcelona (~41.39°N)
_REF_LAT_RAD   = math.radians(41.39)
KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LNG = 111.320 * math.cos(_REF_LAT_RAD)  # ≈ 83.47 km/deg


def to_xy_km(lat: float, lng: float) -> tuple[float, float]:
    """Project (lat, lng) to approximate local (x, y) in km."""
    return (lng * KM_PER_DEG_LNG, lat * KM_PER_DEG_LAT)


LANDMARKS: list[dict] = [
    {"id": "sagrada",       "name": "Sagrada Família",    "type": "point", "lat": 41.4036, "lng": 2.1744},
    {"id": "placa_cat",     "name": "Plaça de Catalunya", "type": "point", "lat": 41.3870, "lng": 2.1700},
    {"id": "barceloneta",   "name": "Barceloneta beach",  "type": "point", "lat": 41.3799, "lng": 2.1910},
    {"id": "barri_gotic",   "name": "Barri Gòtic",        "type": "point", "lat": 41.3840, "lng": 2.1762},
    {"id": "pg_gracia",     "name": "Passeig de Gràcia",  "type": "point", "lat": 41.3917, "lng": 2.1649},
    {"id": "arc_triomf",    "name": "Arc de Triomf",      "type": "point", "lat": 41.3909, "lng": 2.1805},
    # Montjuïc — polygon of the hill/park. Distance to nearest boundary edge
    # (0 if cell centroid falls inside the polygon).
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


# ---------------------------------------------------------------------------
# Geometry helpers (pure Python, no external deps)
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _seg_dist_km(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    """Minimum distance from point P to segment AB (all coordinates in km)."""
    dx, dy = bx - ax, by - ay
    seg_sq = dx * dx + dy * dy
    if seg_sq == 0.0:
        return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_sq))
    return math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2)


def _point_in_polygon(px: float, py: float, ring: list[tuple[float, float]]) -> bool:
    """Ray-casting point-in-polygon test (flat coordinates)."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > py) != (yj > py):
            if px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def _preprocess_geometry(lm: dict) -> None:
    """Convert GeoJSON [lng, lat] coords to XY-km ring/pts (cached on the dict)."""
    if "_xy" in lm:
        return
    lm["_xy"] = [to_xy_km(lat, lng) for lng, lat in lm["coords"]]


def min_km_to_polygon(clat: float, clng: float, lm: dict) -> float:
    _preprocess_geometry(lm)
    ring = lm["_xy"]
    px, py = to_xy_km(clat, clng)
    if _point_in_polygon(px, py, ring):
        return 0.0
    n = len(ring)
    return min(_seg_dist_km(px, py, ring[i][0], ring[i][1], ring[i+1][0], ring[i+1][1])
               for i in range(n - 1))


def min_km_to_linestring(clat: float, clng: float, lm: dict) -> float:
    _preprocess_geometry(lm)
    pts = lm["_xy"]
    px, py = to_xy_km(clat, clng)
    n = len(pts)
    return min(_seg_dist_km(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])
               for i in range(n - 1))


# ---------------------------------------------------------------------------
# Walking-time converters
# ---------------------------------------------------------------------------

def km_to_minutes(km: float) -> int | None:
    minutes = km * TORTUOSITY / WALK_SPEED_KMH * 60
    if minutes > MAX_MINUTES:
        return None
    return max(0, round(minutes))


def landmark_minutes(clat: float, clng: float, lm: dict) -> int | None:
    if lm["type"] == "point":
        km = haversine_km(clat, clng, lm["lat"], lm["lng"])
        mins = km_to_minutes(km)
        return max(1, mins) if mins is not None else None
    elif lm["type"] == "polygon":
        return km_to_minutes(min_km_to_polygon(clat, clng, lm))
    elif lm["type"] == "line":
        return km_to_minutes(min_km_to_linestring(clat, clng, lm))
    else:
        raise ValueError(f"Unknown landmark type: {lm['type']}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def centroid(coords: list) -> tuple[float, float]:
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def main() -> None:
    print(f"Loading grid from {INPUT_GRID}...")
    with open(INPUT_GRID) as f:
        grid = json.load(f)
    cells = grid["features"]
    print(f"  {len(cells)} cells.")

    cell_centroids: list[tuple[float, float]] = []
    for feature in cells:
        ring = feature["geometry"]["coordinates"][0]
        cx, cy = centroid(ring)
        cell_centroids.append((cy, cx))  # (lat, lng)

    output_features = []
    for i, feature in enumerate(cells):
        clat, clng = cell_centroids[i]
        props: dict = {"h3": feature["properties"]["h3"]}
        for lm in LANDMARKS:
            props[lm["id"]] = landmark_minutes(clat, clng, lm)
        output_features.append({
            "type": "Feature",
            "geometry": feature["geometry"],
            "properties": props,
        })
        if (i + 1) % 1000 == 0:
            print(f"  processed {i + 1}/{len(cells)} cells...")

    output = {"type": "FeatureCollection", "features": output_features}
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT_FILE) / 1e6
    print(f"\nWrote {len(output_features)} features to {OUTPUT_FILE} ({size_mb:.1f} MB)")

    # Spot-checks
    print("\n--- Spot-checks ---")
    pg = next(lm for lm in LANDMARKS if lm["id"] == "pg_gracia")
    mins = landmark_minutes(41.430, 2.175, pg)
    print(f"  Montbau → Passeig de Gràcia: {mins} min (Google Maps: ~75 min)")

    badal_lat, badal_lng = 41.3769, 2.1376
    print(f"\n  Badal spot-check (all {len(LANDMARKS)} landmarks):")
    total = 0
    for lm in LANDMARKS:
        m = landmark_minutes(badal_lat, badal_lng, lm)
        print(f"    {lm['id']:16s}: {str(m):6s} min")
        total += m if m is not None else 0
    print(f"  Average (null→0): {total / len(LANDMARKS):.1f}")


if __name__ == "__main__":
    main()
