"""Unit tests for scripts/climate_risk.py (036 — flood & wildfire exposure per H3 cell).

Run (h3 is installed as an x86_64 wheel on this machine):
  arch -x86_64 python3 -m unittest scripts/test_climate_risk.py
"""

import math
import os
import sys
import unittest

import h3
from shapely.geometry import box
from shapely.prepared import prep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import climate_risk as cr  # noqa: E402

# A real H3 res-9 cell in central Barcelona; samples at res 11 (~49 points).
BCN_CELL = h3.latlng_to_cell(41.390, 2.154, 9)
SAMPLE_RES = 11
SAMPLES = cr.cell_samples(BCN_CELL, SAMPLE_RES)
CX, CY = cr.to_metric(*h3.cell_to_latlng(BCN_CELL))


def square(cx, cy, half):
    return prep(box(cx - half, cy - half, cx + half, cy + half))


def left_half(cx, cy, size=2000):
    """Covers everything west of the cell centre."""
    return prep(box(cx - size, cy - size, cx, cy + size))


class TestCellSamples(unittest.TestCase):
    def test_samples_are_children_in_metres_around_centre(self):
        self.assertEqual(len(SAMPLES), 49)
        for x, y in SAMPLES:
            self.assertLess(math.hypot(x - CX, y - CY), 300)


class TestFloodShares(unittest.TestCase):
    def test_cell_fully_inside_t500_only(self):
        zones = {"t500": square(CX, CY, 1000)}
        self.assertEqual(cr.flood_shares(SAMPLES, zones),
                         {"flood_t10": 0.0, "flood_t100": 0.0, "flood_t500": 1.0})

    def test_shares_are_forced_nested(self):
        # T10 polygon present but T100 / T500 polygons missing at this spot → still nested.
        zones = {"t10": square(CX, CY, 1000)}
        s = cr.flood_shares(SAMPLES, zones)
        self.assertEqual(s["flood_t10"], 1.0)
        self.assertEqual(s["flood_t100"], 1.0)
        self.assertEqual(s["flood_t500"], 1.0)

    def test_half_covered_cell(self):
        zones = {"t100": left_half(CX, CY)}
        s = cr.flood_shares(SAMPLES, zones)
        self.assertEqual(s["flood_t10"], 0.0)
        self.assertGreater(s["flood_t100"], 0.3)
        self.assertLess(s["flood_t100"], 0.7)
        self.assertEqual(s["flood_t500"], s["flood_t100"])

    def test_no_zones(self):
        zones = {"t500": square(CX + 5000, CY, 100)}
        self.assertEqual(cr.flood_shares(SAMPLES, zones),
                         {"flood_t10": 0.0, "flood_t100": 0.0, "flood_t500": 0.0})


class TestPixelHazard(unittest.TestCase):
    def test_pixel_at_point_gives_class_over_ten(self):
        forest = cr.make_forest([(CX, CY)], [10])
        value, cls, dist = cr.pixel_hazard(CX, CY, forest, radius_m=500, decay_m=150)
        self.assertAlmostEqual(value, 1.0)
        self.assertEqual(cls, 10)
        self.assertAlmostEqual(dist, 0.0)

    def test_exponential_decay(self):
        forest = cr.make_forest([(CX + 150, CY)], [10])
        value, _, dist = cr.pixel_hazard(CX, CY, forest, radius_m=500, decay_m=150)
        self.assertAlmostEqual(value, math.exp(-1), places=6)
        self.assertAlmostEqual(dist, 150.0)

    def test_beyond_radius_is_zero(self):
        forest = cr.make_forest([(CX + 600, CY)], [10])
        self.assertEqual(cr.pixel_hazard(CX, CY, forest, radius_m=500, decay_m=150), (0.0, None, None))

    def test_picks_largest_contribution(self):
        # Class 3 right here (0.3) vs class 10 at 100 m (1.0·e^(−100/150) ≈ 0.51) → class 10 wins.
        forest = cr.make_forest([(CX, CY), (CX + 100, CY)], [3, 10])
        value, cls, dist = cr.pixel_hazard(CX, CY, forest, radius_m=500, decay_m=150)
        self.assertEqual(cls, 10)
        self.assertAlmostEqual(dist, 100.0)
        self.assertAlmostEqual(value, math.exp(-100 / 150), places=6)

    def test_empty_forest(self):
        forest = cr.make_forest([], [])
        self.assertEqual(cr.pixel_hazard(CX, CY, forest, radius_m=500, decay_m=150), (0.0, None, None))


class TestFireExposure(unittest.TestCase):
    def test_cell_in_wui_next_to_forest(self):
        wui = square(CX, CY, 1000)
        forest = cr.make_forest([(CX + 300, CY)], [9])
        r = cr.fire_exposure(SAMPLES, (CX, CY), wui, forest, radius_m=500, decay_m=150)
        self.assertEqual(r["fire_wui"], 1.0)
        self.assertGreater(r["fire_hazard"], 0.0)
        self.assertLess(r["fire_hazard"], 0.9)
        self.assertEqual(r["fire_class"], 9)
        self.assertEqual(r["fire_dist_m"], 300)

    def test_outside_wui_keeps_hazard_but_zero_share(self):
        # Urban park pixel next to the cell, but no WUI here: the gate is applied in the frontend.
        wui = square(CX + 5000, CY, 100)
        forest = cr.make_forest([(CX, CY)], [8])
        r = cr.fire_exposure(SAMPLES, (CX, CY), wui, forest, radius_m=500, decay_m=150)
        self.assertEqual(r["fire_wui"], 0.0)
        self.assertGreater(r["fire_hazard"], 0.0)

    def test_no_forest_nearby(self):
        wui = square(CX, CY, 1000)
        forest = cr.make_forest([(CX + 5000, CY)], [10])
        r = cr.fire_exposure(SAMPLES, (CX, CY), wui, forest, radius_m=500, decay_m=150)
        self.assertEqual(r, {"fire_wui": 1.0, "fire_hazard": 0.0, "fire_class": None, "fire_dist_m": None})


class TestForestPolygons(unittest.TestCase):
    def test_adjacent_pixels_of_same_class_merge(self):
        forest = cr.make_forest([(CX, CY), (CX + 100, CY), (CX, CY + 500)], [7, 7, 3])
        polys = dict(cr.forest_polygons(forest, pixel_m=100))
        self.assertEqual(sorted(polys), [3, 7])
        self.assertAlmostEqual(polys[7].area, 20000, places=3)
        self.assertEqual(polys[7].geom_type, "Polygon")
        self.assertAlmostEqual(polys[3].area, 10000, places=3)

    def test_empty_forest(self):
        self.assertEqual(cr.forest_polygons(cr.make_forest([], []), pixel_m=100), [])


class TestEnrichWithClimate(unittest.TestCase):
    def test_adds_all_fields(self):
        features = [{"properties": {"h3": BCN_CELL}}]
        inputs = cr.ClimateInputs(
            zones={"t500": square(CX, CY, 1000)},
            wui=square(CX, CY, 1000),
            forest=cr.make_forest([(CX, CY)], [5]),
        )
        cr.enrich_with_climate(features, inputs, sample_res=SAMPLE_RES, radius_m=500, decay_m=150)
        p = features[0]["properties"]
        for key in ("flood_t10", "flood_t100", "flood_t500", "fire_wui", "fire_hazard", "fire_class", "fire_dist_m"):
            self.assertIn(key, p)
        self.assertEqual(p["flood_t500"], 1.0)
        self.assertEqual(p["fire_class"], 5)

    def test_missing_inputs_leave_fields_null(self):
        features = [{"properties": {"h3": BCN_CELL}}]
        cr.enrich_with_climate(features, None, sample_res=SAMPLE_RES, radius_m=500, decay_m=150)
        p = features[0]["properties"]
        self.assertIsNone(p["flood_t500"])
        self.assertIsNone(p["fire_hazard"])


if __name__ == "__main__":
    unittest.main()
