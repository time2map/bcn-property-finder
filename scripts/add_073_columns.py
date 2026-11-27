#!/usr/bin/env python3
"""
One-off data step for TODO-073 without rerunning the pipeline: add the columns the app now scores with to the
shipped score file, from the shipped card tiles.

  lden_street  noise on the street side (u16, ×10): the noise condition is scored on it (stage B1)
  dwellings    homes in the building, at least 1 (u16): ranks and shares count homes (stage A5)
  minutes_cap  in the meta: how far the minutes columns of these files reach (stage A4)

Both columns are already in buildings-detail.pmtiles (layer `d`, one point per building, `i` = row), written by
build_building_tiles.py from the same tables, so the values are the pipeline's own. The next full run of
build_building_tiles.py writes them directly and this script is not needed.

minutes_cap here is the reach of the shipped data (services 1,500 m = 18.75 min, City Core 90 min), not the longer
reach of the new pipeline: the files were built before it.

Needs: pip install pmtiles mapbox-vector-tile numpy
  python3 scripts/add_073_columns.py            # dry run: counts and medians
  python3 scripts/add_073_columns.py --apply    # rewrites buildings-scores.bin.gz and buildings-meta.json
"""

import gzip
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import building_blob as bb  # noqa: E402

DETAIL = bb.PUBLIC / "buildings-detail.pmtiles"
OLD_MINUTES_CAP = {"walk": 1500 / 80, "cityCore": 90}


def card_values(path=DETAIL):
    """{row: (dwellings, lden_street)} from layer `d` of the card tiles."""
    import mapbox_vector_tile
    from pmtiles.reader import MmapSource, Reader, all_tiles

    out = {}
    with open(path, "rb") as f:
        reader = Reader(MmapSource(f))
        for _zxy, data in all_tiles(reader.get_bytes):
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            layer = mapbox_vector_tile.decode(data).get("d")
            if not layer:
                continue
            for feat in layer["features"]:
                p = feat["properties"]
                out[int(p["i"])] = (p.get("dwellings"), p.get("lden_street"))
    return out


def columns_for(count, values):
    """The two typed arrays (sentinels for no value) for `count` rows."""
    dwellings = np.full(count, np.nan)
    street = np.full(count, np.nan)
    for i, (d, s) in values.items():
        if 0 <= i < count:
            dwellings[i] = np.nan if d is None else float(d)
            street[i] = np.nan if s is None else float(s)
    dwellings = np.maximum(np.nan_to_num(dwellings, nan=0), 1)  # = build_building_tiles.dwelling_weight
    return {
        "lden_street": np.where(np.isnan(street), bb.U16, np.clip(np.round(np.nan_to_num(street) * 10), 0, bb.U16 - 1)).astype("<u2"),
        "dwellings": np.clip(np.round(dwellings), 1, bb.U16 - 1).astype("<u2"),
    }


def main(apply=False, out_dir=bb.PUBLIC):
    meta_path = out_dir / "buildings-meta.json"
    meta = json.loads(meta_path.read_text())
    count = meta["count"]
    values = card_values(out_dir / DETAIL.name)
    missing = count - sum(1 for i in values if 0 <= i < count)
    if missing:
        raise SystemExit(f"{missing:,} of {count:,} buildings are not in the card tiles: rebuild instead")
    new = columns_for(count, values)
    street = new["lden_street"]
    known = street[street != bb.U16] / 10
    print(f"lden_street: {len(known):,} buildings, median {np.median(known):.1f} dB; "
          f"dwellings: {int(new['dwellings'].sum()):,} homes, median {np.median(new['dwellings']):.0f}")
    if not apply:
        print("dry run; --apply to write")
        return
    cols = [c for c in bb.read_columns(out_dir, meta) if c[0] not in new]
    cols += [("lden_street", "u16", 10, new["lden_street"]), ("dwellings", "u16", 1, new["dwellings"])]
    new_meta = bb.write_files(out_dir, cols, {k: v for k, v in meta.items() if k != "columns"})
    new_meta.setdefault("minutes_cap", OLD_MINUTES_CAP)
    meta_path.write_text(json.dumps(new_meta, ensure_ascii=False, separators=(",", ":")))
    print(f"→ {meta_path.name}, {bb.FILES['scores']}")


if __name__ == "__main__":
    main(apply="--apply" in sys.argv[1:])
