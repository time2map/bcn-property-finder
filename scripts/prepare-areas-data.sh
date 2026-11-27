#!/usr/bin/env bash
# Builds the administrative areas dataset for exclusion ("no-go") zones.
# Sources:
#   - Barcelona districtes + barris  → martgnz/bcn-geodata (CC, WGS84 GeoJSON)
#   - Metro-area municipalities (AMB) → ICGC divisions-administratives-municipis-100000 (CC BY 4.0)
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

# ICGC municipality outlines for all of Catalonia (947); the AMB subset is picked in Python below.
MUNI_URL="https://datacloud.icgc.cat/datacloud/divisions-administratives/vigent/json_unzip/divisions-administratives-municipis-100000.json"

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

# Metro municipalities (AMB; Barcelona city is covered by districtes / barris).
# `name` and the id slug are the ones the app already uses (area links, aliases): ICGC spells some names with a
# lower-case article ("l'Hospitalet de Llobregat"), so the two are matched ignoring case and a leading article.
AMB = [
    "Badalona", "Badia del Vallès", "Barberà del Vallès", "Begues", "Castellbisbal",
    "Castelldefels", "Cerdanyola del Vallès", "Cervelló", "Corbera de Llobregat",
    "Cornellà de Llobregat", "El Papiol", "El Prat de Llobregat", "Esplugues de Llobregat",
    "Gavà", "L'Hospitalet de Llobregat", "La Palma de Cervelló", "Molins de Rei",
    "Montcada i Reixac", "Montgat", "Pallejà", "Ripollet", "Sant Adrià de Besòs",
    "Sant Andreu de la Barca", "Sant Boi de Llobregat", "Sant Climent de Llobregat",
    "Sant Cugat del Vallès", "Sant Feliu de Llobregat", "Sant Joan Despí",
    "Sant Just Desvern", "Sant Vicenç dels Horts", "Santa Coloma de Cervelló",
    "Santa Coloma de Gramenet", "Tiana", "Torrelles de Llobregat", "Viladecans",
]

def key(name):
    n = name.lower()
    for article in ("el ", "la ", "l'", "els ", "les "):
        if n.startswith(article):
            return n[len(article):]
    return n

by_key = {key(n): n for n in AMB}
muni = load("municipis.geojson")
found = {}
for f in muni["features"]:
    amb_name = by_key.get(key(f["properties"]["NOMMUNI"]))
    # Same-named municipalities elsewhere in Catalonia: keep the one in the province of Barcelona.
    if amb_name and f["properties"]["CODIPROV"] == "08":
        found[amb_name] = f

missing = sorted(set(AMB) - set(found))
if missing:
    sys.exit("ICGC municipalities not found: %s" % ", ".join(missing))

for name in AMB:
    out_features.append({
        "type": "Feature",
        "geometry": found[name]["geometry"],
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
