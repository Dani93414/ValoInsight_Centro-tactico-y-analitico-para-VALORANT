import { describe, expect, it } from "vitest";
import { recommendationLabel, type PurchaseRound } from "./PlayerEconomyPanel";
import PlayerEconomyPanel from "./PlayerEconomyPanel";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const round = { quality: 90, recommendation: null } as PurchaseRound;
describe("recomendaciones individuales de compra", () => {
  it("distingue falta de evaluación de ausencia de mejora", () => {
    expect(recommendationLabel(round)).toBe("Sin mejora clara");
    expect(recommendationLabel({ ...round, quality: null })).toBe("No evaluable");
  });
  it("conserva el componente que no cambia", () => {
    expect(recommendationLabel({ ...round, recommendation: { weapon_name: "Vandal", armor_name: null, support_matches: 10 } })).toBe("Vandal · conservar escudo");
    expect(recommendationLabel({ ...round, recommendation: { weapon_name: null, armor_name: "Pesado", support_matches: 10 } })).toBe("Pesado · conservar arma");
  });
  it("muestra ambos cambios", () => {
    expect(recommendationLabel({ ...round, recommendation: { weapon_name: "Vandal", armor_name: "Pesado", support_matches: 10 } })).toBe("Vandal + Pesado");
  });
  it("al cambiar de jugador muestra solo sus rondas y conserva saldos cero", () => {
    const client = new QueryClient();
    client.setQueryData(["content", "armas"], [
      { uuid: "sheriff", displayName: "Sheriff", displayIcon: "/content/weapons/sheriff/displayIcon.png" },
      { uuid: "ghost", displayName: "Ghost", displayIcon: "/content/weapons/ghost/displayIcon.png" },
    ]);
    client.setQueryData(["content", "gear"], []);
    const payload = (name: string) => ({ model_available: true, rounds: [{ ...round, round_number: 1,
      weapon_name: name, armor_name: "Sin escudo", remaining: 0, credits_before_buy: 800, loadout_value: 800 }] });
    client.setQueryData(["player-purchases-v2", "match", "one"], payload("Sheriff"));
    client.setQueryData(["player-purchases-v2", "match", "two"], payload("Ghost"));
    const render = (playerId: string) => renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(PlayerEconomyPanel, { matchId: "match", playerId })));
    expect(render("one")).toContain('alt="Sheriff"');
    expect(render("one")).toContain('src="/content/weapons/sheriff/displayIcon.png"');
    expect(render("one")).not.toContain('<td>Sheriff</td>');
    expect(render("one")).toContain('aria-label="Sin escudo"');
    expect(render("one")).not.toContain("Ghost");
    expect(render("two")).toContain("Ghost");
    expect(render("two")).not.toContain("Sheriff");
    expect(render("two")).toContain("<td>0</td>");
    client.clear();
  });
  it("distingue ahorrar de una compra de Classic", () => {
    expect(recommendationLabel({ ...round, recommendation: { decision_type: "save", weapon_name: "Classic", armor_name: "Sin escudo", support_matches: 10 } })).toBe("Ahorrar: no comprar arma ni escudo");
    expect(recommendationLabel({ ...round, recommendation: { decision_type: "keep", weapon_name: null, armor_name: null, support_matches: 10 } })).toBe("Ahorrar: conservar el equipamiento");
  });
});
