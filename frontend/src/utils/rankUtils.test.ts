import { describe, expect, it } from "vitest";
import {
  UNRANKED_RANK_ICON_FALLBACK,
  resolveCompetitiveTierIcon,
} from "./rankUtils";

const tiers = [
  { tier: 0, tierName: "Unranked", smallIcon: "/content/ranks/unranked.png" },
  { tier: 12, tierName: "Gold 1", smallIcon: "/content/ranks/gold.png" },
];

describe("resolveCompetitiveTierIcon", () => {
  it("muestra el icono exacto del rango cuando está disponible", () => {
    expect(resolveCompetitiveTierIcon(12, null, tiers)).toBe("/content/ranks/gold.png");
  });

  it("usa el icono sin rango del catálogo cuando falta el rango", () => {
    expect(resolveCompetitiveTierIcon(null, null, tiers)).toBe("/content/ranks/unranked.png");
  });

  it("usa el icono sin rango de reserva cuando faltan imágenes en el catálogo", () => {
    expect(resolveCompetitiveTierIcon(null, null, [])).toBe(UNRANKED_RANK_ICON_FALLBACK);
  });

  it("usa el icono sin rango si el rango conocido no tiene una imagen utilizable", () => {
    expect(resolveCompetitiveTierIcon(18, null, tiers)).toBe("/content/ranks/unranked.png");
  });
});
