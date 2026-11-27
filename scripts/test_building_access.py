"""Unit tests for scripts/building_access.py (TODO-046 stage 3 — walkability and City Core on the walking network).

Run (the venv has x86_64 wheels and pandana):
  arch -x86_64 .venv-livability/bin/python -m unittest scripts/test_building_access.py
"""

import math
import os
import sys
import unittest

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import LineString, Point, Polygon

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import building_access as ba  # noqa: E402

NAN = np.nan


class TestWalkable(unittest.TestCase):
    def test_filter(self):
        ways = pd.DataFrame({
            "highway": ["residential", "motorway", "footway", "primary", "service", "service", None],
            "foot": [None, None, "no", None, None, "yes", None],
            "access": [None, None, None, None, "private", "private", None],
        })
        self.assertEqual(ba.walkable(ways).tolist(), [True, False, False, True, False, True, False])


class TestBeachFilter(unittest.TestCase):
    """Paved pool decks tagged natural=beach (Nou Barris, way 1202318704) must not count as beaches."""

    def test_where_excludes_paved_surfaces_and_keeps_sand_or_untagged(self):
        import extract_poi as ep
        self.assertIn("natural='beach'", ep.BEACH_WHERE)
        self.assertIn("surface IS NULL", ep.BEACH_WHERE)
        for paved in ("asphalt", "concrete", "paving_stones"):
            self.assertIn(f"'{paved}'", ep.BEACH_WHERE)
        for natural in ("sand", "gravel", "pebbles"):
            self.assertNotIn(f"'{natural}'", ep.BEACH_WHERE)

    def test_poi_nodes_use_the_same_filter(self):
        import extract_poi as ep
        self.assertIn(ep.BEACH_WHERE, ep.POI_WHERE)

    def test_surface_attribute_is_read(self):
        import extract_poi as ep
        self.assertEqual(ep.OSMCONF.count(",surface\n"), 2)  # points + multipolygons


class TestInlandBeachCheck(unittest.TestCase):
    def test_reports_only_inland_barris_with_beach_score(self):
        areas = gpd.GeoDataFrame(
            {"id": ["barri-0845", "barri-0960", "barri-0001"]},
            geometry=[Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]), Polygon([(20, 0), (30, 0), (30, 10), (20, 10)]),
                      Polygon([(40, 0), (50, 0), (50, 10), (40, 10)])], crs=3857)
        origins = gpd.GeoSeries([Point(5, 5), Point(6, 6), Point(25, 5), Point(45, 5)], crs=3857)
        walk_beach = np.array([30, 0, 0, 80])  # coastal barri 0001 is allowed to have a beach
        self.assertEqual(ba.inland_beach_violations(origins, walk_beach, areas), {"Porta": 1})


class TestGraph(unittest.TestCase):
    def setUp(self):
        lines = [
            LineString([(0, 0), (50, 0), (100, 0)]),   # street with a middle vertex
            LineString([(100, 0), (100, 100)]),        # shares an end → connected
            LineString([(50, -50), (50, 50)]),         # bridge over the street: no shared vertex
        ]
        self.nodes, self.edges = ba.build_graph(np.array(lines))

    def test_degree_two_vertices_folded(self):
        self.assertEqual(len(self.nodes), 5)  # (50, 0) is not a node
        self.assertEqual(sorted(self.edges["weight"].round(6).tolist()), [100, 100, 100])

    def test_long_street_gets_a_node_every_max_edge(self):
        nodes, edges = ba.build_graph(np.array([LineString([(0, 0), (100, 0)])]), max_edge_m=25)
        self.assertEqual(sorted(nodes["x"].tolist()), [0, 25, 50, 75, 100])
        self.assertEqual(edges["weight"].round(6).tolist(), [25, 25, 25, 25])

    def test_bridge_is_not_connected_and_dropped(self):
        nodes, edges = ba.largest_component(self.nodes, self.edges)
        self.assertEqual(sorted(map(tuple, nodes[["x", "y"]].values.tolist())), [(0, 0), (100, 0), (100, 100)])
        self.assertEqual(len(edges), 2)


class TestWalkScore(unittest.TestCase):
    def test_category_score_matches_formula(self):
        d = np.array([[100, 400, NAN], [1600, 1500, 2000], [NAN, NAN, NAN]], dtype=float)
        sub = ba.category_score(d, saturation=1.0, decay_m=400, rmax_m=1500)
        access = math.exp(-100 / 400) + math.exp(-400 / 400)
        self.assertAlmostEqual(sub[0], 1 - math.exp(-access))
        self.assertEqual(sub[1], 0)  # nothing closer than RMAX
        self.assertEqual(sub[2], 0)

    def test_walk_from_any_subset_of_categories(self):
        subs = {"supermarket": np.array([90, 10]), "school": np.array([20, 80]), "cafe": np.array([60, 60])}
        weights = {"supermarket": 1, "school": 2, "cafe": 1}
        self.assertEqual(ba.walk_score(subs, weights).tolist(), [round((90 + 40 + 60) / 4), round((10 + 160 + 60) / 4)])
        # a user who switches schools off: the frontend recomputes from the stored sub-scores
        self.assertEqual(ba.walk_score(subs, weights, enabled=["supermarket", "cafe"]).tolist(), [75, 35])


class TestDedupe(unittest.TestCase):
    def test_one_park_counts_once(self):
        d = np.array([[100, 120, 300, NAN]])
        obj = np.array([[7, 7, 9, NAN]])  # two boundary points of park 7, one of park 9
        self.assertEqual(np.nan_to_num(ba.dedupe_nearest(d, obj), nan=-1).tolist(), [[100, -1, 300, -1]])


class TestCityCore(unittest.TestCase):
    def test_minutes(self):
        m = ba.to_minutes(np.array([0, 79, 800, 7199, 7200, NAN, np.inf]), speed_m_min=80, max_min=90)
        self.assertEqual([None if pd.isna(v) else v for v in m], [0, 1, 10, 90, None, None, None])

    def test_inside_polygon_is_zero(self):
        square = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
        origins = gpd.GeoSeries([Point(50, 50), Point(300, 50)])
        self.assertEqual(ba.inside(square, origins).tolist(), [True, False])

    def test_boundary_points(self):
        pts = ba.boundary_points(np.array([Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])]), step_m=50)
        self.assertEqual(len(pts), 8)  # 400 m perimeter every 50 m
        self.assertTrue((pts["obj"] == 0).all())


@unittest.skipUnless(ba.OUT_GPKG.exists(), "access.gpkg not generated")
class TestGeneratedAccess(unittest.TestCase):
    """Happy path on the real output."""

    @classmethod
    def setUpClass(cls):
        b = gpd.read_file(ba.BUILDINGS_GPKG, layer="buildings", columns=["id", "muni"])
        a = gpd.read_file(ba.OUT_GPKG, layer="access")
        cls.x = b.merge(a, on="id")

    def at(self, lat, lng, radius_m):
        p = gpd.GeoSeries([Point(lng, lat)], crs=4326).to_crs(ba.CRS).iloc[0]
        return self.x[self.x.distance(p) <= radius_m]

    def test_every_building(self):
        self.assertEqual(len(self.x), len(gpd.read_file(ba.BUILDINGS_GPKG, layer="buildings", columns=["id"])))
        self.assertTrue(self.x["walk"].notna().all())

    def test_snap(self):
        self.assertGreaterEqual((self.x["snap_m"] < 50).mean(), 0.95)

    def test_eixample_beats_collserola_edge(self):
        eix = self.at(41.3925, 2.1640, 500)["walk"].median()
        edge = self.at(41.4180, 2.1130, 600)["walk"].median()  # Vallvidrera / Collserola edge
        self.assertGreater(eix, edge + 20)

    def test_montbau_to_passeig_de_gracia(self):
        m = self.at(41.4300, 2.1450, 250)["cc_pg_gracia"].median()
        self.assertTrue(60 <= m <= 90, m)


if __name__ == "__main__":
    unittest.main()
