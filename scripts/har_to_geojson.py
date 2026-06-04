#!/usr/bin/env python3
"""
Extract Idealista property pins from HAR file(s) and write GeoJSON.

Usage
-----
# Use default HAR list (test snapshots already in data/):
python3 scripts/har_to_geojson.py

# One or more specific HAR files:
python3 scripts/har_to_geojson.py data/my-capture.har data/my-capture2.har

Output
------
- data/idealista-prices/idealista_pins_DDMMYYYY.geojson   (snapshot, never overwritten)
- frontend/public/data/idealista_prices.geojson           (latest, always updated)
"""

import json
import sys
from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).parent.parent
DEFAULT_HARS = [
    REPO_ROOT / "data" / "www.idealista-зумин.har",
    REPO_ROOT / "data" / "www.idealista-зумин2.har",
    REPO_ROOT / "data" / "www.idealista-all-bcn-16zoom.har",
]
SNAPSHOT_DIR = REPO_ROOT / "data" / "idealista-prices"
PUBLIC_PATH = REPO_ROOT / "frontend" / "public" / "data" / "idealista_prices.geojson"


def parse_har(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        har = json.load(f)

    items = []
    for entry in har["log"]["entries"]:
        if not any(k in entry["request"]["url"] for k in ("drawsearchmapgrouped", "livesearchmapgrouped")):
            continue
        text = entry["response"]["content"].get("text", "")
        if not text:
            continue
        try:
            body = json.loads(text)
        except json.JSONDecodeError:
            continue
        data = body.get("data") or body.get("jsonResponse") or {}
        for item in (data.get("map") or {}).get("items", []):
            items.append(item)

    return items


def items_to_geojson(items: list[dict]) -> dict:
    seen: set[int] = set()
    features = []

    for item in items:
        for ad in item.get("ads", []):
            ad_id = ad.get("adId")
            if ad_id in seen:
                continue
            seen.add(ad_id)

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [item["longitude"], item["latitude"]],
                },
                "properties": {
                    "adId": ad_id,
                    "price": ad.get("price"),
                    "priceText": ad.get("priceText"),
                    "isAuction": ad.get("isAuction", False),
                    "exactLocation": item.get("type") == 0,
                },
            })

    return {"type": "FeatureCollection", "features": features}


def dated_path(directory: Path) -> Path:
    today = date.today().strftime("%d%m%Y")
    base = directory / f"idealista_pins_{today}.geojson"
    if not base.exists():
        return base
    # Avoid overwriting — append a counter
    for i in range(2, 100):
        candidate = directory / f"idealista_pins_{today}_{i}.geojson"
        if not candidate.exists():
            return candidate
    raise RuntimeError("Too many snapshots for today")


def main():
    har_paths = [Path(a) for a in sys.argv[1:]] or DEFAULT_HARS

    all_items = []
    for p in har_paths:
        if not p.exists():
            print(f"skip (not found): {p.name}", file=sys.stderr)
            continue
        items = parse_har(p)
        print(f"{p.name}: {len(items)} raw items", file=sys.stderr)
        all_items.extend(items)

    geojson = items_to_geojson(all_items)
    count = len(geojson["features"])
    payload = json.dumps(geojson, ensure_ascii=False, separators=(",", ":"))

    # Dated snapshot
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = dated_path(SNAPSHOT_DIR)
    snapshot.write_text(payload)
    print(f"Snapshot: {count} pins → {snapshot}", file=sys.stderr)

    # Latest (for the app)
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_PATH.write_text(payload)
    print(f"Public:   {PUBLIC_PATH}", file=sys.stderr)

    print(snapshot)


if __name__ == "__main__":
    main()
