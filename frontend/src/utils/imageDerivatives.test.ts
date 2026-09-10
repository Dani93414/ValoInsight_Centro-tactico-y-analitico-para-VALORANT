import { describe, expect, it } from "vitest";
import { getImageDerivative } from "../pages/contentFormatters";

describe("getImageDerivative", () => {
  it("resuelve la variante WebP solicitada para una imagen local", () => {
    expect(
      getImageDerivative("/content/sprays/example/displayIcon.png", "thumb"),
    ).toBe("/content/sprays/example/displayIcon.thumb.webp");
  });

  it("conserva los parámetros de la URL y las variantes ya optimizadas", () => {
    expect(
      getImageDerivative("/content/cards/card.jpg?v=2", "medium"),
    ).toBe("/content/cards/card.medium.webp?v=2");
    expect(
      getImageDerivative("/content/cards/card.thumb.webp", "medium"),
    ).toBe("/content/cards/card.thumb.webp");
  });

  it("no modifica rutas de imágenes remotas ni formatos no compatibles", () => {
    expect(getImageDerivative("https://cdn.example/card.png", "thumb")).toBe(
      "https://cdn.example/card.png",
    );
    expect(getImageDerivative("/content/sprays/animated.gif", "thumb")).toBe(
      "/content/sprays/animated.gif",
    );
  });
});
