"""Unit tests for lden_avg (TODO-026 — noise area-average vs centroid)."""

import sys
import os
import unittest

import importlib.util

from shapely.geometry import shape
from shapely.strtree import STRtree
import h3

_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prepare-livability-grid.py")
_spec = importlib.util.spec_from_file_location("prepare_livability_grid", _script)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
lden_at = _mod.lden_at
lden_avg = _mod.lden_avg


def _make_noise(polygons_ldens):
    """Build a noise tuple (tree, geoms, ldens) from a list of (geojson_polygon, lden)."""
    geoms = [shape(g) for g, _ in polygons_ldens]
    ldens = [v for _, v in polygons_ldens]
    tree = STRtree(geoms)
    return tree, geoms, ldens


# A real H3 cell in central Barcelona (res 9)
BCN_CELL = h3.latlng_to_cell(41.390, 2.154, 9)


def _bbox_polygon(minx, miny, maxx, maxy):
    return {
        "type": "Polygon",
        "coordinates": [[
            [minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy], [minx, miny]
        ]],
    }


class TestLdenAt(unittest.TestCase):
    def test_point_inside_polygon(self):
        noise = _make_noise([(_bbox_polygon(2.0, 41.0, 3.0, 42.0), 55.0)])
        self.assertEqual(lden_at(noise, 2.5, 41.5), 55.0)

    def test_point_outside_all_polygons(self):
        noise = _make_noise([(_bbox_polygon(2.0, 41.0, 2.1, 41.1), 55.0)])
        self.assertIsNone(lden_at(noise, 2.9, 41.9))

    def test_none_noise_returns_none(self):
        self.assertIsNone(lden_at(None, 2.5, 41.5))


class TestLdenAvg(unittest.TestCase):
    def test_homogeneous_cell_returns_single_value(self):
        """All sub-points fall in same polygon → avg equals that lden."""
        lat, lng = h3.cell_to_latlng(BCN_CELL)
        # Large polygon covering the whole cell + margin
        noise = _make_noise([(_bbox_polygon(lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05), 60.0)])
        result = lden_avg(noise, BCN_CELL, 11)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, 60.0, places=5)

    def test_boundary_cell_averages_two_zones(self):
        """Cell straddles a boundary: left half ~45 dB, right half ~65 dB → avg ~55 dB."""
        lat, lng = h3.cell_to_latlng(BCN_CELL)
        noise = _make_noise([
            (_bbox_polygon(lng - 0.05, lat - 0.05, lng, lat + 0.05), 45.0),
            (_bbox_polygon(lng, lat - 0.05, lng + 0.05, lat + 0.05), 65.0),
        ])
        result = lden_avg(noise, BCN_CELL, 11)
        self.assertIsNotNone(result)
        # Should be between 45 and 65 (boundary split may not be exact 50/50 for a hexagon)
        self.assertGreater(result, 45.0)
        self.assertLess(result, 65.0)

    def test_no_coverage_returns_none(self):
        """No polygon overlaps cell → None."""
        noise = _make_noise([(_bbox_polygon(0.0, 0.0, 0.001, 0.001), 55.0)])
        self.assertIsNone(lden_avg(noise, BCN_CELL, 11))

    def test_none_noise_returns_none(self):
        self.assertIsNone(lden_avg(None, BCN_CELL, 11))

    def test_partial_coverage_averages_covered_points(self):
        """Only part of sub-points covered → average only covered ones."""
        lat, lng = h3.cell_to_latlng(BCN_CELL)
        # Tiny polygon covering only the centroid area
        noise = _make_noise([(_bbox_polygon(lng - 0.001, lat - 0.001, lng + 0.001, lat + 0.001), 70.0)])
        result = lden_avg(noise, BCN_CELL, 11)
        # Some sub-points will be covered, result should be 70.0
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, 70.0, places=5)


if __name__ == "__main__":
    unittest.main()
