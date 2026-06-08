#!/usr/bin/env python3
"""
Fetch property sale prices (EUR/m² built) by municipality across Catalonia from INCASOL.
Also downloads ICGC municipality boundaries for Catalonia (947 municipalities).

Source prices:  habitatge.gencat.cat — MUN_trimestral_YYYY.xlsx (Q4 sheet = annual reference)
Source geometry: ICGC datacloud — divisions-administratives-municipis-100000.json

Output:
  data/areas/catalonia_municipis_icgc.geojson   — 947 municipality polygons
  data/open-prices/catalonia_sale_muni.json     — sale price JSON (joined by INE code)
  Adds layer 'catalonia_sale_muni' to data/open-prices/bcn_prices.gpkg
"""

import json
import re
import requests
import pandas as pd
import geopandas as gpd
from io import BytesIO
from pathlib import Path

ROOT    = Path(__file__).parent.parent
DATA    = ROOT / "data"
OPEN    = DATA / "open-prices"
AREAS   = DATA / "areas"
GPKG    = OPEN / "bcn_prices.gpkg"

ICGC_URL = (
    "https://datacloud.icgc.cat/datacloud/divisions-administratives/"
    "vigent/json_unzip/divisions-administratives-municipis-100000.json"
)

MUN_URL = (
    "https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/"
    "01_Estadistiques_de_construccio_i_mercat_immobiliari/"
    "02_Compravenda_i_preu_de_venda/"
    "02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda/"
    "{year}/MUN_trimestral_{year}.xlsx"
)

# Column positions in MUN_trimestral Excel (same layout as BCN_acumulat)
COL_CODE      = 0
COL_NAME      = 1
COL_PRC_NEW   = 16
COL_PRC_USED  = 17
COL_PRC_TOTAL = 18


# ── Geometry ──────────────────────────────────────────────────────────────────

def download_icgc_boundaries() -> gpd.GeoDataFrame:
    geo_path = AREAS / "catalonia_municipis_icgc.geojson"
    if geo_path.exists():
        print(f"  ICGC boundaries already cached at {geo_path.name}")
        return gpd.read_file(geo_path)

    print(f"  Downloading ICGC municipality boundaries (~7 MB) ...")
    r = requests.get(ICGC_URL, timeout=120)
    r.raise_for_status()

    # Keep only useful fields, derive 5-digit INE code from CODIMUNI (6 digits: 5 + check)
    gdf = gpd.read_file(BytesIO(r.content))
    gdf["ine5"] = gdf["CODIMUNI"].str[:5]
    gdf = gdf[["ine5", "CODIMUNI", "NOMMUNI", "NOMCOMAR", "NOMPROV", "CODIPROV", "geometry"]]
    gdf.to_file(geo_path, driver="GeoJSON")
    print(f"  -> saved {len(gdf)} municipalities to {geo_path.name}")
    return gdf


# ── Price data ────────────────────────────────────────────────────────────────

def safe_float(val) -> float | None:
    if val is None:
        return None
    s = str(val).strip()
    if s in ("nan", "n.d.", "N.D.", "", "0", "0.0"):
        return None
    try:
        f = float(s)
        return round(f, 2) if f > 0 else None
    except (ValueError, TypeError):
        return None


def q4_sheet(xl: pd.ExcelFile) -> str:
    """Return Q4 sheet name (most complete quarterly data = annual reference)."""
    sheets = xl.sheet_names
    q4 = [s for s in sheets if re.match(r"4t\d", s, re.I)]
    return q4[0] if q4 else sheets[0]


def parse_mun_excel(content: bytes) -> list[dict]:
    xl = pd.ExcelFile(BytesIO(content))
    df = xl.parse(q4_sheet(xl), header=None)

    records = []
    for _, row in df.iloc[5:].iterrows():   # data starts at row 5
        code = str(row[COL_CODE]).strip() if pd.notna(row[COL_CODE]) else ""
        name = str(row[COL_NAME]).strip() if len(row) > COL_NAME and pd.notna(row[COL_NAME]) else ""
        # Valid rows: 5-digit numeric INE code + non-empty name
        if not re.fullmatch(r"\d{5}", code) or not name or name in ("nan", "None"):
            continue
        records.append({
            "ine5": code,
            "name": name,
            "new":  safe_float(row[COL_PRC_NEW]   if len(row) > COL_PRC_NEW   else None),
            "used": safe_float(row[COL_PRC_USED]  if len(row) > COL_PRC_USED  else None),
            "total":safe_float(row[COL_PRC_TOTAL] if len(row) > COL_PRC_TOTAL else None),
        })
    return records


def fetch_all_years() -> dict[str, dict]:
    """Returns {ine5: {name, ine5, sale_new_YYYY, sale_used_YYYY, sale_total_YYYY, ...}}"""
    by_ine: dict[str, dict] = {}

    for year in range(2025, 2013, -1):
        url = MUN_URL.format(year=year)
        print(f"  {year} ...", end=" ", flush=True)
        try:
            r = requests.get(url, timeout=40)
            if r.status_code == 404:
                print("404")
                continue
            r.raise_for_status()
        except Exception as e:
            print(f"ERROR {e}")
            continue

        records = parse_mun_excel(r.content)
        print(f"{len(records)} municipalities")

        for rec in records:
            ine = rec["ine5"]
            if ine not in by_ine:
                by_ine[ine] = {"ine5": ine, "name": rec["name"]}
            by_ine[ine][f"sale_new_{year}"]   = rec["new"]
            by_ine[ine][f"sale_used_{year}"]  = rec["used"]
            by_ine[ine][f"sale_total_{year}"] = rec["total"]

    return by_ine


# ── GeoPackage layer ──────────────────────────────────────────────────────────

def build_layer(gdf_geo: gpd.GeoDataFrame, price_data: dict[str, dict]) -> None:
    import sqlite3

    df = pd.DataFrame(list(price_data.values()))
    sale_cols = sorted(c for c in df.columns if c.startswith("sale_"))
    df = df[["ine5", "name"] + sale_cols]

    merged = gdf_geo.merge(df, on="ine5", how="left")
    merged = merged.drop(columns=["name"], errors="ignore")

    total_cols = [c for c in sale_cols if c.startswith("sale_total_")]
    matched = merged[total_cols[-1]].notna().sum() if total_cols else 0
    print(f"  With sale data (sale_total, latest year): {matched}/{len(gdf_geo)} municipalities")

    merged.to_file(GPKG, layer="catalonia_sale_muni", driver="GPKG")
    print(f"  -> layer 'catalonia_sale_muni': {len(merged)} features")

    # Update GeoPackage metadata
    desc = (
        "Registered property sale price (EUR/m² built) for Catalonia municipalities "
        "with ≥2000 inhabitants. Q4 annual reference. Columns: sale_new_YYYY (new housing), "
        "sale_used_YYYY (secondary market), sale_total_YYYY (all combined). "
        "Years: 2018–2025 (2020 missing). "
        "Source: INCASOL / Generalitat de Catalunya — MUN_trimestral_YYYY.xlsx. "
        "Geometry: ICGC divisions-administratives-municipis-100000 (CC-BY 4.0). Licence: CC-BY."
    )
    con = sqlite3.connect(GPKG)
    con.execute("UPDATE gpkg_contents SET description=? WHERE table_name=?",
                (desc, "catalonia_sale_muni"))
    con.execute(
        "INSERT OR REPLACE INTO _layer_summary VALUES (?,?,?,?,?)",
        ("catalonia_sale_muni",
         "Catalonia Sale price — municipalities (EUR/m²)",
         "EUR/m² built (registered sale price)",
         "INCASOL / Generalitat de Catalunya (MUN_trimestral_YYYY.xlsx) + ICGC geometry",
         "2018–2025 (excl. 2020)"),
    )
    con.commit()
    con.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Step 1: ICGC municipality boundaries")
    gdf_geo = download_icgc_boundaries()

    print("\nStep 2: INCASOL sale prices by municipality")
    price_data = fetch_all_years()

    # Save raw JSON
    out_json = OPEN / "catalonia_sale_muni.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"source": MUN_URL.format(year="YYYY"),
                   "unit": "EUR/m² built (Q4 annual)",
                   "records": list(price_data.values())},
                  f, ensure_ascii=False, indent=2)
    print(f"  -> {out_json.name}: {len(price_data)} records")

    print("\nStep 3: Build GeoPackage layer")
    build_layer(gdf_geo, price_data)

    print("\nDone.")


if __name__ == "__main__":
    main()
