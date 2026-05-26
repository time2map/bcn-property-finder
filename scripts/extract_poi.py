#!/usr/bin/env python3
"""
Extract POI data from the Barcelona OSM PBF and build barcelona_poi.pmtiles.

Requirements:
  brew install gdal tippecanoe

Usage:
  python3 scripts/extract_poi.py
"""

import json
import math
import os
import subprocess
import sys
import tempfile

PBF_PATH = "backend/otp/data/barcelona.osm.pbf"
OUTPUT_PATH = "frontend/public/barcelona_poi.pmtiles"

# Minimum park area to include (m²). Filters out tiny garden patches.
MIN_PARK_AREA_M2 = 5000  # 0.5 ha

OSMCONF = """
closed_ways_are_polygons=aeroway,amenity,boundary,building,craft,geological,historic,landuse,leisure,military,natural,office,place,shop,sport,tourism

[points]
osm_id=yes
attributes=name,amenity,shop,leisure,station,railway,highway,public_transport,natural
unsignificant=created_by,converted_by,source,time,ele,attribution
ignore=created_by,converted_by,source,time,note,fixme,FIXME
other_tags=no

[lines]
osm_id=yes
attributes=name,highway,waterway
ignore=created_by,converted_by,source,time,note,fixme,FIXME
other_tags=no

[multipolygons]
osm_id=yes
osm_way_id=yes
attributes=name,amenity,shop,leisure,landuse,natural
ignore=created_by,converted_by,source,time,note,fixme,FIXME
other_tags=no

[multilinestrings]
osm_id=yes
attributes=name
other_tags=no

[other_relations]
osm_id=yes
other_tags=no
"""

# POI point nodes (subway_entrance excluded — station=subway gives one node per station)
POI_WHERE = (
    "amenity IN ('pharmacy','doctors','clinic','cafe','restaurant','kindergarten','school') "
    "OR shop='supermarket' OR station='subway' OR natural='beach'"
)

PARK_WHERE = "leisure='park' OR landuse='recreation_ground'"
BEACH_WHERE = "natural='beach'"
SCHOOL_WHERE = "amenity IN ('school', 'kindergarten')"


def run(cmd: list[str], env: dict | None = None) -> None:
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)


def centroid(coords: list) -> list[float]:
    pts = coords[0]
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]


def polygon_area_m2(coords: list) -> float:
    """Approximate geodetic area (shoelace formula) in m²."""
    ring = coords[0]
    n = len(ring)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += ring[i][0] * ring[j][1]
        area -= ring[j][0] * ring[i][1]
    area = abs(area) / 2
    lat_rad = sum(p[1] for p in ring) / n * math.pi / 180
    return area * (111320 * math.cos(lat_rad)) * 111320


def polygon_centroids(features: list, tag_key: str, tag_val: str) -> list[dict]:
    """Convert polygon features to centroid point features with a single tag."""
    result = []
    for feat in features:
        geom = feat["geometry"]
        try:
            if geom["type"] == "Polygon":
                coords = geom["coordinates"]
            elif geom["type"] == "MultiPolygon":
                coords = geom["coordinates"][0]
            else:
                continue
            yield_feat = {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": centroid(coords)},
                "properties": {
                    "osm_id": feat["properties"].get("osm_id"),
                    "name": feat["properties"].get("name"),
                    tag_key: tag_val,
                },
            }
            result.append(yield_feat)
        except Exception:
            pass
    return result


def main() -> None:
    if not os.path.exists(PBF_PATH):
        print(f"PBF not found: {PBF_PATH}", file=sys.stderr)
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp:
        osmconf_path = os.path.join(tmp, "osmconf.ini")
        with open(osmconf_path, "w") as f:
            f.write(OSMCONF)

        poi_points   = os.path.join(tmp, "poi_points.geojson")
        parks_poly   = os.path.join(tmp, "parks_poly.geojson")
        beach_poly   = os.path.join(tmp, "beach_poly.geojson")
        school_poly  = os.path.join(tmp, "school_poly.geojson")
        merged       = os.path.join(tmp, "merged.geojson")

        print("1/5 Extracting POI nodes...")
        run(
            ["ogr2ogr", "-f", "GeoJSON", poi_points, PBF_PATH, "points", "-where", POI_WHERE],
            env={"OSM_CONFIG_FILE": osmconf_path},
        )

        print("2/5 Extracting park polygons...")
        run(
            ["ogr2ogr", "-f", "GeoJSON", parks_poly, PBF_PATH, "multipolygons", "-where", PARK_WHERE],
            env={"OSM_CONFIG_FILE": osmconf_path},
        )

        print("3/5 Extracting beach polygons...")
        run(
            ["ogr2ogr", "-f", "GeoJSON", beach_poly, PBF_PATH, "multipolygons", "-where", BEACH_WHERE],
            env={"OSM_CONFIG_FILE": osmconf_path},
        )

        print("3b/5 Extracting school/kindergarten polygons...")
        run(
            ["ogr2ogr", "-f", "GeoJSON", school_poly, PBF_PATH, "multipolygons", "-where", SCHOOL_WHERE],
            env={"OSM_CONFIG_FILE": osmconf_path},
        )

        print("4/5 Computing centroids, filtering parks by area, merging...")
        with open(poi_points) as f:
            pois = json.load(f)
        with open(parks_poly) as f:
            parks = json.load(f)
        with open(beach_poly) as f:
            beaches = json.load(f)
        with open(school_poly) as f:
            schools_poly = json.load(f)

        # Park centroids — filter by minimum area
        park_feats: list[dict] = []
        skipped_parks = 0
        for feat in parks["features"]:
            geom = feat["geometry"]
            try:
                if geom["type"] == "Polygon":
                    coords = geom["coordinates"]
                elif geom["type"] == "MultiPolygon":
                    coords = geom["coordinates"][0]
                else:
                    continue
                area = polygon_area_m2(coords)
                if area < MIN_PARK_AREA_M2:
                    skipped_parks += 1
                    continue
                park_feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": centroid(coords)},
                    "properties": {
                        "osm_id": feat["properties"].get("osm_id"),
                        "name": feat["properties"].get("name"),
                        "leisure": "park",
                    },
                })
            except Exception:
                pass
        print(f"   Parks: {len(park_feats)} kept, {skipped_parks} filtered (< {MIN_PARK_AREA_M2} m²)")

        # Beach centroids
        beach_feats: list[dict] = []
        for feat in beaches["features"]:
            geom = feat["geometry"]
            try:
                if geom["type"] == "Polygon":
                    coords = geom["coordinates"]
                elif geom["type"] == "MultiPolygon":
                    coords = geom["coordinates"][0]
                else:
                    continue
                beach_feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": centroid(coords)},
                    "properties": {
                        "osm_id": feat["properties"].get("osm_id"),
                        "name": feat["properties"].get("name"),
                        "natural": "beach",
                    },
                })
            except Exception:
                pass
        print(f"   Beaches: {len(beach_feats)}")

        # School / kindergarten polygon centroids
        # Deduplicate vs nodes already in pois (match by osm_id from osm_way_id field)
        point_node_ids = {
            str(f["properties"].get("osm_id"))
            for f in pois["features"]
        }
        school_feats: list[dict] = []
        for feat in schools_poly["features"]:
            props = feat["properties"]
            amenity_val = props.get("amenity")
            if amenity_val not in ("school", "kindergarten"):
                continue
            # Skip if already present as a node (way_id may match a node osm_id)
            way_id = str(props.get("osm_way_id") or props.get("osm_id") or "")
            if way_id and way_id in point_node_ids:
                continue
            geom = feat["geometry"]
            try:
                if geom["type"] == "Polygon":
                    coords = geom["coordinates"]
                elif geom["type"] == "MultiPolygon":
                    coords = geom["coordinates"][0]
                else:
                    continue
                school_feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": centroid(coords)},
                    "properties": {
                        "osm_id": way_id or None,
                        "name": props.get("name"),
                        "amenity": amenity_val,
                    },
                })
            except Exception:
                pass
        print(f"   Schools/kindergartens (polygons): {len(school_feats)}")

        merged_feats = pois["features"] + park_feats + beach_feats + school_feats
        merged_geojson = {"type": "FeatureCollection", "features": merged_feats}
        with open(merged, "w") as f:
            json.dump(merged_geojson, f)

        print(f"   Total: {len(pois['features'])} nodes + {len(park_feats)} parks + {len(beach_feats)} beaches + {len(school_feats)} school/kinder polys = {len(merged_feats)}")

        print(f"5/5 Building PMTiles → {OUTPUT_PATH}")
        run([
            "tippecanoe",
            "-o", OUTPUT_PATH,
            "-Z14", "-z14",
            "-l", "poi",
            "--no-tile-size-limit",
            "--no-feature-limit",
            "--no-tile-compression",
            "--force",
            merged,
        ])

    size_kb = os.path.getsize(OUTPUT_PATH) // 1024
    print(f"\nDone. {OUTPUT_PATH} ({size_kb} KB)")


if __name__ == "__main__":
    main()
