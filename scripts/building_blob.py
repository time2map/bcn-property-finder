#!/usr/bin/env python3
"""
Score columns of the buildings as binary files for the app (TODO-046, format 2 since TODO-058).

Two files, so the map can be coloured before the positions have arrived:
  buildings-scores.bin.gz     every column the scoring reads
  buildings-positions.bin.gz  lng, lat (the card, Boost contrast, the area join, best zones)

Each column is a little-endian typed array (u8, u16, f32) that starts on a 4-byte boundary of its file. Columns of
more than one byte are stored as byte planes ("layout": "planes"): first byte 0 of every value, then byte 1, …
Neighbouring buildings have similar values, so the planes of high bytes are long runs and gzip packs them better
(-15 % for the scores, -27 % for the positions). The app puts the bytes back together (buildingData.ts).

Meta per column: name, type, scale, offset (in its file), sentinel, file ("scores" / "positions"), layout
("plain" / "planes").

Repack files of format 1 (one file, plain columns) without running the pipeline; the values do not change:
  python3 scripts/building_blob.py --repack
"""

import gzip
import json
import sys
from pathlib import Path

import numpy as np

PUBLIC = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"
FILES = {"scores": "buildings-scores.bin.gz", "positions": "buildings-positions.bin.gz"}
POSITION_COLUMNS = {"lng", "lat"}
U8, U16 = 255, 65535
DTYPES = {"u8": "<u1", "u16": "<u2", "f32": "<f4"}


def to_planes(arr):
    """Typed array → its bytes as planes (all byte 0, then all byte 1, …); u8 stays as it is."""
    k = arr.dtype.itemsize
    if k == 1:
        return arr.tobytes()
    return np.ascontiguousarray(arr.view(np.uint8).reshape(-1, k).T).tobytes()


def from_planes(raw, kind, count):
    """Inverse of to_planes."""
    k = np.dtype(DTYPES[kind]).itemsize
    planes = np.frombuffer(raw, dtype=np.uint8, count=count * k).reshape(k, count)
    return np.ascontiguousarray(planes.T).view(DTYPES[kind]).reshape(count)


def pack_files(columns):
    """[(name, kind, scale, typed array)] → ({file: bytes}, meta columns). Arrays come from `encode`."""
    blobs = {f: [] for f in FILES}
    offsets = {f: 0 for f in FILES}
    meta = []
    for name, kind, scale, arr in columns:
        file = "positions" if name in POSITION_COLUMNS else "scores"
        data = to_planes(arr)
        meta.append({"name": name, "type": kind, "scale": scale, "offset": offsets[file],
                     "sentinel": None if kind == "f32" else (U8 if kind == "u8" else U16),
                     "file": file, "layout": "planes" if arr.dtype.itemsize > 1 else "plain"})
        pad = (-len(data)) % 4
        blobs[file].append(data + b"\0" * pad)
        offsets[file] += len(data) + pad
    return {f: b"".join(parts) for f, parts in blobs.items()}, meta


def write_files(out_dir, columns, meta):
    """Writes the binary files and returns `meta` with format 2 and its columns."""
    blobs, meta_cols = pack_files(columns)
    for file, blob in blobs.items():
        with gzip.GzipFile(out_dir / FILES[file], "wb", compresslevel=9, mtime=0) as f:
            f.write(blob)
    return {**meta, "version": 2, "columns": meta_cols}


def read_columns(out_dir, meta):
    """The columns of the files in `out_dir` (format 1 or 2) as [(name, kind, scale, typed array)]."""
    count = meta["count"]
    raw = {}
    result = []
    for c in meta["columns"]:
        file = c.get("file", "scores")
        if file not in raw:
            raw[file] = gzip.decompress((out_dir / FILES[file]).read_bytes())
        k = np.dtype(DTYPES[c["type"]]).itemsize
        chunk = raw[file][c["offset"]:c["offset"] + count * k]
        if c.get("layout", "plain") == "planes":
            arr = from_planes(chunk, c["type"], count)
        else:
            arr = np.frombuffer(chunk, dtype=DTYPES[c["type"]], count=count).copy()
        result.append((c["name"], c["type"], c["scale"], arr))
    return result


def repack(out_dir=PUBLIC):
    meta_path = out_dir / "buildings-meta.json"
    meta = json.loads(meta_path.read_text())
    before = sum((out_dir / f).stat().st_size for f in FILES.values() if (out_dir / f).exists())
    columns = read_columns(out_dir, meta)
    new_meta = write_files(out_dir, columns, meta)
    # Check: every column reads back the same.
    for (name, _, _, a), (_, _, _, b) in zip(columns, read_columns(out_dir, new_meta)):
        if not np.array_equal(a.view(np.uint8), b.view(np.uint8)):
            raise SystemExit(f"repack changed the column {name}")
    meta_path.write_text(json.dumps(new_meta, ensure_ascii=False, separators=(",", ":")))
    after = {f: (out_dir / f).stat().st_size for f in FILES.values()}
    print(f"{before / 1024:.0f} KB → " + ", ".join(f"{f} {s / 1024:.0f} KB" for f, s in after.items()))


if __name__ == "__main__":
    if sys.argv[1:] == ["--repack"]:
        repack()
    else:
        print(__doc__)
