import unittest

from modules.analytics.domain.heatmap_transformer import build_transform_meta, transform_coords


class HeatmapTransformTest(unittest.TestCase):
    def test_fracture_bridge_reference_matches_official_transform(self):
        tf = {
            "x_mult": 7.8e-05,
            "x_add": 0.556952,
            "y_mult": -7.8e-05,
            "y_add": 1.155886,
        }

        nx, ny = transform_coords(11473.0, -2897.0, tf)

        # Official Fracture transform should place Bridge near (0.331, 0.261).
        self.assertAlmostEqual(nx, 0.330986, places=6)
        self.assertAlmostEqual(ny, 0.260992, places=6)
        self.assertLess(abs(nx - 0.3315), 0.001)
        self.assertLess(abs(ny - 0.2615), 0.001)

    def test_transform_keeps_axis_swap(self):
        tf = {
            "x_mult": 2.0,
            "x_add": 10.0,
            "y_mult": -3.0,
            "y_add": 5.0,
        }

        nx, ny = transform_coords(4.0, 7.0, tf)

        self.assertEqual(nx, 24.0)  # x <- game_y * x_mult + x_add
        self.assertEqual(ny, -7.0)  # y <- game_x * y_mult + y_add

    def test_route_meta_exposes_transform_without_inversion(self):
        tf = {
            "x_mult": 0.1,
            "x_add": 0.2,
            "y_mult": -0.3,
            "y_add": 0.4,
        }

        meta = build_transform_meta(tf)

        self.assertEqual(meta["xMultiplier"], 0.1)
        self.assertEqual(meta["xScalarToAdd"], 0.2)
        self.assertEqual(meta["yMultiplier"], -0.3)
        self.assertEqual(meta["yScalarToAdd"], 0.4)
        self.assertEqual(meta["axis_swap"]["x_from"], "game_y")
        self.assertEqual(meta["axis_swap"]["y_from"], "game_x")
        self.assertEqual(meta["origin"], "top-left")
        self.assertFalse(meta["invert_y"])


if __name__ == "__main__":
    unittest.main()
