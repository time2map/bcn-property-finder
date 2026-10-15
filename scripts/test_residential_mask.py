"""Unit tests for nonres_share (feature 039 — residential mask)."""

import json
import os
import unittest

import importlib.util

from shapely.geometry import box
from shapely.strtree import STRtree
import h3

_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prepare-livability-grid.py")
_spec = importlib.util.spec_from_file_location("prepare_livability_grid", _script)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
nonres_share = _mod.nonres_share

# A real H3 cell in central Barcelona (res 9)
BCN_CELL = h3.latlng_to_cell(41.390, 2.154, 9)
LAT, LNG = h3.cell_to_latlng(BCN_CELL)


WORLD = box(-180, -90, 180, 90)
WEST_HALF = box(LNG - 0.05, LAT - 0.05, LNG, LAT + 0.05)
EAST_HALF = box(LNG, LAT - 0.05, LNG + 0.05, LAT + 0.05)


def _share(geoms, land=WORLD):
    return nonres_share(BCN_CELL, STRtree(geoms), geoms, land)


class TestNonresShare(unittest.TestCase):
    def test_no_polygons_nearby(self):
        self.assertEqual(_share([box(0.0, 0.0, 0.001, 0.001)]), 0.0)

    def test_fully_covered(self):
        self.assertAlmostEqual(_share([box(LNG - 0.05, LAT - 0.05, LNG + 0.05, LAT + 0.05)]), 1.0)

    def test_half_covered(self):
        self.assertAlmostEqual(_share([WEST_HALF]), 0.5, delta=0.05)

    def test_overlapping_polygons_not_double_counted(self):
        self.assertAlmostEqual(_share([WEST_HALF, WEST_HALF]), _share([WEST_HALF]))

    def test_share_is_of_land_only(self):
        """Coastal cell: half sea, the land half is all port → fully non-residential."""
        self.assertAlmostEqual(_share([WEST_HALF], land=WEST_HALF), 1.0)
        self.assertAlmostEqual(_share([EAST_HALF], land=WEST_HALF), 0.0)


GRID = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "frontend/public/data/livability-h3.geojson")


@unittest.skipUnless(os.path.exists(GRID), "grid not generated")
class TestGeneratedGrid(unittest.TestCase):
    """Happy path on the real generated grid: neighbourhoods kept, empty land masked out."""

    @classmethod
    def setUpClass(cls):
        with open(GRID) as f:
            cls.cells = {feat["properties"]["h3"] for feat in json.load(f)["features"]}

    def _has(self, lat, lng):
        return h3.latlng_to_cell(lat, lng, 9) in self.cells

    def test_residential_neighbourhoods_kept(self):
        # Gràcia, Sants, Barceloneta, L'Hospitalet — no landuse=residential in OSM, must stay.
        for lat, lng in [(41.4036, 2.1565), (41.3750, 2.1350), (41.3800, 2.1890), (41.3597, 2.0997)]:
            self.assertTrue(self._has(lat, lng), (lat, lng))

    def test_non_residential_land_dropped(self):
        # Montjuïc park, Zona Franca, El Prat airport, Llobregat delta farmland.
        for lat, lng in [(41.3640, 2.1580), (41.3400, 2.1400), (41.2970, 2.0800), (41.3100, 2.0500)]:
            self.assertFalse(self._has(lat, lng), (lat, lng))


if __name__ == "__main__":
    unittest.main()
