#!/usr/bin/env python3
"""
Fetch average rental prices by municipality from Generalitat Catalunya (Socrata).
Dataset: Preu mitjà del lloguer d'habitatges per municipi — qww9-bvhh
Output: data/open-prices/catalonia_rental_municipality.json
"""

import json
import requests
from pathlib import Path

API_URL = "https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json"
PAGE_SIZE = 10_000
OUT_DIR = Path(__file__).parent.parent / "data" / "open-prices"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_all() -> list[dict]:
    records = []
    offset = 0
    while True:
        params = {
            "$limit": PAGE_SIZE,
            "$offset": offset,
            "$order": "any DESC, nom_territori ASC",
        }
        print(f"  Fetching offset={offset} ...")
        resp = requests.get(API_URL, params=params, timeout=30)
        resp.raise_for_status()
        page = resp.json()
        if not page:
            break
        records.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return records


def main():
    print(f"Fetching Catalonia rental data from Socrata...")
    raw = fetch_all()

    # Normalise types
    cleaned = []
    for r in raw:
        cleaned.append({
            "codi": r.get("codi_territorial", ""),
            "municipi": r.get("nom_territori", ""),
            "any": int(r["any"]) if r.get("any") else None,
            "periode": r.get("periode", ""),
            "habitatges": int(r["habitatges"]) if r.get("habitatges") else None,
            "renda_eur_mes": float(r["renda"]) if r.get("renda") else None,
            "tram_preus": r.get("tram_preus", ""),
        })

    out_file = OUT_DIR / "catalonia_rental_municipality.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "source": API_URL,
                "dataset": "qww9-bvhh",
                "unit": "EUR/month (mean rental)",
                "records": cleaned,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"  -> {out_file.name}: {len(cleaned)} records")
    # Quick summary
    years = sorted({r["any"] for r in cleaned if r["any"]})
    print(f"  Years available: {years}")
    print("Done.")


if __name__ == "__main__":
    main()
