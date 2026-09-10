import unittest


class SanityTest(unittest.TestCase):
    def test_environment_is_operational(self):
        """Comprueba que el entorno básico de pruebas está operativo."""
        self.assertTrue(True)


if __name__ == "__main__":
    unittest.main()
