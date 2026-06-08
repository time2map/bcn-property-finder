#!/usr/bin/env python3
"""
Build a GeoPackage with rental/sale price data joined to geometries for QGIS.

Layers produced:
  bcn_rental_barri      — 73 Barcelona barris, rent EUR/month per year (INCASOL)
  bcn_rental_districte  — 10 Barcelona districtes, rent EUR/month per year (INCASOL)
  bcn_rental_barri_m2   — 73 barris, rent EUR/m² per year (INCASOL)
  bcn_rental_dist_m2    — 10 districtes, rent EUR/m² per year (INCASOL)
  bcn_sale_barri        — 73 barris, sale price EUR/m² per year (INCASOL)
  bcn_sale_districte    — 10 districtes, sale price EUR/m² per year (INCASOL)
  catalonia_rental_muni — BCN-metro municipalities, rent EUR/month per year (Generalitat)
  ine_ipva_bcn_dist     — 10 BCN districts, rental price index (INE, base 2015=100)

Output: data/open-prices/bcn_prices.gpkg
"""

import json
import sqlite3
import unicodedata
import re
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
OPEN = DATA / "open-prices"
OUT  = OPEN / "bcn_prices.gpkg"

# ── Layer metadata ────────────────────────────────────────────────────────────

LAYER_META = {
    "bcn_rental_barri": {
        "title": "BCN Rental — 73 barris (EUR/month)",
        "description": (
            "Average monthly rental price (EUR/month) for each of the 73 official "
            "neighbourhoods (barris) of Barcelona. "
            "Annual data 2013–2025. Source: INCASOL / Generalitat de Catalunya — "
            "Lloguers Barcelona per districtes i barris. Licence: CC-BY."
        ),
        "col_prefix": "rent_", "col_unit": "EUR/month (mean rental contract)",
    },
    "bcn_rental_districte": {
        "title": "BCN Rental — 10 districtes (EUR/month)",
        "description": (
            "Average monthly rental price (EUR/month) for each of the 10 administrative "
            "districts (districtes) of Barcelona. Annual data 2000–2025. "
            "Source: INCASOL / Generalitat de Catalunya. Licence: CC-BY."
        ),
        "col_prefix": "rent_", "col_unit": "EUR/month (mean rental contract)",
    },
    "bcn_rental_barri_m2": {
        "title": "BCN Rental — 73 barris (EUR/m²)",
        "description": (
            "Average rental price per square metre (EUR/m²) for each of the 73 "
            "neighbourhoods of Barcelona. Annual data ~2014–2025. "
            "Source: INCASOL / Generalitat de Catalunya. Licence: CC-BY."
        ),
        "col_prefix": "rent_", "col_unit": "EUR/m² (mean rental contract)",
    },
    "bcn_rental_dist_m2": {
        "title": "BCN Rental — 10 districtes (EUR/m²)",
        "description": (
            "Average rental price per square metre (EUR/m²) for each of the 10 "
            "districts of Barcelona. Annual data 2000–2025. "
            "Source: INCASOL / Generalitat de Catalunya. Licence: CC-BY."
        ),
        "col_prefix": "rent_", "col_unit": "EUR/m² (mean rental contract)",
    },
    "bcn_sale_barri": {
        "title": "BCN Sale price — 73 barris (EUR/m²)",
        "description": (
            "Registered property sale price (EUR/m² of built area) for each of the 73 "
            "neighbourhoods of Barcelona. Columns: sale_new_YYYY (new housing ≤5 years), "
            "sale_used_YYYY (secondary market), sale_total_YYYY (all types combined). "
            "Annual Q4 cumulative, 2018–2025 (2020 missing from source). "
            "Source: INCASOL / Generalitat de Catalunya — Compravendes d'habitatges "
            "registrades i el preu de venda. Licence: CC-BY."
        ),
        "col_prefix": "sale_", "col_unit": "EUR/m² built (registered sale price)",
    },
    "bcn_sale_districte": {
        "title": "BCN Sale price — 10 districtes (EUR/m²)",
        "description": (
            "Registered property sale price (EUR/m² built) per district. Same columns "
            "and source as bcn_sale_barri. Annual Q4 cumulative, 2018–2025."
        ),
        "col_prefix": "sale_", "col_unit": "EUR/m² built (registered sale price)",
    },
    "catalonia_rental_muni": {
        "title": "Catalonia Rental — BCN-metro municipalities (EUR/month)",
        "description": (
            "Average monthly rental price (EUR/month) for municipalities in the "
            "Barcelona metropolitan area (35 municipalities with available geometry). "
            "Annual data 2007–2025. "
            "Source: Generalitat de Catalunya — Socrata dataset qww9-bvhh "
            "(Preu mitjà del lloguer d'habitatges per municipi). Licence: CC-BY."
        ),
        "col_prefix": "rent_", "col_unit": "EUR/month (mean rental contract)",
    },
    "ine_ipva_bcn_dist": {
        "title": "INE IPVA — 10 BCN districts (rental price index, base 2015=100)",
        "description": (
            "Experimental Rental Housing Price Index (IPVA) for the 10 administrative "
            "districts of Barcelona. Values are index numbers with base year 2015=100 "
            "(not absolute prices). Annual data 2011–2024. "
            "Source: INE (Instituto Nacional de Estadística), table 59061. "
            "Note: index measures relative change over time, not absolute rent level."
        ),
        "col_prefix": "ipva_", "col_unit": "Index (base 2015=100)",
    },
}

# Common field descriptions applied across all layers
FIELD_DESCRIPTIONS = {
    "NOM":       "Name of the neighbourhood or district (Catalan)",
    "DISTRICTE": "Administrative district code (01–10)",
    "BARRI":     "Neighbourhood code within the district",
    "mun_name":  "Municipality name",
    "rent_YYYY": "Mean rental price in year YYYY (see layer unit)",
    "sale_new_YYYY":   "Mean sale price (new housing ≤5 years) in year YYYY — EUR/m²",
    "sale_used_YYYY":  "Mean sale price (used/secondary housing) in year YYYY — EUR/m²",
    "sale_total_YYYY": "Mean sale price (all housing types) in year YYYY — EUR/m²",
    "ipva_YYYY": "Rental price index in year YYYY (base 2015=100)",
}

# ── Name normalisation helpers ────────────────────────────────────────────────

def norm(s: str) -> str:
    s = s.lower().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s)
    return s

BARRI_OVERRIDES = {
    "el poble sec - aei parc montjuic":             "el poble-sec",
    "el poble sec - parc montjuic":                 "el poble-sec",
    "el poble sec":                                  "el poble-sec",
    "la marina del prat vermell - aei zona franca": "la marina del prat vermell",
    "la marina del prat vermell - zona franca":     "la marina del prat vermell",
}


def match_name(incasol_name: str, geo_index: dict[str, str]) -> str | None:
    key = norm(incasol_name)
    key = BARRI_OVERRIDES.get(key, key)
    return geo_index.get(key)


# ── Layer builders ────────────────────────────────────────────────────────────

def write_layer(gdf: gpd.GeoDataFrame, layer: str) -> None:
    gdf.to_file(OUT, layer=layer, driver="GPKG")
    preview_cols = [c for c in gdf.columns if c != "geometry"][:6]
    print(f"  -> '{layer}': {len(gdf)} features | cols: {preview_cols}")


def rental_records_to_df(records: list[dict], name_field: str = "name") -> pd.DataFrame:
    rows = []
    for r in records:
        row = {name_field: r["name"]}
        for yr, val in r["values"].items():
            row[f"rent_{yr}"] = val
        rows.append(row)
    df = pd.DataFrame(rows)
    year_cols = sorted(c for c in df.columns if c.startswith("rent_"))
    return df[[name_field] + year_cols]


def build_bcn_rental_layers(metric: str, out_barri: str, out_dist: str) -> None:
    geo_barri = gpd.read_file(DATA / "areas" / "barris.geojson")[["NOM", "DISTRICTE", "BARRI", "geometry"]]
    geo_dist  = gpd.read_file(DATA / "areas" / "districtes.geojson")[["NOM", "DISTRICTE", "geometry"]]
    geo_barri_idx = {norm(r.NOM): r.NOM for r in geo_barri.itertuples()}
    geo_dist_idx  = {norm(r.NOM): r.NOM for r in geo_dist.itertuples()}

    with open(OPEN / f"bcn_rental_barri_{metric}_annual.json") as f:
        all_records = json.load(f)["records"]

    non_city     = [r for r in all_records if r["name"] != "Barcelona"]
    dist_records = non_city[:10]
    barri_records = non_city[10:]

    # barris
    df = rental_records_to_df(barri_records)
    df["_nom"] = df["name"].apply(lambda n: match_name(n, geo_barri_idx))
    if (bad := df[df["_nom"].isna()]["name"].tolist()):
        print(f"  WARNING unmatched barris ({metric}): {bad}")
    merged = geo_barri.merge(df.dropna(subset=["_nom"]), left_on="NOM", right_on="_nom", how="left")
    write_layer(merged.drop(columns=["_nom", "name"], errors="ignore"), out_barri)

    # districtes
    df2 = rental_records_to_df(dist_records)
    df2["_nom"] = df2["name"].apply(lambda n: match_name(n, geo_dist_idx))
    merged2 = geo_dist.merge(df2.dropna(subset=["_nom"]), left_on="NOM", right_on="_nom", how="left")
    write_layer(merged2.drop(columns=["_nom", "name"], errors="ignore"), out_dist)


def build_bcn_sale_layers() -> None:
    geo_barri = gpd.read_file(DATA / "areas" / "barris.geojson")[["NOM", "DISTRICTE", "BARRI", "geometry"]]
    geo_dist  = gpd.read_file(DATA / "areas" / "districtes.geojson")[["NOM", "DISTRICTE", "geometry"]]
    geo_barri_idx = {norm(r.NOM): r.NOM for r in geo_barri.itertuples()}
    geo_dist_idx  = {norm(r.NOM): r.NOM for r in geo_dist.itertuples()}

    with open(OPEN / "bcn_sale_barri_eur_m2_annual.json") as f:
        raw = json.load(f)

    def sale_records_to_df(records: list[dict]) -> pd.DataFrame:
        rows = []
        for r in records:
            row = {"name": r["name"]}
            for k, v in r.items():
                if k.startswith("sale_") and v is not None:
                    row[k] = v
            rows.append(row)
        df = pd.DataFrame(rows)
        sale_cols = sorted(c for c in df.columns if c.startswith("sale_"))
        return df[["name"] + sale_cols]

    # barris
    df = sale_records_to_df(raw["barri_records"])
    df["_nom"] = df["name"].apply(lambda n: match_name(n, geo_barri_idx))
    if (bad := df[df["_nom"].isna()]["name"].tolist()):
        print(f"  WARNING unmatched sale barris: {bad}")
    merged = geo_barri.merge(df.dropna(subset=["_nom"]), left_on="NOM", right_on="_nom", how="left")
    write_layer(merged.drop(columns=["_nom", "name"], errors="ignore"), "bcn_sale_barri")

    # districtes
    df2 = sale_records_to_df(raw["districte_records"])
    df2["_nom"] = df2["name"].apply(lambda n: match_name(n, geo_dist_idx))
    merged2 = geo_dist.merge(df2.dropna(subset=["_nom"]), left_on="NOM", right_on="_nom", how="left")
    write_layer(merged2.drop(columns=["_nom", "name"], errors="ignore"), "bcn_sale_districte")


def build_catalonia_layer() -> None:
    geo_muni = gpd.read_file(DATA / "areas" / "municipis.geojson")[["mun_name", "geometry"]]
    geo_muni_idx = {norm(r.mun_name): r.mun_name for r in geo_muni.itertuples()}

    with open(OPEN / "catalonia_rental_municipality.json") as f:
        raw = json.load(f)["records"]

    annual = [r for r in raw if r["periode"] == "gener-desembre" and r["renda_eur_mes"] is not None]
    pivot: dict[str, dict] = {}
    for r in annual:
        k = r["municipi"]
        if k not in pivot:
            pivot[k] = {"municipi": k}
        pivot[k][f"rent_{r['any']}"] = r["renda_eur_mes"]

    df = pd.DataFrame(list(pivot.values()))
    year_cols = sorted(c for c in df.columns if c.startswith("rent_"))
    df = df[["municipi"] + year_cols]
    df["_nom"] = df["municipi"].apply(lambda n: geo_muni_idx.get(norm(n)))
    unmatched_count = df["_nom"].isna().sum()
    if unmatched_count:
        print(f"  INFO: {unmatched_count} municipalities without geometry (outside BCN metro)")
    merged = geo_muni.merge(df.dropna(subset=["_nom"]), left_on="mun_name", right_on="_nom", how="left")
    write_layer(merged.drop(columns=["_nom", "municipi"], errors="ignore"), "catalonia_rental_muni")


def build_ine_ipva_layer() -> None:
    geo_dist = gpd.read_file(DATA / "areas" / "districtes.geojson")[["NOM", "DISTRICTE", "geometry"]]

    with open(OPEN / "ine_ipva_bcn_districts.json") as f:
        series = json.load(f)["series"]

    bcn = [s for s in series if "Barcelona distrito" in s["name"] and "Índice. Total." in s["name"]]
    rows = []
    for s in bcn:
        m = re.search(r"Barcelona distrito (\d+)", s["name"])
        if not m:
            continue
        row = {"DISTRICTE": m.group(1).zfill(2)}
        for d in s["data"]:
            if d["value"] is not None:
                row[f"ipva_{d['year']}"] = round(d["value"], 3)
        rows.append(row)

    df = pd.DataFrame(rows)
    year_cols = sorted(c for c in df.columns if c.startswith("ipva_"))
    merged = geo_dist.merge(df[["DISTRICTE"] + year_cols], on="DISTRICTE", how="left")
    write_layer(merged, "ine_ipva_bcn_dist")


# ── Metadata injection via SQLite ─────────────────────────────────────────────

def inject_metadata() -> None:
    con = sqlite3.connect(OUT)
    cur = con.cursor()

    # 1. Layer descriptions in gpkg_contents
    for layer, meta in LAYER_META.items():
        cur.execute(
            "UPDATE gpkg_contents SET description=? WHERE table_name=?",
            (meta["description"], layer),
        )

    # 2. Create field info table (plain SQLite, not a GeoPackage layer)
    cur.execute("DROP TABLE IF EXISTS _field_info")
    cur.execute("""
        CREATE TABLE _field_info (
            layer       TEXT,
            field       TEXT,
            unit        TEXT,
            description TEXT,
            PRIMARY KEY (layer, field)
        )
    """)

    for layer, meta in LAYER_META.items():
        unit = meta["col_unit"]
        prefix = meta["col_prefix"]
        # Insert generic column template rows
        for field_template, desc in FIELD_DESCRIPTIONS.items():
            cur.execute(
                "INSERT OR IGNORE INTO _field_info VALUES (?,?,?,?)",
                (layer, field_template, unit if field_template.endswith("YYYY") else "", desc),
            )

    # 3. Create layer summary table
    cur.execute("DROP TABLE IF EXISTS _layer_summary")
    cur.execute("""
        CREATE TABLE _layer_summary (
            layer       TEXT PRIMARY KEY,
            title       TEXT,
            unit        TEXT,
            source      TEXT,
            years       TEXT
        )
    """)

    SOURCES = {
        "bcn_rental_barri":     ("INCASOL / Generalitat de Catalunya", "2013–2025"),
        "bcn_rental_districte": ("INCASOL / Generalitat de Catalunya", "2000–2025"),
        "bcn_rental_barri_m2":  ("INCASOL / Generalitat de Catalunya", "~2014–2025"),
        "bcn_rental_dist_m2":   ("INCASOL / Generalitat de Catalunya", "2000–2025"),
        "bcn_sale_barri":       ("INCASOL / Generalitat de Catalunya", "2018–2025 (excl. 2020)"),
        "bcn_sale_districte":   ("INCASOL / Generalitat de Catalunya", "2018–2025 (excl. 2020)"),
        "catalonia_rental_muni":("Generalitat Catalunya, dataset qww9-bvhh", "2007–2025"),
        "ine_ipva_bcn_dist":    ("INE, table 59061 (experimental IPVA)", "2011–2024"),
    }
    for layer, meta in LAYER_META.items():
        src, yrs = SOURCES.get(layer, ("", ""))
        cur.execute(
            "INSERT INTO _layer_summary VALUES (?,?,?,?,?)",
            (layer, meta["title"], meta["col_unit"], src, yrs),
        )

    con.commit()
    con.close()
    print("  Metadata written to gpkg_contents + _layer_summary + _field_info tables.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if OUT.exists():
        OUT.unlink()

    print("Building rental layers (EUR/month) ...")
    build_bcn_rental_layers("eur_month", "bcn_rental_barri", "bcn_rental_districte")

    print("Building rental layers (EUR/m²) ...")
    build_bcn_rental_layers("eur_m2", "bcn_rental_barri_m2", "bcn_rental_dist_m2")

    print("Building sale price layers ...")
    build_bcn_sale_layers()

    print("Building Catalonia rental layer ...")
    build_catalonia_layer()

    print("Building INE IPVA layer ...")
    build_ine_ipva_layer()

    print("Injecting metadata ...")
    inject_metadata()

    size_kb = OUT.stat().st_size // 1024
    print(f"\nDone. {OUT}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
