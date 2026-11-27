#!/usr/bin/env python3
"""
One-off data fix without rerunning the pipeline: drop the false beach access from the shipped blob.

OSM tags a paved pool deck in Nou Barris natural=beach (way 1202318704), so Porta, Sant Andreu and la Prosperitat
came out within walking range of a beach. The blob keeps only `min_beach` (walking minutes, 255 = none). A walking
path is never shorter than the straight line, so a building farther than the reach of min_beach in a straight line from every
real beach (surface not paved) cannot be within walking range of one: its `min_beach` becomes 255.
Buildings near a real beach keep their minutes. The next full pipeline run (extract_poi.py BEACH_WHERE) gives the
exact values; this script only removes the false positives.

  python3 scripts/fix_beach_minutes.py beaches.json [--apply]
beaches.json: Overpass `(way["natural"="beach"](bbox); rel["natural"="beach"](bbox);)->.b; rel.b; out tags;
  way(r.b); out geom; way.b; out geom tags;` (bbox covers the whole blob: 41.18,1.80,41.66,2.40). Dry run by default.
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import building_blob as bb  # noqa: E402

WALK_SPEED_M_MIN = 80.0
OLD_REACH_MIN = 1500.0 / WALK_SPEED_M_MIN  # files built before TODO-073 have no minutes_cap


def reach_m(meta):
    """How far min_beach reaches in these files, in metres: the meta's minutes_cap (TODO-073: 2,400 m after a full
    run), else the old 1,500 m. A fixed 1,500 m would clear real beach minutes between 1.5 and 2.4 km."""
    return (meta.get("minutes_cap") or {}).get("walk", OLD_REACH_MIN) * WALK_SPEED_M_MIN
PAVED = {"asphalt", "concrete", "paved", "paving_stones", "tartan", "artificial_turf", "wood"}  # = extract_poi.py
LAT0 = 41.39
M_LAT = 111_320.0
M_LNG = M_LAT * np.cos(np.radians(LAT0))


def to_m(lng, lat):
    return np.column_stack([np.asarray(lng) * M_LNG, np.asarray(lat) * M_LAT])


def edge_points(ring, step_m=20.0):
    xy = to_m(*zip(*ring))
    out = [xy[:1]]
    for a, b in zip(xy[:-1], xy[1:]):
        n = max(1, int(np.hypot(*(b - a)) // step_m))
        t = np.linspace(0, 1, n + 1)[1:, None]
        out.append(a + (b - a) * t)
    return np.vstack(out)


def real_beach_points(elements):
    """Edge points of every way with geometry whose own surface is not paved.

    Relations come with tags only; their member ways come with geometry. A relation with a paved surface would
    need its members dropped, which this file cannot tell, so it stops instead of guessing."""
    for e in elements:
        if e["type"] == "relation" and e.get("tags", {}).get("surface") in PAVED:
            raise SystemExit(f"relation {e['id']} is paved ({e['tags'].get('name')}): add its members to the query")
    ways = [e for e in elements if e["type"] == "way" and e.get("geometry")]
    keep = [w for w in ways if w.get("tags", {}).get("surface") not in PAVED]
    for w in ways:
        if w not in keep:
            print(f"   dropped way {w['id']} surface={w['tags'].get('surface')}")
    return np.vstack([edge_points([(p["lon"], p["lat"]) for p in w["geometry"]]) for w in keep]), len(keep)


def main(path, apply):
    elements = json.loads(Path(path).read_text())["elements"]
    pts, n = real_beach_points(elements)
    print(f"   {n} real beach ways, {len(pts):,} edge points")
    meta = json.loads((bb.PUBLIC / "buildings-meta.json").read_text())
    cols = bb.read_columns(bb.PUBLIC, meta)
    reach = reach_m(meta)
    by = {c[0]: c for c in cols}
    xy = to_m(by["lng"][3], by["lat"][3])
    mn = by["min_beach"][3]
    near = np.zeros(len(xy), bool)
    for i in range(0, len(xy), 4000):  # chunks keep memory small
        d2 = ((xy[i:i + 4000, None, :] - pts[None, :, :]) ** 2).sum(-1).min(1)
        near[i:i + 4000] = d2 <= reach ** 2
    bad = (mn != bb.U8) & ~near
    print(f"   min_beach set: {(mn != bb.U8).sum():,} → cleared {bad.sum():,} (> {reach:.0f} m from a real beach)")
    if not apply:
        print("dry run; pass --apply to write")
        return
    mn[bad] = bb.U8
    new_meta = bb.write_files(bb.PUBLIC, cols, meta)
    (bb.PUBLIC / "buildings-meta.json").write_text(json.dumps(new_meta, ensure_ascii=False, separators=(",", ":")))
    print("written")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(1)
    main(args[0], "--apply" in sys.argv)
