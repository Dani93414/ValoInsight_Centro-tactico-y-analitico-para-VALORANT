import { describe, expect, it } from "vitest";
import { calculateGlobalWeaponHeadshotPct, formatWeaponValue, getWeaponProfileTags } from "./weaponUtils";

describe("Traducciones de las características de armas", () => {
  it.each([
    ["ROFIncrease", "Cadencia progresiva: aumenta al mantener el disparo."],
    ["ADS", "Mira: permite apuntar para mejorar el control y la precisión."],
    ["DualZoom", "Zoom doble: permite alternar entre dos aumentos de mira."],
    ["AirBurst", "Explosión aérea: detona en el aire o por tiempo."],
    ["Silenced", "Silenciador: reduce traza sonora y visual de disparo."],
    ["Shotgun", "Disparo de escopeta: lanza varios perdigones."],
  ])("traduce %s al español: %s", (source, expected) => {
    expect(formatWeaponValue(source)).toBe(expected);
  });

  it("describe en español las armas que permiten apuntar con mira", () => {
    expect(getWeaponProfileTags({
      displayName: "Vandal",
      category: "Rifle",
      adsStats: { zoomMultiplier: 1.25 },
    })).toContain("tiene mira");
  });
});

describe("Porcentaje global de impactos en la cabeza por arma", () => {
  it("usa todos los impactos filtrados como denominador del porcentaje de cabeza", () => {
    expect(calculateGlobalWeaponHeadshotPct({
      headshots: 30,
      bodyshots: 50,
      legshots: 20,
    })).toBe(30);
  });

  it("no inventa un porcentaje cuando faltan datos históricos de impactos", () => {
    expect(calculateGlobalWeaponHeadshotPct({ headshots: 12 })).toBeUndefined();
  });

  it("recupera el denominador de impactos a partir de los agregados históricos regionales", () => {
    expect(calculateGlobalWeaponHeadshotPct({
      headshots: 111464,
      headshot_pct: 28.0468,
    })).toBeCloseTo(28.0468, 4);
  });
});
