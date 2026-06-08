#!/usr/bin/env python3
"""
Fetch average rental prices by barri and districte from Generalitat Catalunya (INCASOL).
Source: habitatge.gencat.cat — Lloguers Barcelona per districtes i barris
Output: data/open-prices/bcn_rental_barri_annual.json
        data/open-prices/bcn_rental_barri_m2_annual.json
"""

import json
import requests
import pandas as pd
from io import BytesIO
from pathlib import Path

BASE_URL = (
    "https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/"
    "01_Estadistiques_de_construccio_i_mercat_immobiliari/"
    "03_Mercat_de_lloguer/"
    "03_Lloguers_Barcelona_per_districtes_i_barris/"
)

FILES = {
    "eur_month": "anual_bcn_lloguer.xlsx",
    "eur_m2":    "anual_bcn_lloguer_m2.xlsx",
}

OUT_DIR = Path(__file__).parent.parent / "data" / "open-prices"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def parse_incasol_excel(content: bytes) -> list[dict]:
    """Parse INCASOL Excel: header row has years, data rows have code + name + values."""
    df = pd.read_excel(BytesIO(content), header=None)

    # Find header row (contains year columns like 2025, 2024, ...)
    header_row_idx = None
    for i, row in df.iterrows():
        year_cols = [c for c in row if isinstance(c, (int, float)) and not (isinstance(c, float) and (c != c)) and 2000 <= int(c) <= 2030]
        if len(year_cols) >= 5:
            header_row_idx = i
            break

    if header_row_idx is None:
        raise ValueError("Could not find header row with year columns")

    header = df.iloc[header_row_idx].tolist()
    def is_year(c):
        return isinstance(c, (int, float)) and not (isinstance(c, float) and (c != c)) and 2000 <= int(c) <= 2030

    years = [int(c) for c in header if is_year(c)]

    records = []
    for i in range(header_row_idx + 1, len(df)):
        row = df.iloc[i].tolist()
        # Skip rows without a name in col 1 (name column)
        name = str(row[1]).strip() if len(row) > 1 else ""
        if not name or name.lower() in ("nan", "none", ""):
            continue

        # Determine code (col 0) and level
        code_raw = row[0]
        code = str(code_raw).strip() if pd.notna(code_raw) else ""
        # Level: if code is numeric and > 10 it's a barri; <= 10 it's a districte; empty = city
        if code == "" or code.lower() in ("nan", "none"):
            level = "city"
        elif code.isdigit() and int(code) <= 10:
            level = "districte"
        else:
            level = "barri"

        # Map year columns to values
        year_values = {}
        col_offset = 2  # years start at column index 2
        for j, year in enumerate(years):
            col_idx = col_offset + j
            if col_idx < len(row):
                val = row[col_idx]
                if pd.notna(val) and val != "":
                    try:
                        year_values[str(year)] = round(float(val), 2)
                    except (ValueError, TypeError):
                        pass

        if year_values:
            records.append({
                "code": code,
                "name": name,
                "level": level,
                "values": year_values,
            })

    return records


def fetch_and_save(metric_key: str, filename: str) -> None:
    url = BASE_URL + filename
    print(f"  Fetching {url} ...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    records = parse_incasol_excel(resp.content)

    out_file = OUT_DIR / f"bcn_rental_barri_{metric_key}_annual.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"source": url, "unit": metric_key, "records": records}, f, ensure_ascii=False, indent=2)

    levels = {r["level"] for r in records}
    print(f"  -> {out_file.name}: {len(records)} records, levels={levels}")


def main():
    for metric_key, filename in FILES.items():
        fetch_and_save(metric_key, filename)
    print("Done.")


if __name__ == "__main__":
    main()
