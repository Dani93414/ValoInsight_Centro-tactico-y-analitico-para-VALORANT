import unittest

from modules.players.infrastructure.mongo_player_repo import (
    MAX_SEARCH_TERM_LENGTH,
    _safe_prefix_regex,
)


class PlayerSearchSanitizationTest(unittest.TestCase):
    def test_search_regex_is_escaped_and_prefix_bounded(self):
        """Escapa caracteres especiales y limita la búsqueda al prefijo."""
        regex = _safe_prefix_regex("a.*(b+)+")

        self.assertEqual(regex, {"$regex": r"^a\.\*\(b\+\)\+", "$options": "i"})

    def test_search_regex_is_length_limited(self):
        """Limita la longitud de la expresión de búsqueda."""
        regex = _safe_prefix_regex("x" * (MAX_SEARCH_TERM_LENGTH + 10))

        self.assertEqual(regex["$regex"], "^" + ("x" * MAX_SEARCH_TERM_LENGTH))

    def test_search_regex_ignores_empty_values(self):
        """Ignora valores vacíos en la expresión de búsqueda."""
        self.assertIsNone(_safe_prefix_regex("   "))


if __name__ == "__main__":
    unittest.main()
