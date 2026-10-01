from __future__ import annotations

import unittest

from modules.content.domain.services import filter_geo_maps


class ContentMapIdentifierTests(unittest.TestCase):
    def test_geo_maps_expose_uuid_and_raw_map_url(self):
        result = filter_geo_maps([
            {
                "uuid": "haven-uuid",
                "mapUrl": "/Game/Maps/Triad/Triad",
                "displayName": "Haven",
                "xMultiplier": 1,
                "xScalarToAdd": 0,
                "yMultiplier": 1,
                "yScalarToAdd": 0,
            }
        ])

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["uuid"], "haven-uuid")
        self.assertEqual(result[0]["mapUrl"], "/Game/Maps/Triad/Triad")
