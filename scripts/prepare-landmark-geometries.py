#!/usr/bin/env python3
"""
prepare-landmark-geometries.py

Downloads real OSM geometries for City Core Access landmark shapes via curl:
  - montjuic   : Parc de Montjuïc (Nominatim polygon)
  - eixample   : L'Eixample district (Nominatim polygon)
  - waterfront : Barcelona coastline (Overpass natural=coastline)

Output: frontend/public/data/landmark-geometries.json

Usage:
    python3 scripts/prepare-landmark-geometries.py
"""

import json
import os
import subprocess
import time
import urllib.parse

OUTPUT_FILE = "frontend/public/data/landmark-geometries.json"
NOMINATIM   = "https://nominatim.openstreetmap.org"
OVERPASS    = "https://overpass-api.de/api/interpreter"
UA          = "bcn-property-finder/1.0"


def curl_get(url: str) -> bytes:
    result = subprocess.run(
        ["curl", "-s", "-L", "--user-agent", UA, url],
        capture_output=True, check=True,
    )
    return result.stdout


def curl_post(url: str, body: str) -> bytes:
    result = subprocess.run(
        ["curl", "-s", "-L", "--user-agent", UA,
         "-X", "POST", "--data-raw", body, url],
        capture_output=True, check=True,
    )
    return result.stdout


def nominatim_lookup(osm_type: str, osm_id: int) -> dict:
    """Fetch geometry for a known OSM element by type+ID (N/W/R)."""
    params = urllib.parse.urlencode({
        "osm_ids": f"{osm_type}{osm_id}", "polygon_geojson": "1", "format": "json",
    })
    data = json.loads(curl_get(f"{NOMINATIM}/lookup?{params}"))
    if not data:
        raise ValueError(f"No result for {osm_type}{osm_id}")
    geom = data[0].get("geojson", {})
    if geom.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError(f"Got {geom.get('type')} instead of polygon")
    print(f"    ✓ {data[0].get('display_name','')[:90]}")
    return geom


def nominatim_search(query: str) -> dict:
    """Search Nominatim and return first polygon result."""
    params = urllib.parse.urlencode({
        "q": query, "polygon_geojson": "1", "format": "json", "limit": "10",
    })
    results = json.loads(curl_get(f"{NOMINATIM}/search?{params}"))
    for res in results:
        geom = res.get("geojson", {})
        if geom.get("type") in ("Polygon", "MultiPolygon"):
            print(f"    ✓ {res.get('display_name','')[:90]}")
            return geom
    raise ValueError(f"No polygon for '{query}'")


def coastline_linestring(south: float, west: float, north: float, east: float) -> dict:
    """
    Download OSM coastline ways using node IDs for stitching.
    Post-filters to the beach-facing strip (lng >= BEACH_WEST).
    """
    q = f"[out:json][timeout:30];way[\"natural\"=\"coastline\"]({south},{west},{north},{east});out body geom;"
    body = urllib.parse.urlencode({"data": q})
    result = json.loads(curl_post(OVERPASS, body))
    ways = [w for w in result.get("elements", []) if w.get("type") == "way"]
    if not ways:
        raise ValueError("No coastline ways found")
    print(f"    {len(ways)} ways, stitching by node ID...")

    # Node-ID adjacency
    first_of: dict[int, int] = {}  # first_node_id -> way_idx
    last_of:  dict[int, int] = {}  # last_node_id  -> way_idx
    for i, w in enumerate(ways):
        nodes = w.get("nodes", [])
        if len(nodes) >= 2:
            first_of[nodes[0]] = i
            last_of[nodes[-1]]  = i

    # Build all connected chains (follow directed edges by node ID)
    visited: set[int] = set()
    chains: list[list[list[float]]] = []
    for start in range(len(ways)):
        if start in visited:
            continue
        chain: list[list[float]] = []
        idx: int | None = start
        while idx is not None and idx not in visited:
            visited.add(idx)
            w = ways[idx]
            nodes = w.get("nodes", [])
            coords = [[n["lon"], n["lat"]] for n in w.get("geometry", [])]
            chain.extend(coords[1:] if chain else coords)
            nxt = first_of.get(nodes[-1]) if nodes else None
            idx = nxt if (nxt is not None and nxt not in visited) else None
        if chain:
            chains.append(chain)

    # Keep only nodes in the beach strip (exclude Barcelona port / breakwaters)
    BEACH_WEST = 2.187
    filtered = [
        [p for p in c if p[0] >= BEACH_WEST]
        for c in chains
    ]
    filtered = [c for c in filtered if len(c) >= 10]

    if not filtered:
        raise ValueError("No beach-side coastline after filtering")

    # Sort south-to-north, merge
    filtered.sort(key=lambda c: c[0][1])
    merged: list[list[float]] = []
    for c in filtered:
        merged.extend(c)

    # Remove any remaining large jumps (artefacts from chain breaks)
    clean: list[list[float]] = [merged[0]]
    for p in merged[1:]:
        prev = clean[-1]
        if abs(p[0] - prev[0]) < 0.005 and abs(p[1] - prev[1]) < 0.005:
            clean.append(p)
        # else: silently drop the outlier

    print(f"    → {len(clean)} nodes (beach strip, jump-cleaned)")
    return {"type": "LineString", "coordinates": clean}


def main() -> None:
    geometries: dict[str, dict] = {}

    # Montjuïc — OSM relation R1647826 (Parc de Montjuïc)
    print("Montjuïc park (OSM R1647826)...")
    try:
        geometries["montjuic"] = nominatim_lookup("R", 1647826)
    except Exception as e:
        print(f"    lookup failed: {e}, trying search...")
        time.sleep(1.5)
        try:
            geometries["montjuic"] = nominatim_search("Parc de Montjuïc, Barcelona, Spain")
        except Exception as e2:
            print(f"    ERROR: {e2}")
    time.sleep(1.5)

    # Eixample — OSM relation R3008998 (Districte de l'Eixample, Barcelona)
    print("Eixample district (OSM R3008998)...")
    try:
        geometries["eixample"] = nominatim_lookup("R", 3008998)
    except Exception as e:
        print(f"    lookup failed: {e}, trying search...")
        time.sleep(1.5)
        try:
            geometries["eixample"] = nominatim_search("Eixample, Barcelona, Catalonia, Spain")
        except Exception as e2:
            print(f"    ERROR: {e2}")
    time.sleep(1.5)

    # Waterfront — OSM coastline, beaches from Barceloneta to Besòs
    print("Barcelona coastline (Overpass)...")
    try:
        geometries["waterfront"] = coastline_linestring(41.375, 2.183, 41.415, 2.230)
    except Exception as e:
        print(f"    ERROR: {e}")

    with open(OUTPUT_FILE, "w") as f:
        json.dump(geometries, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"\nWrote {len(geometries)} geometries → {OUTPUT_FILE} ({size_kb:.0f} KB)")
    for k, v in geometries.items():
        t = v["type"]
        if t in ("Polygon", "MultiPolygon"):
            n = sum(len(r) for poly in (v["coordinates"] if t == "MultiPolygon" else [v["coordinates"]]) for r in poly)
        elif t == "LineString":
            n = len(v["coordinates"])
        else:
            n = "?"
        print(f"  {k}: {t} ({n} pts)")


if __name__ == "__main__":
    main()
