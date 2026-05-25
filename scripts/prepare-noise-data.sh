#!/usr/bin/env bash
# Prepares Barcelona Strategic Noise Map (Lden) data for the frontend.
# Requires: ogr2ogr (GDAL >= 3), tippecanoe
# Output:
#   frontend/public/data/noise.pmtiles   — vector tiles for rendering + scoring (~2-5 MB)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
DATA_DIR="$ROOT/data/noise"
PUBLIC="$ROOT/frontend/public/data"
GPKG_URL="https://opendata-ajuntament.barcelona.cat/data/dataset/402acbd6-0369-4a5c-beb2-2e1d4f71dcb1/resource/4435f225-12b7-4641-88b6-1dc9bcc00766/download"
GPKG="$DATA_DIR/2022_Isofones_Total_Lden_BCN.gpkg"
LAYER="2022_Isofones_Total_Lden_Mapa_Estrategic_Soroll_BCN"
GEOJSON_TMP="$DATA_DIR/noise-isophones-tmp.geojson"
PMTILES_OUT="$PUBLIC/noise.pmtiles"

mkdir -p "$DATA_DIR" "$PUBLIC"

# ── Step 1: Download GPKG ────────────────────────────────────────────────────
if [ ! -f "$GPKG" ]; then
  echo "Downloading Lden isofones GPKG (may be large)…"
  curl -L -o "$GPKG" "$GPKG_URL"
else
  echo "GPKG already present, skipping download."
fi

# ── Step 2: Convert GPKG → GeoJSON with numeric lden field ──────────────────
echo "Converting GPKG → GeoJSON (with numeric lden values)…"
ogr2ogr \
  -f GeoJSON \
  -t_srs EPSG:4326 \
  -select "Rang" \
  -lco COORDINATE_PRECISION=5 \
  "$GEOJSON_TMP" \
  "$GPKG" \
  "$LAYER"

python3 - "$GEOJSON_TMP" "$GEOJSON_TMP.parsed" <<'PYEOF'
import json, sys, re

src, dst = sys.argv[1], sys.argv[2]
with open(src) as f:
    fc = json.load(f)

def rang_to_lden(rang):
    if not rang: return None
    m = re.search(r'(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)', rang)
    if m: return (float(m.group(1)) + float(m.group(2))) / 2.0
    m = re.search(r'<\s*(\d+(?:\.\d+)?)', rang)
    if m: return float(m.group(1)) - 2.5
    m = re.search(r'[>≥]\s*=?\s*(\d+(?:\.\d+)?)', rang)
    if m: return float(m.group(1)) + 2.5
    return None

out = []
for feat in fc['features']:
    lden = rang_to_lden(feat['properties'].get('Rang', ''))
    if lden is None: continue
    out.append({'type': 'Feature', 'geometry': feat['geometry'], 'properties': {'lden': lden}})

with open(dst, 'w') as f:
    json.dump({'type': 'FeatureCollection', 'features': out}, f, separators=(',', ':'))
print(f"Converted {len(out)} features")
PYEOF
mv "$GEOJSON_TMP.parsed" "$GEOJSON_TMP"

# ── Step 3: GeoJSON → PMTiles (tippecanoe) ───────────────────────────────────
echo "Generating PMTiles (tippecanoe)…"
tippecanoe \
  --output "$PMTILES_OUT" \
  --layer noise \
  --minimum-zoom 10 \
  --maximum-zoom 16 \
  --force \
  "$GEOJSON_TMP"

echo ""
echo "Done."
echo "  PMTiles: $PMTILES_OUT ($(du -h "$PMTILES_OUT" | cut -f1))"
echo ""
echo "Intermediate GeoJSON kept at: $GEOJSON_TMP (gitignored)"
