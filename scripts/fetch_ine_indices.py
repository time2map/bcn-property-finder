#!/usr/bin/env python3
"""
Fetch housing price indices from INE (Instituto Nacional de Estadística).

Tables fetched:
  59061 — IPVA by Barcelona districts (rental price index, base 2015=100)
  59056 — IPVA by CCAA (national + autonomous communities)
  76201 — IPV by CCAA, quarterly (sale price index, base 2015=100)

Output: data/open-prices/ine_ipva_bcn_districts.json
        data/open-prices/ine_ipva_ccaa.json
        data/open-prices/ine_ipv_ccaa.json
"""

import json
import requests
from datetime import datetime
from pathlib import Path

BASE = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{table}?nult=30"
OUT_DIR = Path(__file__).parent.parent / "data" / "open-prices"
OUT_DIR.mkdir(parents=True, exist_ok=True)

TABLES = {
    "ine_ipva_bcn_districts": {
        "table": "59061",
        "description": "IPVA — Rental price index by Barcelona district (base 2015=100)",
    },
    "ine_ipva_ccaa": {
        "table": "59056",
        "description": "IPVA — Rental price index by CCAA (base 2015=100)",
    },
    "ine_ipv_ccaa": {
        "table": "76201",
        "description": "IPV — Sale price index by CCAA, quarterly (base 2015=100)",
    },
}

# INE FK_Periodo codes → human-readable quarters
PERIODO_MAP = {21: "Q1", 22: "Q2", 23: "Q3", 24: "Q4"}


def parse_timestamp(ts: int) -> str:
    """Convert INE millisecond timestamp to ISO date string."""
    try:
        return datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
    except Exception:
        return str(ts)


def fetch_table(table_id: str) -> list[dict]:
    url = BASE.format(table=table_id)
    print(f"  Fetching table {table_id}: {url}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalise_series(raw: list[dict]) -> list[dict]:
    series = []
    for item in raw:
        data_points = []
        for d in item.get("Data", []):
            point = {
                "year": d.get("Anyo"),
                "value": d.get("Valor"),
            }
            if d.get("FK_Periodo"):
                point["quarter"] = PERIODO_MAP.get(d["FK_Periodo"], str(d["FK_Periodo"]))
            if d.get("Fecha"):
                point["date"] = parse_timestamp(d["Fecha"])
            data_points.append(point)

        series.append({
            "code": item.get("COD", ""),
            "name": item.get("Nombre", ""),
            "data": data_points,
        })
    return series


def main():
    for out_name, cfg in TABLES.items():
        raw = fetch_table(cfg["table"])
        series = normalise_series(raw)

        out_file = OUT_DIR / f"{out_name}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source": f"https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{cfg['table']}",
                    "table": cfg["table"],
                    "description": cfg["description"],
                    "note": "Values are index numbers (base 2015=100), not absolute prices.",
                    "series": series,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"  -> {out_file.name}: {len(series)} series")

    print("Done.")


if __name__ == "__main__":
    main()
