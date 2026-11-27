"""Tests of the binary score files (format 2, TODO-058). numpy only: python3 -m unittest scripts/test_building_blob.py"""

import gzip
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import building_blob as bb  # noqa: E402


def encoded():
    return [
        ("lng", "f32", 1, np.array([2.17, np.nan], dtype="<f4")),
        ("lat", "f32", 1, np.array([41.38, 41.39], dtype="<f4")),
        ("lden_avg", "u16", 10, np.array([624, 65535], dtype="<u2")),
        ("walk_park", "u8", 1, np.array([87, 255], dtype="<u1")),
        ("year_built", "u16", 1, np.array([1925, 2001], dtype="<u2")),
    ]


class TestPlanes(unittest.TestCase):
    def test_planes_group_the_bytes_by_position(self):
        arr = np.array([0x0102, 0x0304], dtype="<u2")
        self.assertEqual(bb.to_planes(arr), bytes([0x02, 0x04, 0x01, 0x03]))
        self.assertEqual(bb.from_planes(bb.to_planes(arr), "u16", 2).tolist(), [0x0102, 0x0304])

    def test_one_byte_columns_stay_as_they_are(self):
        arr = np.array([1, 2, 3], dtype="<u1")
        self.assertEqual(bb.to_planes(arr), arr.tobytes())


class TestFiles(unittest.TestCase):
    def test_two_files_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            meta = bb.write_files(out, encoded(), {"count": 2, "generated": "2026-11-13"})
            self.assertEqual(meta["version"], 2)
            cols = {c["name"]: c for c in meta["columns"]}
            self.assertEqual({n for n, c in cols.items() if c["file"] == "positions"}, {"lng", "lat"})
            self.assertEqual(cols["walk_park"]["layout"], "plain")
            self.assertEqual(cols["lden_avg"]["layout"], "planes")
            self.assertEqual(cols["lden_avg"]["sentinel"], 65535)
            self.assertIsNone(cols["lng"]["sentinel"])
            self.assertTrue(all(c["offset"] % 4 == 0 for c in meta["columns"]))
            self.assertEqual(cols["lng"]["offset"], 0)
            self.assertEqual(cols["lden_avg"]["offset"], 0)
            for (name, _, _, a), (_, _, _, b) in zip(encoded(), bb.read_columns(out, meta)):
                self.assertEqual(a.view(np.uint8).tolist(), b.view(np.uint8).tolist(), name)

    def test_repack_converts_format_1_without_changing_a_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            blob, columns, offset = b"", [], 0
            for name, kind, scale, arr in encoded():
                data = arr.tobytes()
                pad = (-len(data)) % 4
                columns.append({"name": name, "type": kind, "scale": scale, "offset": offset,
                                "sentinel": None if kind == "f32" else (255 if kind == "u8" else 65535)})
                blob += data + b"\0" * pad
                offset += len(data) + pad
            (out / bb.FILES["scores"]).write_bytes(gzip.compress(blob))
            (out / "buildings-meta.json").write_text(json.dumps({"version": 1, "count": 2, "columns": columns, "areas": []}))
            bb.repack(out)
            meta = json.loads((out / "buildings-meta.json").read_text())
            self.assertEqual(meta["version"], 2)
            self.assertEqual(meta["areas"], [])
            self.assertTrue((out / bb.FILES["positions"]).exists())
            for (name, _, _, a), (_, _, _, b) in zip(encoded(), bb.read_columns(out, meta)):
                self.assertEqual(a.view(np.uint8).tolist(), b.view(np.uint8).tolist(), name)


@unittest.skipUnless((bb.PUBLIC / "buildings-meta.json").exists(), "map data not built")
class TestGenerated(unittest.TestCase):
    def test_public_files_are_format_2_and_readable(self):
        meta = json.loads((bb.PUBLIC / "buildings-meta.json").read_text())
        self.assertEqual(meta["version"], 2)
        cols = {name: arr for name, _, _, arr in bb.read_columns(bb.PUBLIC, meta)}
        self.assertEqual(len(cols["lng"]), meta["count"])
        lng = cols["lng"][~np.isnan(cols["lng"])]
        self.assertTrue(1.5 < np.median(lng) < 2.6)
        years = cols["year_built"][cols["year_built"] != 65535]
        self.assertTrue(1900 < np.median(years) < 2000)


if __name__ == "__main__":
    unittest.main()
