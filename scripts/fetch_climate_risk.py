#!/usr/bin/env python3
"""
Fetch open climate-risk data (floods, wildfires, heat) for Catalonia / Barcelona
for offline analysis. Nothing here feeds the frontend yet.

Sources:
  Flood, Catalonia  — ACA (Agència Catalana de l'Aigua) WFS sig.gencat.cat/ows/AIGUA
                      Protecció Civil (ICGC) WFS pcivil.icgc.cat — geomorphological zones
  Flood, Barcelona  — Atles de resiliència (Ajuntament de Barcelona / Barcelona Regional /
                      BCASA / RESCCUE), CARTO account `urbisadmin` (read key published in the
                      public atlas viewer config: coneixement-eu.bcn.cat/widget/atles-viewer)
  Wildfire          — Generalitat: Mapa de perill bàsic d'incendi forestal 2024 (raster),
                      burned-area perimeters 1986–2024, Protecció Civil INFOCAT layers
  Heat, Barcelona   — Open Data BCN (CKAN) Atles de resiliència heat datasets (GPKG)

Output: data/climate-risk/ (gitignored) — per-theme GeoPackages (EPSG:25831), raw downloads,
        manifest.json and a generated README.md describing every layer.

Run (the venv has x86_64 wheels):
  arch -x86_64 .venv-livability/bin/python scripts/fetch_climate_risk.py [--only flood fire heat] [--force]
"""

import argparse
import io
import json
import shutil
import subprocess
import sys
import traceback
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "data" / "climate-risk"
RAW_DIR = OUT_DIR / "raw"
DOCS_DIR = OUT_DIR / "docs"
MANIFEST = OUT_DIR / "manifest.json"
README = OUT_DIR / "README.md"
BCN_DISTRICTS = ROOT / "data" / "areas" / "districtes.geojson"

CRS = "EPSG:25831"  # ETRS89 / UTM 31N — native CRS of all Catalan sources
TIMEOUT = 300
HEADERS = {"User-Agent": "bcn-property-finder climate-risk fetch (research)"}

ACA_WFS = "https://sig.gencat.cat/ows/AIGUA/wfs"
PCIVIL_WFS = "https://pcivil.icgc.cat/ogc/geoservei"
CARTO_SQL = "https://urbisadmin.carto.com/api/v2/sql"
CARTO_KEY = "9dbb2c687432efb19315fe0c56a11a6fef1467b4"  # public read key from atlas viewer config
ATLAS_URL = "https://coneixement-eu.bcn.cat/widget/atles-resiliencia"
CKAN_API = "https://opendata-ajuntament.barcelona.cat/data/api/3/action/package_show"
FIRE_HAZARD_URL = "https://gencat.cat/agricultura/sig/bases/PERILLBASICINCENDI.zip"
FIRE_PERIMETERS_URL = "http://www.gencat.cat/agricultura/sig/bases/incendis{yy}.zip"
FIRE_YEARS = list(range(1986, 2025))

LIC_GENCAT = "Generalitat de Catalunya open data, attribution (terms not verified per layer)"
LIC_ATLAS = "Not stated (public Ajuntament viewer) — confirm with Ajuntament before product use"
LIC_ODBCN = "CC-BY-4.0"

ORG_ACA = "ACA — Agència Catalana de l'Aigua"
ORG_PCIVIL = "Protecció Civil de Catalunya (ICGC geoservei)"
ORG_ATLAS = "Ajuntament de Barcelona — Atles de resiliència (Barcelona Regional, BCASA)"
ORG_RESCCUE = "Ajuntament de Barcelona — Atles de resiliència, RESCCUE project (BCASA / Aquatec)"
ORG_AGRI = "Generalitat — Dept. d'Agricultura (forest fire base maps)"
ORG_ODBCN = "Open Data BCN — Ajuntament de Barcelona"

# ── Source catalogue ─────────────────────────────────────────────────────────

ACA_LAYERS = [
    ("AIGUA_LI10", "aca_flood_zone_t10", "River flood zone, 10-year return period (high probability)"),
    ("AIGUA_LI100", "aca_flood_zone_t100", "River flood zone, 100-year return period (medium probability)"),
    ("AIGUA_LI500", "aca_flood_zone_t500", "River flood zone, 500-year return period (low probability)"),
    ("AIGUA_PLUVIAL_ARPSI", "aca_arpsi_pluvial", "Areas of significant potential PLUVIAL flood risk (ARPSI)"),
    ("AIGUA_CONQUES_ARPSI", "aca_arpsi_basins", "River basins containing ARPSI stretches"),
    ("AIGUA_TRAMS_ARPSI", "aca_arpsi_stretches", "River stretches with significant potential flood risk (ARPSI)"),
    ("AIGUA_INUNDACIONS_HISTORIQUES", "aca_historic_floods",
     "Historic flood episodes by municipality (episode counts EP_05_17 / EP_18_23, damages DANY_05 / DANY_18 €)"),
]

PCIVIL_FLOOD_LAYERS = [
    ("risc_inundacions.map", "Zones_potencialment_inundables", "pcivil_flood_geomorph",
     "Potentially floodable zones by geomorphological criteria (terrain / historic marks, 1:5,000)"),
]

# The INFOCAT WFS publishes geometry only; class levels exist only in the WMS rendering.
# Legend colours (GetLegendGraphic) → (rank 1..5, label); rank 5 = worst.
PERILL_PALETTE = {
    (160, 56, 0): (5, "Perill molt superior a la mitjana"),
    (230, 76, 0): (4, "Perill superior a la mitjana"),
    (255, 167, 1): (3, "Perill centrat a la mitjana"),
    (251, 211, 128): (2, "Perill inferior a la mitjana"),
    (253, 253, 195): (1, "Perill molt inferior a la mitjana"),
}
VULN_PALETTE = {
    (255, 0, 0): (5, "Molt alta"),
    (255, 153, 0): (4, "Alta"),
    (255, 204, 102): (3, "Mitja"),
    (255, 255, 0): (2, "Moderada"),
    (204, 255, 102): (1, "Baixa"),
}

PCIVIL_FIRE_LAYERS = [
    ("risc_incendis.map", "infocat_perill", "pcivil_fire_danger_municipal",
     "INFOCAT static wildfire danger by municipality — 5 classes relative to the Catalan mean "
     "(level sampled from WMS colours; unmatched = excluded)", PERILL_PALETTE),
    ("risc_incendis.map", "infocat_vulnerabilitat", "pcivil_fire_vulnerability_municipal",
     "INFOCAT wildfire vulnerability by municipality — 5 classes "
     "(level sampled from WMS colours; unmatched = excluded)", VULN_PALETTE),
    ("risc_incendis.map", "zones_risc_greu_incendis", "pcivil_fire_wui_zone",
     "Zone of influence around forest masses ≥ 5 ha (wildland–urban interface, Llei 5/2003)", None),
]
CAT_MUNICIPIS = ROOT / "data" / "areas" / "catalonia_municipis_icgc.geojson"

CARTO_TABLES = [
    ("ar_in_perill_inun", "bcn_pluvial_hazard_current",
     "Urban (pluvial) flood hazard index, current — sewer capacity + slope + catchment (grid_code 5–50)", ORG_ATLAS),
    ("ar_in_perill_inun_a2", "bcn_pluvial_hazard_2040_passive",
     "Urban flood hazard index, 2040 'passive' scenario", ORG_ATLAS),
    ("ar_in_perill_inun_b1", "bcn_pluvial_hazard_2040_committed",
     "Urban flood hazard index, 2040 'committed' scenario", ORG_ATLAS),
    ("ar_in_com_perill_a2", "bcn_pluvial_hazard_change_passive",
     "Change in flood hazard, current → 2040 passive (street stretches)", ORG_ATLAS),
    ("ar_in_com_perill_b1", "bcn_pluvial_hazard_change_committed",
     "Change in flood hazard, current → 2040 committed (street stretches)", ORG_ATLAS),
    ("ar_in_func_clav", "bcn_sewer_t10_current",
     "Sewer network behaviour under T10 rain, current (free surface / pressurised / near surface / overflow)", ORG_ATLAS),
    ("ar_in_func_clav_a2", "bcn_sewer_t10_2040_passive", "Sewer network behaviour under T10 rain, 2040 passive", ORG_ATLAS),
    ("ar_in_func_clav_b1", "bcn_sewer_t10_2040_committed", "Sewer network behaviour under T10 rain, 2040 committed", ORG_ATLAS),
    ("ar_in_comp_clav_a2", "bcn_sewer_change_passive", "Sewer behaviour change, current → 2040 passive", ORG_ATLAS),
    ("ar_in_comp_clav_b1", "bcn_sewer_change_committed", "Sewer behaviour change, current → 2040 committed", ORG_ATLAS),
    ("ar_permeab1956", "bcn_impermeable_1956", "Impermeable surface, 1956", ORG_ATLAS),
    ("ar_permeab2000", "bcn_impermeable_2000", "Impermeable surface, 2000", ORG_ATLAS),
    ("ar_permeab2009", "bcn_impermeable_2009", "Impermeable surface, 2009", ORG_ATLAS),
    ("rcc_iu1_punts_critics", "bcn_resccue_critical_areas", "RESCCUE: historically flooded critical areas", ORG_RESCCUE),
    ("rcc_iu1_t10_actual", "bcn_resccue_depth_t10_current",
     "RESCCUE 1D/2D model: surface water depth/speed + pedestrian/vehicle hazard, T10, current climate", ORG_RESCCUE),
    ("rcc_iu1_t10_futur", "bcn_resccue_depth_t10_future",
     "RESCCUE: surface water depth/speed + hazard, T10, future climate scenario", ORG_RESCCUE),
    ("rcc_iu1_t100_actual", "bcn_resccue_depth_t100_current",
     "RESCCUE: surface water depth/speed + hazard, T100, current climate", ORG_RESCCUE),
    ("rcc_iu1_t100_futur", "bcn_resccue_depth_t100_future",
     "RESCCUE: surface water depth/speed + hazard, T100, future climate scenario", ORG_RESCCUE),
    ("rcc_iu6_danys_propietats", "bcn_resccue_property_damage_barri",
     "RESCCUE: expected flood damage to properties per barri, T1–T500 × 4 scenarios (bas/bau/sud/sie)", ORG_RESCCUE),
]

ATLAS_PDFS = [
    ("cap02_onades_de_calor-20180322.pdf", "heat", "Atlas chapter: heat waves (methodology of heat layers)"),
    ("cap03_inudabilitat_urbana-20180227.pdf", "flood", "Atlas chapter: urban (pluvial) flooding"),
    ("cap04_inudabilitat_maritima-20180227.pdf", "flood", "Atlas chapter: coastal / marine flooding (maps only in PDF)"),
    ("ResumExecutiu_RESCCUE.pdf", "flood", "RESCCUE executive summary (scenario definitions)"),
]

HEAT_DATASETS = [
    ("confort-termic", "Thermal comfort level (heat-wave day) across the city"),
    ("impacte-de-la-calor", "Most heat-vulnerable areas, by age group"),
    ("poblacio-vulnerable", "Population exposed to heat, density by age group"),
    ("factor-de-vulnerabilitat", "Heat-wave vulnerability factors (global, >75 y.o.)"),
    ("formacio-poblacio-insuficient", "Heat vulnerability from insufficient education level"),
    ("comportament-energetic-edificis", "Building energy behaviour — theoretical cooling demand in a heat wave"),
    ("presencia-absencia-vegetacio", "Areas without vegetation (heat vulnerability)"),
    ("equipaments-i-parcs-refugi", "Heat shelters (parks, facilities) and their 10-min coverage"),
    ("xarxa-refugis-climatics", "Current climate shelter network (points)"),
    ("temperatures-hist-bcn", "Monthly mean air temperature in Barcelona since 1780 (non-spatial)"),
]

SKIPPED = [
    ("Ebro basin river flood zones (MITECO SNCZI)",
     "ACA covers only Catalonia's internal basins; the Ebro part (Lleida, Ebro delta) is only in SNCZI "
     "(~1 GB per return period, whole Spain). Skipped by decision; gis.miteco.gob.es was also unreachable."),
    ("EFFIS burnt areas (incl. Aug 2026 Collserola fire)",
     "maps.effis.emergency.copernicus.eu unreachable at fetch time; Generalitat perimeters end in 2024."),
    ("Barcelona coastal flooding", "Only published as maps inside the atlas PDF (docs/cap04_*.pdf)."),
    ("ACA flood depth rasters (calats)", "Published only as WMS images (aca-web.gencat.cat/.../CCA), no vector/raster download."),
    ("RESCCUE adaptation scenarios (rcc_iu1_t010_alt_*, rcc_iu1_t100_alt_*)",
     "Available on the same CARTO account; skipped — model adaptation measures, not current risk."),
]

# ── Helpers ──────────────────────────────────────────────────────────────────

session = requests.Session()
session.headers.update(HEADERS)
_retry = Retry(total=5, backoff_factor=2, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET",))
session.mount("http://", HTTPAdapter(max_retries=_retry))
session.mount("https://", HTTPAdapter(max_retries=_retry))
records: list[dict] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def download(url: str, dest: Path, force: bool = False, **kwargs) -> Path:
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with session.get(url, timeout=TIMEOUT, stream=True, **kwargs) as r:
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".part")
        with open(tmp, "wb") as fh:
            for chunk in r.iter_content(1 << 20):
                fh.write(chunk)
        tmp.rename(dest)
    return dest


def layer_count(gpkg: Path, layer: str) -> int | None:
    if not gpkg.exists():
        return None
    layers = {name for name, _ in pyogrio.list_layers(gpkg)}
    if layer not in layers:
        return None
    return pyogrio.read_info(gpkg, layer=layer)["features"]


def write_layer(gdf: gpd.GeoDataFrame, gpkg: Path, layer: str, append: bool = False) -> None:
    gpkg.parent.mkdir(parents=True, exist_ok=True)
    # GeoPackage reserves `fid` for the primary key; a source column with that name is consumed as the
    # FID on create but shifts attribute columns when appending chunks. Keep it as a plain attribute.
    if "fid" in gdf.columns:
        gdf = gdf.rename(columns={"fid": "src_fid"})
    gdf.to_file(gpkg, layer=layer, driver="GPKG", engine="pyogrio", append=append)


def describe_layer(gpkg: Path, layer: str) -> dict:
    info = pyogrio.read_info(gpkg, layer=layer)
    bounds = pyogrio.read_bounds(gpkg, layer=layer)[1]
    bbox = None
    if bounds.size:
        b = gpd.GeoSeries.from_xy([bounds[0].min(), bounds[2].max()], [bounds[1].min(), bounds[3].max()],
                                  crs=info["crs"]).to_crs("EPSG:4326")
        bbox = [round(v, 4) for v in (b.x[0], b.y[0], b.x[1], b.y[1])]
    return {
        "features": int(info["features"]),
        "geometry": info["geometry_type"],
        "crs": info["crs"],
        "fields": [f for f in info["fields"]],
        "bbox_wgs84": bbox,
    }


def record(theme: str, scope: str, file: Path, layer: str | None, title: str, org: str, url: str,
           license_: str, status: str = "ok", error: str | None = None, extra: dict | None = None) -> None:
    rec = {
        "theme": theme, "scope": scope, "file": str(file.relative_to(OUT_DIR)), "layer": layer,
        "title": title, "source_org": org, "source_url": url, "license": license_,
        "fetched": now_iso(), "status": status,
    }
    if status == "ok" and layer and file.suffix == ".gpkg":
        rec.update(describe_layer(file, layer))
    if extra:
        rec.update(extra)
    if error:
        rec["error"] = error
    records.append(rec)
    n = rec.get("features", "")
    print(f"  [{status}] {theme}/{layer or file.name} {n}")


def guarded(theme: str, scope: str, file: Path, layer: str, title: str, org: str, url: str, license_: str):
    """Decorator-ish runner: executes fn, records ok/error without aborting the run."""
    def run(fn):
        try:
            fn()
            record(theme, scope, file, layer, title, org, url, license_)
        except Exception as exc:  # noqa: BLE001 — one failing source must not stop the others
            traceback.print_exc()
            record(theme, scope, file, layer, title, org, url, license_, status="error", error=repr(exc))
    return run


def bcn_boundary() -> gpd.GeoDataFrame:
    d = gpd.read_file(BCN_DISTRICTS).to_crs(CRS)
    return gpd.GeoDataFrame(geometry=[d.union_all()], crs=CRS)


def clip_to_bcn(src: Path, layer: str, dst: Path, dst_layer: str, bcn: gpd.GeoDataFrame) -> int:
    gdf = gpd.read_file(src, layer=layer, bbox=tuple(bcn.total_bounds), engine="pyogrio")
    if len(gdf):
        gdf.geometry = gdf.geometry.make_valid()
        gdf = gpd.clip(gdf, bcn)
    if len(gdf) == 0:
        return 0
    write_layer(gdf, dst, dst_layer)
    return len(gdf)


# ── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_geoserver_wfs(type_name: str, gpkg: Path, layer: str, force: bool, page: int = 3000) -> None:
    hits = session.get(ACA_WFS, params={"service": "WFS", "version": "2.0.0", "request": "GetFeature",
                                        "typeNames": type_name, "resultType": "hits"}, timeout=TIMEOUT)
    hits.raise_for_status()
    total = int(hits.text.split('numberMatched="')[1].split('"')[0])
    if not force and layer_count(gpkg, layer) == total:
        return
    for start in range(0, total, page):
        params = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": type_name,
                  "count": page, "startIndex": start, "srsName": "EPSG:25831", "outputFormat": "application/json"}
        if total > page:
            params["sortBy"] = "OBJECTID"  # stable order across pages
        r = session.get(ACA_WFS, params=params, timeout=TIMEOUT)
        r.raise_for_status()
        gdf = gpd.GeoDataFrame.from_features(r.json()["features"], crs=CRS)
        write_layer(gdf, gpkg, layer, append=start > 0)
        print(f"    {type_name}: {min(start + page, total)}/{total}")
    got = layer_count(gpkg, layer)
    if got != total:
        raise RuntimeError(f"{type_name}: expected {total} features, wrote {got}")


def fetch_mapserver_wfs(mapfile: str, type_name: str, gpkg: Path, layer: str, raw: Path, force: bool) -> None:
    """Protecció Civil MapServer only serves GML; save the GML as raw and convert."""
    if not force and layer_count(gpkg, layer):
        return
    url = PCIVIL_WFS
    params = {"map": f"/opt/idec/dades/pcivil/{mapfile}", "service": "WFS", "version": "2.0.0",
              "request": "GetFeature", "typeNames": f"ms:{type_name}", "srsName": "EPSG:25831"}
    gml = raw / f"{type_name}.gml"
    download(url, gml, force=force, params=params)
    gdf = gpd.read_file(gml, engine="pyogrio")
    gdf = gdf.set_crs(CRS, allow_override=True)
    hits = session.get(url, params={**params, "resultType": "hits"}, timeout=TIMEOUT).text
    total = int(hits.split('numberMatched="')[1].split('"')[0])
    if len(gdf) != total:
        raise RuntimeError(f"{type_name}: expected {total} features, got {len(gdf)} (server page limit?)")
    write_layer(gdf, gpkg, layer)


def enrich_municipal_levels(mapfile: str, type_name: str, gpkg: Path, layer: str, palette: dict, raw: Path,
                            force: bool) -> None:
    """Attach municipality names (ICGC) and class levels read from the WMS rendering at an interior point."""
    gdf = gpd.read_file(gpkg, layer=layer, engine="pyogrio")
    if "level_rank" in gdf.columns and not force:
        return
    minx, miny, maxx, maxy = 260000, 4488000, 528000, 4749000  # Catalonia, ~67 m / px
    width, height = 4000, 3896
    png, tif = raw / f"{type_name}_wms.png", raw / f"{type_name}_wms.tif"
    download(PCIVIL_WFS, png, force, params={
        "map": f"/opt/idec/dades/pcivil/{mapfile}", "service": "WMS", "version": "1.1.1", "request": "GetMap",
        "layers": type_name, "styles": "", "srs": "EPSG:25831", "bbox": f"{minx},{miny},{maxx},{maxy}",
        "width": width, "height": height, "format": "image/png", "transparent": "true"})
    subprocess.run(["gdal_translate", "-q", "-expand", "rgb", str(png), str(tif)], check=True)

    pts = gdf.geometry.make_valid().representative_point()
    offsets = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 2), (-2, -2)]
    coords = []
    for p in pts:
        px = int((p.x - minx) / (maxx - minx) * width)
        py = int((maxy - p.y) / (maxy - miny) * height)
        coords += [f"{px + dx} {py + dy}" for dx, dy in offsets]
    out = subprocess.run(["gdallocationinfo", "-valonly", str(tif)], input="\n".join(coords) + "\n",
                         capture_output=True, text=True, check=True).stdout.split()
    rgb = [tuple(int(v) for v in out[i:i + 3]) for i in range(0, len(out), 3)]
    ranks, labels = [], []
    for i in range(len(gdf)):
        hit = next((palette[c] for c in rgb[i * len(offsets):(i + 1) * len(offsets)] if c in palette), None)
        ranks.append(hit[0] if hit else None)
        labels.append(hit[1] if hit else "excluded / not drawn")

    muni = gpd.read_file(CAT_MUNICIPIS).to_crs(CRS)[["CODIMUNI", "NOMMUNI", "NOMCOMAR", "geometry"]]
    joined = gpd.sjoin(gpd.GeoDataFrame(geometry=pts, crs=CRS), muni, how="left", predicate="within")
    joined = joined[~joined.index.duplicated()]
    gdf = gpd.GeoDataFrame({
        "municipality": joined["NOMMUNI"].values, "codimuni": joined["CODIMUNI"].values,
        "comarca": joined["NOMCOMAR"].values, "level_rank": pd.array(ranks, dtype="Int64"), "level": labels,
    }, geometry=gdf.geometry.values, crs=CRS)
    write_layer(gdf, gpkg, layer)


def fetch_carto(table: str, gpkg: Path, layer: str, force: bool, chunk: int = 50000) -> None:
    def sql(q: str, **extra):
        r = session.get(CARTO_SQL, params={"q": q, "api_key": CARTO_KEY, **extra}, timeout=TIMEOUT)
        r.raise_for_status()
        return r

    stats = sql(f"SELECT count(*) n, min(cartodb_id) lo, max(cartodb_id) hi FROM {table}").json()["rows"][0]
    if not force and layer_count(gpkg, layer) == stats["n"]:
        return
    fields = sql(f"SELECT * FROM {table} LIMIT 0").json()["fields"]
    cols = ", ".join(c for c in fields if c != "the_geom_webmercator")
    # Chunks are appended to one layer whose schema comes from the first chunk, so pin column
    # types from Postgres: a float column whose first chunk holds only whole numbers would
    # otherwise become INTEGER and truncate later values.
    floats = [c for c, f in fields.items() if f.get("pgtype") in ("float4", "float8", "numeric")]
    written = 0
    for lo in range(stats["lo"] - 1, stats["hi"], chunk):
        r = sql(f"SELECT {cols} FROM {table} WHERE cartodb_id > {lo} AND cartodb_id <= {lo + chunk}",
                format="geojson")
        feats = r.json()["features"]
        if not feats:
            continue
        gdf = gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326").to_crs(CRS)
        for c in floats:
            if c in gdf.columns:
                gdf[c] = pd.to_numeric(gdf[c], errors="coerce").astype("float64")
        write_layer(gdf, gpkg, layer, append=written > 0)
        written += len(gdf)
        print(f"    {table}: {written}/{stats['n']}")
    if written != stats["n"]:
        raise RuntimeError(f"{table}: expected {stats['n']} rows, wrote {written}")


# ── Themes ───────────────────────────────────────────────────────────────────

def run_flood(force: bool, bcn: gpd.GeoDataFrame) -> None:
    print("== Flood")
    raw = RAW_DIR / "flood"
    cat, city = OUT_DIR / "flood_catalonia.gpkg", OUT_DIR / "flood_bcn.gpkg"

    for type_name, layer, title in ACA_LAYERS:
        url = f"{ACA_WFS}?typeNames=AIGUA:{type_name}"
        guarded("flood", "catalonia", cat, layer, title, ORG_ACA, url, LIC_GENCAT)(
            lambda t=type_name, l=layer: fetch_geoserver_wfs(f"AIGUA:{t}", cat, l, force))

    for mapfile, type_name, layer, title in PCIVIL_FLOOD_LAYERS:
        url = f"{PCIVIL_WFS}?map=/opt/idec/dades/pcivil/{mapfile}&typeNames=ms:{type_name}"
        guarded("flood", "catalonia", cat, layer, title, ORG_PCIVIL, url, LIC_GENCAT)(
            lambda m=mapfile, t=type_name, l=layer: fetch_mapserver_wfs(m, t, cat, l, raw, force))

    # Catalonia layers clipped to Barcelona
    for layer, title in [(l, t) for _, l, t in ACA_LAYERS] + [(l, t) for _, _, l, t in PCIVIL_FLOOD_LAYERS]:
        if layer_count(cat, layer) is None:
            continue
        dst_layer = f"{layer}__bcn"
        try:
            n = clip_to_bcn(cat, layer, city, dst_layer, bcn)
            if n:
                record("flood", "barcelona", city, dst_layer, f"{title} — clipped to Barcelona",
                       ORG_ACA if layer.startswith("aca") else ORG_PCIVIL, f"derived from {cat.name}:{layer}",
                       LIC_GENCAT)
            else:
                print(f"  [empty] {layer} has no features inside Barcelona")
                records.append({"theme": "flood", "scope": "barcelona", "file": city.name, "layer": dst_layer,
                                "title": f"{title} — clipped to Barcelona", "status": "empty",
                                "source_org": "", "source_url": f"derived from {cat.name}:{layer}",
                                "license": LIC_GENCAT, "fetched": now_iso(), "features": 0})
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            record("flood", "barcelona", city, dst_layer, title, "", "", LIC_GENCAT, status="error", error=repr(exc))

    for table, layer, title, org in CARTO_TABLES:
        url = f"{CARTO_SQL}?q=SELECT * FROM {table}"
        guarded("flood", "barcelona", city, layer, title, org, url, LIC_ATLAS)(
            lambda t=table, l=layer: fetch_carto(t, city, l, force))

    for pdf, theme, title in ATLAS_PDFS:
        if theme != "flood":
            continue
        dest = DOCS_DIR / pdf
        guarded("flood", "barcelona", dest, None, title, ORG_ATLAS, f"{ATLAS_URL}/docs/{pdf}", LIC_ATLAS)(
            lambda p=pdf, d=dest: download(f"{ATLAS_URL}/docs/{p}", d, force))


def run_fire(force: bool, bcn: gpd.GeoDataFrame) -> None:
    print("== Fire")
    raw = RAW_DIR / "fire"
    cat, city = OUT_DIR / "fire_catalonia.gpkg", OUT_DIR / "fire_bcn.gpkg"

    # 1. Static hazard raster 2024 (100 m, classes 1–10, nodata 15)
    tif = OUT_DIR / "fire_hazard_2024.tif"
    tif_bcn = OUT_DIR / "fire_hazard_2024_bcn.tif"

    def hazard():
        z = download(FIRE_HAZARD_URL, raw / "PERILLBASICINCENDI.zip", force)
        with zipfile.ZipFile(z) as zf:
            zf.extractall(raw / "perill_basic")
        for f in (raw / "perill_basic").glob("PERILLBASICINCENDI.*"):
            shutil.copy(f, OUT_DIR / f.name.replace("PERILLBASICINCENDI", "fire_hazard_2024"))

    guarded("fire", "catalonia", tif, None, "Mapa de perill bàsic d'incendi forestal 2024 — structural wildfire "
            "hazard, 100 m raster, classes 1 (low) – 10 (high), nodata 15", ORG_AGRI, FIRE_HAZARD_URL, LIC_GENCAT)(hazard)

    def hazard_bcn():
        cut = raw / "bcn_boundary.geojson"
        bcn.to_file(cut, driver="GeoJSON")
        gdalwarp = shutil.which("gdalwarp")
        if not gdalwarp:
            raise RuntimeError("gdalwarp not found in PATH")
        subprocess.run([gdalwarp, "-overwrite", "-q", "-cutline", str(cut), "-crop_to_cutline",
                        "-dstnodata", "15", str(tif), str(tif_bcn)], check=True)

    if tif.exists():
        guarded("fire", "barcelona", tif_bcn, None, "Wildfire hazard 2024 raster clipped to Barcelona",
                ORG_AGRI, f"derived from {tif.name}", LIC_GENCAT)(hazard_bcn)

    # 2. Burned-area perimeters 1986–2024 (one zip per year)
    layer = "fire_perimeters_1986_2024"

    def perimeters():
        if not force and layer_count(cat, layer):
            return
        frames = []
        for year in FIRE_YEARS:
            z = download(FIRE_PERIMETERS_URL.format(yy=f"{year % 100:02d}"), raw / "perimeters" / f"incendis{year}.zip",
                         force)
            with zipfile.ZipFile(z) as zf:
                shp = next(n for n in zf.namelist() if n.lower().endswith(".shp"))
            gdf = gpd.read_file(f"/vsizip/{z}/{shp}", engine="pyogrio")
            if gdf.crs is None:
                print(f"    WARNING: incendis{year} has no .prj, assuming {CRS}")
                gdf = gdf.set_crs(CRS)
            gdf = gdf.to_crs(CRS)
            gdf.columns = [c.upper() if c != "geometry" else c for c in gdf.columns]
            gdf["YEAR"] = year
            frames.append(gdf)
        allp = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=CRS)
        # Column sets differ between years — normalise to strings to keep one schema.
        for c in allp.columns:
            if c not in ("geometry", "YEAR") and allp[c].dtype == object:
                allp[c] = allp[c].astype("string")
        write_layer(allp, cat, layer)

    guarded("fire", "catalonia", cat, layer, "Burned-area perimeters of forest fires 1986–2024 (satellite + GPS, "
            "Agents Rurals / ICGC)", ORG_AGRI, FIRE_PERIMETERS_URL.format(yy="YY"), LIC_GENCAT)(perimeters)

    # 3. Protecció Civil INFOCAT layers
    for mapfile, type_name, lyr, title, palette in PCIVIL_FIRE_LAYERS:
        url = f"{PCIVIL_WFS}?map=/opt/idec/dades/pcivil/{mapfile}&typeNames=ms:{type_name}"

        def infocat(m=mapfile, t=type_name, l=lyr, p=palette):
            fetch_mapserver_wfs(m, t, cat, l, raw, force)
            if p:
                enrich_municipal_levels(m, t, cat, l, p, raw, force)

        guarded("fire", "catalonia", cat, lyr, title, ORG_PCIVIL, url, LIC_GENCAT)(infocat)

    # 4. Barcelona subsets (municipal layers: the Barcelona feature itself, not boundary slivers)
    for lyr, title in [(layer, "Burned-area perimeters 1986–2024")] + [(l, t) for _, _, l, t, _ in PCIVIL_FIRE_LAYERS]:
        if layer_count(cat, lyr) is None:
            continue
        dst_layer = f"{lyr}__bcn"
        try:
            if lyr.endswith("_municipal"):
                gdf = gpd.read_file(cat, layer=lyr, engine="pyogrio")
                write_layer(gdf[gdf["municipality"] == "Barcelona"], city, dst_layer)
                record("fire", "barcelona", city, dst_layer, f"{title} — Barcelona municipality",
                       ORG_PCIVIL, f"derived from {cat.name}:{lyr}", LIC_GENCAT)
            elif clip_to_bcn(cat, lyr, city, dst_layer, bcn):
                record("fire", "barcelona", city, dst_layer, f"{title} — clipped to Barcelona",
                       ORG_AGRI if lyr == layer else ORG_PCIVIL, f"derived from {cat.name}:{lyr}", LIC_GENCAT)
            else:
                print(f"  [empty] {lyr} has no features inside Barcelona")
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            record("fire", "barcelona", city, dst_layer, title, "", "", LIC_GENCAT, status="error", error=repr(exc))


def run_heat(force: bool) -> None:
    print("== Heat")
    raw = RAW_DIR / "heat"
    city = OUT_DIR / "heat_bcn.gpkg"

    for dataset, title in HEAT_DATASETS:
        page = f"https://opendata-ajuntament.barcelona.cat/data/en/dataset/{dataset}"
        try:
            pkg = session.get(CKAN_API, params={"id": dataset}, timeout=TIMEOUT).json()["result"]
        except Exception as exc:  # noqa: BLE001
            record("heat", "barcelona", city, dataset, title, ORG_ODBCN, page, LIC_ODBCN, status="error",
                   error=repr(exc))
            continue
        license_ = pkg.get("license_id") or LIC_ODBCN
        for res in pkg["resources"]:
            fmt = (res.get("format") or "").upper()
            name = res.get("name") or res["id"]
            if fmt == "GPKG":
                dest = raw / dataset / name
                try:
                    download(res["url"], dest, force)
                    if len(pyogrio.list_layers(dest)) == 0:
                        raise RuntimeError("GPKG has no vector layers (raster-only?)")
                    for src_layer, _geom in pyogrio.list_layers(dest):
                        lyr = f"{dataset.replace('-', '_')}__{Path(name).stem.lower()}"
                        if len(pyogrio.list_layers(dest)) > 1:
                            lyr += f"__{src_layer.lower()}"
                        if force or layer_count(city, lyr) is None:
                            gdf = gpd.read_file(dest, layer=src_layer, engine="pyogrio")
                            gdf = gdf.to_crs(CRS) if gdf.crs else gdf.set_crs(CRS)
                            write_layer(gdf, city, lyr)
                        record("heat", "barcelona", city, lyr, f"{title} — {name}", ORG_ODBCN, res["url"], license_)
                except Exception as exc:  # noqa: BLE001
                    traceback.print_exc()
                    record("heat", "barcelona", dest, None, f"{title} — {name}", ORG_ODBCN, res["url"], license_,
                           status="error", error=repr(exc))
            elif fmt == "CSV":
                dest = raw / dataset / (name if name.lower().endswith(".csv") else f"{name}.csv")
                try:
                    download(res["url"], dest, force)
                    extra = None
                    if dataset == "xarxa-refugis-climatics":
                        extra = shelters_to_layer(dest, city, force)
                        record("heat", "barcelona", city, "climate_shelters", "Climate shelter network — one point "
                               "per shelter", ORG_ODBCN, res["url"], license_)
                    record("heat", "barcelona", dest, None, f"{title} — {name}", ORG_ODBCN, res["url"], license_,
                           extra=extra)
                except Exception as exc:  # noqa: BLE001
                    traceback.print_exc()
                    record("heat", "barcelona", dest, None, f"{title} — {name}", ORG_ODBCN, res["url"], license_,
                           status="error", error=repr(exc))

    for pdf, theme, title in ATLAS_PDFS:
        if theme != "heat":
            continue
        dest = DOCS_DIR / pdf
        guarded("heat", "barcelona", dest, None, title, ORG_ATLAS, f"{ATLAS_URL}/docs/{pdf}", LIC_ATLAS)(
            lambda p=pdf, d=dest: download(f"{ATLAS_URL}/docs/{p}", d, force))


def shelters_to_layer(csv_path: Path, gpkg: Path, force: bool) -> dict:
    """The shelters CSV is UTF-16 with one row per (shelter, attribute); keep one point per shelter."""
    raw = csv_path.read_bytes()
    text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig")
    df = pd.read_csv(io.StringIO(text), dtype=str)
    cols = ["register_id", "name", "institution_name", "addresses_road_name", "addresses_start_street_number",
            "addresses_neighborhood_name", "addresses_district_name", "geo_epgs_4326_lat", "geo_epgs_4326_lon"]
    df = df[[c for c in cols if c in df.columns]].drop_duplicates("register_id")
    df = df.dropna(subset=["geo_epgs_4326_lat", "geo_epgs_4326_lon"])
    gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.geo_epgs_4326_lon.astype(float),
                                                          df.geo_epgs_4326_lat.astype(float)), crs="EPSG:4326")
    if force or layer_count(gpkg, "climate_shelters") is None:
        write_layer(gdf.to_crs(CRS), gpkg, "climate_shelters")
    return {"rows": int(len(text.splitlines()) - 1), "encoding": "utf-16" if raw[:2] == b"\xff\xfe" else "utf-8"}


# ── Manifest + README ────────────────────────────────────────────────────────

THEME_TITLES = {"flood": "Floods", "fire": "Wildfires", "heat": "Heat"}


def human_size(p: Path) -> str:
    if not p.exists():
        return "—"
    n = p.stat().st_size
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def merge_records(prev: list[dict], themes: list[str]) -> list[dict]:
    """Keep manifest entries of themes that were not re-run."""
    keep = [r for r in prev if r["theme"] not in themes]
    return keep + records


def write_readme(recs: list[dict]) -> None:
    ok = [r for r in recs if r["status"] == "ok"]
    errs = [r for r in recs if r["status"] == "error"]
    files = sorted({OUT_DIR / r["file"] for r in recs if (OUT_DIR / r["file"]).exists()})
    lines = [
        "# Climate-risk data (floods, wildfires, heat)",
        "",
        "Generated by `scripts/fetch_climate_risk.py` — do not edit by hand, re-run the script instead.",
        f"Last run: {now_iso()}. Raw data for offline analysis; not used by the frontend.",
        "",
        "## Overview",
        "",
        "- **Floods, Catalonia** — ACA river flood zones T10/T100/T500, ARPSI (incl. pluvial), historic floods "
        "(WFS `sig.gencat.cat/ows/AIGUA`); Protecció Civil geomorphological flood zones.",
        "- **Floods, Barcelona** — Atles de resiliència (Ajuntament de Barcelona): pluvial hazard index and sewer "
        "behaviour (current + 2040 scenarios), RESCCUE 2D model water depth for T10/T100 (current + future), "
        "property damage per barri. Pulled from the atlas' CARTO account (`urbisadmin`) with the read key "
        "embedded in the public viewer. Plus Catalonia layers clipped to the city.",
        "- **Wildfires** — Generalitat structural hazard raster 2024, burned-area perimeters 1986–2024, "
        "Protecció Civil INFOCAT municipal danger/vulnerability and the wildland–urban interface zone.",
        "- **Heat, Barcelona** — Open Data BCN heat-wave layers from the Atles de resiliència (GPKG, CC-BY-4.0), "
        "climate shelters, historic temperatures.",
        "",
        f"Layers OK: **{len(ok)}**, errors: **{len(errs)}**. All vector layers are EPSG:25831 (ETRS89 / UTM 31N).",
        "",
        "### Files",
        "",
        "| File | Size |",
        "|---|---|",
    ]
    lines += [f"| `{f.relative_to(OUT_DIR)}` | {human_size(f)} |" for f in files]
    lines += ["| `raw/` | original downloads (zips, GPKG, GML, CSV) |", ""]

    for theme in ("flood", "fire", "heat"):
        rows = [r for r in recs if r["theme"] == theme]
        if not rows:
            continue
        lines += [f"## {THEME_TITLES[theme]}", ""]
        for scope in ("catalonia", "barcelona"):
            srows = [r for r in rows if r["scope"] == scope]
            if not srows:
                continue
            lines += [f"### {scope.capitalize()}", "",
                      "| File · layer | What it is | Source | Features · geometry | Key fields | License | Fetched |",
                      "|---|---|---|---|---|---|---|"]
            for r in srows:
                where = f"`{r['file']}`" + (f" · `{r['layer']}`" if r.get("layer") else "")
                src = f"{r['source_org']}<br>{r['source_url']}" if r.get("source_org") else r.get("source_url", "")
                if r["status"] == "ok" and "features" in r:
                    feats = f"{r['features']:,} · {r.get('geometry') or '—'}"
                elif r["status"] == "ok":
                    feats = human_size(OUT_DIR / r["file"])
                else:
                    feats = f"**{r['status']}**" + (f": {r['error'][:120]}" if r.get("error") else "")
                fields = ", ".join(f for f in r.get("fields", [])[:10])
                if len(r.get("fields", [])) > 10:
                    fields += ", …"
                lines.append(f"| {where} | {r['title']} | {src} | {feats} | {fields} | {r['license']} | "
                             f"{r['fetched']} |")
            lines.append("")

    lines += ["## Not downloaded", ""]
    lines += [f"- **{name}** — {why}" for name, why in SKIPPED]
    lines += [
        "",
        "## Notes",
        "",
        "- Atlas / RESCCUE tables (`flood_bcn.gpkg: bcn_*`) have no explicit license on the viewer; fine for "
        "analysis, confirm with the Ajuntament before using them in the product.",
        "- Scenario naming in the atlas: `_a2` = 2040 'passive' scenario, `_b1` = 2040 'committed' scenario. "
        "RESCCUE 'future' scenario definition: see `docs/ResumExecutiu_RESCCUE.pdf`.",
        "- RESCCUE depth layers: `depth2d` (m), `speed2d` (m/s), `hzped` / `hzveh` = hazard to pedestrians / "
        "vehicles. `forabcn` is a 0/1 flag; the name reads 'outside BCN' but every current-scenario cell is 1 — "
        "check its meaning before filtering on it.",
        "- A source column named `fid` is stored as `src_fid` (GeoPackage reserves `fid` for its primary key).",
        "- INFOCAT municipal layers: the WFS exposes geometry only, so `level` / `level_rank` were read from the "
        "WMS map colours at an interior point of each municipality and matched to the WMS legend; "
        "municipality names joined from `data/areas/catalonia_municipis_icgc.geojson`.",
        "- Fire hazard raster: value attribute table in `fire_hazard_2024.tif.vat.dbf`; nodata = 15.",
        "- ACA flood layers cover only Catalonia's internal basins (Barcelona, Girona, Tarragona coast); "
        "the Ebro basin is not included.",
        "",
    ]
    README.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="+", choices=["flood", "fire", "heat"], default=["flood", "fire", "heat"])
    ap.add_argument("--force", action="store_true", help="re-download even if data is present")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bcn = bcn_boundary()
    if "flood" in args.only:
        run_flood(args.force, bcn)
    if "fire" in args.only:
        run_fire(args.force, bcn)
    if "heat" in args.only:
        run_heat(args.force)

    prev = json.loads(MANIFEST.read_text())["layers"] if MANIFEST.exists() else []
    recs = merge_records(prev, args.only)
    MANIFEST.write_text(json.dumps({"generated": now_iso(), "layers": recs, "skipped": [
        {"name": n, "reason": r} for n, r in SKIPPED]}, indent=2, ensure_ascii=False))
    write_readme(recs)
    errors = [r for r in recs if r["status"] == "error"]
    print(f"\nDone: {len(recs) - len(errors)} ok, {len(errors)} errors → {README.relative_to(ROOT)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
