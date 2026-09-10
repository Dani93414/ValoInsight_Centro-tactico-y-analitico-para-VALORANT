import type { EconomyMlPlayerRecommendation, EconomyMlRoundRecommendation } from "../../types/matches";

const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

export function purchaseAssessment(player?: EconomyMlPlayerRecommendation) {
  if (number(player?.purchase_score) === null) return { label: "Sin evaluación", tone: "neutral", alternative: false };
  if (player?.recommendation_equivalent_to_actual) return { label: "Sin mejora clara", tone: "good", alternative: false };
  if (player?.ambiguity_reason || (player?.score_range && player.score_range[0] !== player.score_range[1])) {
    return { label: "Valoración incierta", tone: "neutral", alternative: false };
  }
  const alternative = (number(player?.individual_value_gap) ?? 0) > 0;
  return { label: alternative ? "Revisar compra" : "Sin mejora clara", tone: alternative ? "review" : "good", alternative };
}

export function recommendationOrigin(round: Pick<EconomyMlRoundRecommendation, "recommendation_source">) {
  if (round.recommendation_source === "ml_guided_solver") return "ML + reglas";
  if (round.recommendation_source === "deterministic_solver") return "Reglas";
  return "Origen no disponible";
}

