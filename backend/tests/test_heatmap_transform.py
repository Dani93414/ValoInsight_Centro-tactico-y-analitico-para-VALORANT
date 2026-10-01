import unittest
from unittest.mock import patch

from modules.analytics.domain.heatmap_transformer import build_transform_meta, transform_coords
from modules.analytics.infrastructure import heatmap_extractor


class HeatmapTransformTest(unittest.TestCase):
    def test_fracture_bridge_reference_matches_official_transform(self):
        """Comprueba la transformación de coordenadas con una referencia del puente de Fracture."""
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
        """Conserva el intercambio de ejes al transformar coordenadas."""
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
        """Expone la transformación en los metadatos de la ruta sin invertirla."""
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

    @patch.object(heatmap_extractor, "content_collection")
    def test_raw_map_url_resolves_to_the_same_transform_as_uuid(self, collection):
        collection.find_one.return_value = {
            "maps": [{
                "uuid": "map-uuid",
                "mapUrl": "/Game/Maps/Infinity/Infinity",
                "xMultiplier": 0.1,
                "xScalarToAdd": 0.2,
                "yMultiplier": -0.3,
                "yScalarToAdd": 0.4,
            }]
        }
        heatmap_extractor._map_transforms_by_uuid.cache_clear()
        try:
            self.assertEqual(
                heatmap_extractor._get_map_transform("map-uuid"),
                heatmap_extractor._get_map_transform("/Game/Maps/Infinity/Infinity"),
            )
        finally:
            heatmap_extractor._map_transforms_by_uuid.cache_clear()


if __name__ == "__main__":
    unittest.main()
