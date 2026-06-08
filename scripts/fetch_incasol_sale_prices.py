#!/usr/bin/env python3
"""
Fetch property sale prices (€/m² built) by barri and districte from INCASOL / Generalitat.
Source: habitatge.gencat.cat — Compravendes d'habitatges registrades i el preu de venda
Output: data/open-prices/bcn_sale_barri_eur_m2_annual.json
"""

import json
import re
import requests
import pandas as pd
from io import BytesIO
from pathlib import Path

BASE_URL = (
    "https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/"
    "01_Estadistiques_de_construccio_i_mercat_immobiliari/"
    "02_Compravenda_i_preu_de_venda/"
    "02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda/"
    "{year}/BCN_acumulat_{year}.xlsx"
)

OUT_DIR = Path(__file__).parent.parent / "data" / "open-prices"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Column indices (0-based) for price/m² section
COL_CODE     = 0   # barri/districte numeric code
COL_NAME     = 1   # name
COL_PRC_NEW  = 16  # Preu/m² - Habitatge nou
COL_PRC_USED = 17  # Preu/m² - Habitatge usat
COL_PRC_TOTAL= 18  # Preu/m² - Total


def last_q4_sheet(xl: pd.ExcelFile) -> str:
    """Return sheet name for Q4 (full-year cumulative) — highest quarter available."""
    sheets = xl.sheet_names
    # Sheets like '4t25acum', '3t25_acum', '4t24acum' ...
    # Prefer Q4 (starts with '4t'); fallback to last sheet
    q4 = [s for s in sheets if re.match(r"4t\d", s, re.I)]
    return q4[0] if q4 else sheets[0]


def safe_float(val) -> float | None:
    if val is None or str(val).strip() in ("nan", "n.d.", "", "0"):
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def parse_sale_excel(content: bytes, year: int) -> dict:
    """Parse BCN_acumulat_YYYY.xlsx — returns {city, districtes, barris} dicts."""
    xl = pd.ExcelFile(BytesIO(content))
    sheet = last_q4_sheet(xl)
    df = xl.parse(sheet, header=None)

    result = {"city": None, "districtes": [], "barris": []}
    section = None  # 'districtes' | 'barris'

    for _, row in df.iterrows():
        code = str(row[COL_CODE]).strip() if pd.notna(row[COL_CODE]) else ""
        name = str(row[COL_NAME]).strip() if len(row) > COL_NAME and pd.notna(row[COL_NAME]) else ""

        # Detect section headers
        if "Districtes municipals" in name or "Districtes municipals" in code:
            section = "districtes"
            continue
        if name == "Barris" or code == "Barris":
            section = "barris"
            continue

        # City row: no code, name contains "Barcelona"
        if not code and "Barcelona" in name:
            result["city"] = {
                "name": "Barcelona",
                "sale_new_eur_m2":   safe_float(row[COL_PRC_NEW]  if len(row) > COL_PRC_NEW  else None),
                "sale_used_eur_m2":  safe_float(row[COL_PRC_USED] if len(row) > COL_PRC_USED else None),
                "sale_total_eur_m2": safe_float(row[COL_PRC_TOTAL]if len(row) > COL_PRC_TOTAL else None),
            }
            continue

        # Districte/barri rows: must have numeric code and a name
        if not code or not code.isdigit() or not name or name in ("nan", "None"):
            continue

        entry = {
            "code": code,
            "name": name,
            "sale_new_eur_m2":   safe_float(row[COL_PRC_NEW]   if len(row) > COL_PRC_NEW   else None),
            "sale_used_eur_m2":  safe_float(row[COL_PRC_USED]  if len(row) > COL_PRC_USED  else None),
            "sale_total_eur_m2": safe_float(row[COL_PRC_TOTAL] if len(row) > COL_PRC_TOTAL else None),
        }
        if section == "districtes":
            result["districtes"].append(entry)
        elif section == "barris":
            result["barris"].append(entry)

    return result


def main():
    # Determine available years (download until 404)
    years = list(range(2025, 2012, -1))
    all_years_barri: dict[str, dict] = {}   # name -> {year -> values}
    all_years_dist:  dict[str, dict] = {}

    for year in years:
        url = BASE_URL.format(year=year)
        print(f"  Fetching {year} ...", end=" ")
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 404:
                print("404 — skipping")
                continue
            resp.raise_for_status()
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        parsed = parse_sale_excel(resp.content, year)
        print(f"barris={len(parsed['barris'])}, districtes={len(parsed['districtes'])}")

        for entry in parsed["barris"]:
            n = entry["name"]
            if n not in all_years_barri:
                all_years_barri[n] = {"code": entry["code"], "name": n}
            all_years_barri[n][f"sale_new_{year}"]   = entry["sale_new_eur_m2"]
            all_years_barri[n][f"sale_used_{year}"]  = entry["sale_used_eur_m2"]
            all_years_barri[n][f"sale_total_{year}"] = entry["sale_total_eur_m2"]

        for entry in parsed["districtes"]:
            n = entry["name"]
            if n not in all_years_dist:
                all_years_dist[n] = {"code": entry["code"], "name": n}
            all_years_dist[n][f"sale_new_{year}"]   = entry["sale_new_eur_m2"]
            all_years_dist[n][f"sale_used_{year}"]  = entry["sale_used_eur_m2"]
            all_years_dist[n][f"sale_total_{year}"] = entry["sale_total_eur_m2"]

    # Merge records with same numeric code (barri renamed across years — keep latest name)
    def merge_by_code(records_dict: dict) -> list[dict]:
        by_code: dict[str, dict] = {}
        for entry in records_dict.values():
            code = entry["code"]
            if code not in by_code:
                by_code[code] = dict(entry)
            else:
                # Keep latest (lowest year number = most recent run order) name, merge year data
                for k, v in entry.items():
                    if k not in by_code[code] or by_code[code].get(k) is None:
                        by_code[code][k] = v
        return sorted(by_code.values(), key=lambda r: int(r["code"]))

    barri_records = merge_by_code(all_years_barri)
    dist_records  = merge_by_code(all_years_dist)

    out_file = OUT_DIR / "bcn_sale_barri_eur_m2_annual.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "source": BASE_URL.format(year="YYYY"),
                "unit": "EUR/m² built area (annual cumulative Q4)",
                "columns": {
                    "sale_new_YYYY":   "Price €/m² for new housing (≤5 years old)",
                    "sale_used_YYYY":  "Price €/m² for used/secondary housing",
                    "sale_total_YYYY": "Price €/m² all housing types combined",
                },
                "barri_records":    barri_records,
                "districte_records": dist_records,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    years_found = sorted({int(k.split("_")[-1]) for k in barri_records[0] if k.startswith("sale_total_")}) if barri_records else []
    print(f"\n  -> {out_file.name}: {len(barri_records)} barris, {len(dist_records)} districtes, years={years_found}")
    print("Done.")


if __name__ == "__main__":
    main()
