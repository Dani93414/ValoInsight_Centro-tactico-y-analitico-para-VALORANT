"""Ejecuta unittest con descripciones y un resumen de resultados para el documento."""

from pathlib import Path
import sys
import unittest


class ResultadoDescriptivo(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.correctas = 0
        self.ultimo_modulo = None

    def getDescription(self, test):
        return test.shortDescription() or str(test)

    def startTest(self, test):
        modulo = test.id().rsplit(".", 2)[0]
        if self.showAll and modulo != self.ultimo_modulo:
            self.stream.writeln(f"\n--- {modulo} ---")
            self.ultimo_modulo = modulo
        super().startTest(test)

    def addSuccess(self, test):
        self.correctas += 1
        super().addSuccess(test)


class EjecutorDescriptivo(unittest.TextTestRunner):
    resultclass = ResultadoDescriptivo

    def run(self, test):
        resultado = super().run(test)
        self.stream.writeln("\nRESUMEN DE PRUEBAS DEL BACKEND")
        self.stream.writeln(f"Pruebas ejecutadas: {resultado.testsRun}")
        self.stream.writeln(f"Correctas: {resultado.correctas}")
        self.stream.writeln(f"Fallos de comprobación: {len(resultado.failures)}")
        self.stream.writeln(f"Errores de ejecución o preparación: {len(resultado.errors)}")
        self.stream.writeln(f"Omitidas: {len(resultado.skipped)}")
        if resultado.expectedFailures:
            self.stream.writeln(f"Fallos esperados: {len(resultado.expectedFailures)}")
        if resultado.unexpectedSuccesses:
            self.stream.writeln(f"Éxitos inesperados: {len(resultado.unexpectedSuccesses)}")
        return resultado


def main():
    raiz = Path(__file__).resolve().parents[1]
    sys.path[:0] = [str(raiz), str(raiz / "backend")]
    argumentos = sys.argv[1:] or [
        "discover", "-s", str(raiz / "backend" / "tests"), "-p", "test_*.py", "-v",
    ]
    unittest.main(
        module=None,
        argv=[sys.argv[0], *argumentos],
        testRunner=EjecutorDescriptivo(stream=sys.stdout, verbosity=2),
    )


if __name__ == "__main__":
    main()
