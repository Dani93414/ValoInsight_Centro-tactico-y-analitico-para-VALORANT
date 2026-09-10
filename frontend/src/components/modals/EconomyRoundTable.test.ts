import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EconomyRoundTable from "./EconomyRoundTable";
import { purchaseAssessment, recommendationOrigin } from "./economyAssessment";
import type { EconomyMlPlayerRecommendation, EconomyMlResponse } from "../../types/matches";

describe("lectura de la economía v12", () => {
  it("no confunde participación del ML con un cambio de compra", () => {
    expect(recommendationOrigin({ recommendation_source: "ml_guided_solver" })).toBe("ML + reglas");
    expect(recommendationOrigin({ recommendation_source: "deterministic_solver" })).toBe("Reglas");
    expect(recommendationOrigin({})).toBe("Origen no disponible");
  });
  it("distingue una nota cero de una evaluación ausente", () => {
    expect(purchaseAssessment().label).toBe("Sin evaluación");
    expect(purchaseAssessment({ purchase_score: 0, individual_value_gap: .2 } as EconomyMlPlayerRecommendation).label).toBe("Revisar compra");
  });
  it("respeta la equivalencia y los intervalos que devuelve el modelo", () => {
    expect(purchaseAssessment({ purchase_score: 100, recommendation_equivalent_to_actual: true, individual_value_gap: .1 } as EconomyMlPlayerRecommendation).alternative).toBe(false);
    expect(purchaseAssessment({ purchase_score: 60, score_range: [40, 80], individual_value_gap: .1 } as EconomyMlPlayerRecommendation).label).toBe("Valoración incierta");
  });
  it("muestra solo al jugador elegido y no convierte datos ausentes en cero", () => {
    const client = new QueryClient();
    client.setQueryData(["content", "armas"], [{ displayName: "Ghost", displayIcon: "/content/ghost.png" }]);
    client.setQueryData(["content", "gear"], []);
    const ml = { rounds: [{ round_number: 1, team_id: "A", recommendation_source: "ml_guided_solver", recommendation_is_experimental: true, score_before: { team: 0, enemy: 0 },
      real_team_buy_observed: { one: { weapon: "Ghost", armor: "Sin escudo", remaining: 0 } },
      players: [{ puuid: "one", player_name: "Seleccionado", credits_before_buy: 800 },
        { puuid: "two", player_name: "Otro jugador", credits_before_buy: 800 }], warnings: [] }] } as unknown as EconomyMlResponse;
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(EconomyRoundTable, { ml, playerId: "one", agents: [] })));
    expect(html).toContain("Seleccionado");
    expect(html).not.toContain("Otro jugador");
    expect(html).toContain('alt="Ghost"');
    expect(html).toContain("Sin evaluación");
    expect(html).toContain('<dt>Saldo después de comprar</dt><dd>0</dd>');
    expect(html).toContain('<dt>Gasto registrado</dt><dd>—</dd>');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden=""');
    expect(html).toContain("Predicción económica");
    expect(html).not.toContain("ML experimental activo");
    expect(html).not.toContain("Actualizar análisis");
    client.clear();
  });
});
