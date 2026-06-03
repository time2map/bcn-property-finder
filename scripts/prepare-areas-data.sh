#!/usr/bin/env bash
# Builds the administrative areas dataset for exclusion ("no-go") zones.
# Sources:
#   - Barcelona districtes + barris  → martgnz/bcn-geodata (CC, WGS84 GeoJSON)
#   - Metro-area municipalities (AMB) → opendatasoft georef-spain-municipio
# Output:
#   frontend/public/data/areas.geojson  — features tagged {id,name,kind,parent}
# Requires: python3, ogr2ogr (GDAL) for simplification.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
PUBLIC="$ROOT/frontend/public/data"
RAW="$ROOT/data/areas"
OUT="$PUBLIC/areas.geojson"
TMP="$RAW/areas-raw.geojson"

mkdir -p "$PUBLIC" "$RAW"

DISTRICTES_URL="https://raw.githubusercontent.com/martgnz/bcn-geodata/master/districtes/districtes.geojson"
BARRIS_URL="https://raw.githubusercontent.com/martgnz/bcn-geodata/master/barris/barris.geojson"

# Build the municipalities export URL (AMB name list lives in Python below).
MUNI_URL=$(python3 "$SCRIPT_DIR/_amb_muni_url.py")

echo "Downloading sources (curl)…"
curl -sL "$DISTRICTES_URL" -o "$RAW/districtes.geojson"
curl -sL "$BARRIS_URL"     -o "$RAW/barris.geojson"
curl -sL "$MUNI_URL"       -o "$RAW/municipis.geojson"

python3 - "$RAW" "$TMP" <<'PYEOF'
import json, sys

raw_dir, out = sys.argv[1], sys.argv[2]

def load(name):
    with open("%s/%s" % (raw_dir, name)) as fh:
        return json.load(fh)

out_features = []

# Districtes
dist = load("districtes.geojson")
for f in dist["features"]:
    p = f["properties"]
    out_features.append({
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {"id": "district-%s" % p["DISTRICTE"], "name": p["NOM"], "kind": "district"},
    })

# Barris (parent = district)
barr = load("barris.geojson")
for f in barr["features"]:
    p = f["properties"]
    out_features.append({
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {
            "id": "barri-%s%s" % (p["DISTRICTE"], p["BARRI"]),
            "name": p["NOM"],
            "kind": "barri",
            "parent": "district-%s" % p["DISTRICTE"],
        },
    })

# Metro municipalities
muni = load("municipis.geojson")
for f in muni["features"]:
    p = f["properties"]
    name = p.get("mun_name")
    if not name:
        continue
    out_features.append({
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {
            "id": "muni-" + name.lower().replace(" ", "-").replace("'", ""),
            "name": name,
            "kind": "municipality",
        },
    })

with open(out, "w") as fh:
    json.dump({"type": "FeatureCollection", "features": out_features}, fh,
              ensure_ascii=False, separators=(",", ":"))

counts = {}
for f in out_features:
    counts[f["properties"]["kind"]] = counts.get(f["properties"]["kind"], 0) + 1
print("Collected:", counts, "total", len(out_features))
PYEOF

# Simplify + reduce coordinate precision to keep the file lean.
echo "Simplifying with ogr2ogr…"
ogr2ogr -f GeoJSON -simplify 0.0002 -lco COORDINATE_PRECISION=5 "$OUT" "$TMP"

echo ""
echo "Done → $OUT ($(du -h "$OUT" | cut -f1))"
echo "Raw kept at: $TMP (gitignored)"
