#!/usr/bin/env bash
# Download GTFS feeds for OTP2.
# Credentials are read from backend/.env — never hardcode them here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
DATA_DIR="$SCRIPT_DIR/data"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy .env.example and fill in your credentials."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${TMB_APP_ID:?TMB_APP_ID is not set in .env}"
: "${TMB_APP_KEY:?TMB_APP_KEY is not set in .env}"

mkdir -p "$DATA_DIR"

echo "Downloading TMB (metro L1-L5, L9, L11 + city buses)..."
curl -fL -o "$DATA_DIR/tmb-gtfs.zip" \
  "https://api.tmb.cat/v1/static/datasets/gtfs.zip?app_id=${TMB_APP_ID}&app_key=${TMB_APP_KEY}"

echo "Downloading FGC (metro L6-L8, L12 + suburban lines)..."
curl -fL -o "$DATA_DIR/fgc-gtfs.zip" \
  "https://www.fgc.cat/google/google_transit.zip"

echo "Downloading Rodalies (commuter trains C1-C10)..."
curl -fL -o "$DATA_DIR/rodalies-gtfs.zip" \
  "https://files.mobilitydatabase.org/mdb-1065/mdb-1065-202406240019/mdb-1065-202406240019.zip"

echo "Done. Files in $DATA_DIR:"
ls -lh "$DATA_DIR"/*.zip
