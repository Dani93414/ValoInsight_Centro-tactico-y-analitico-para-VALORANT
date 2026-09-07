import { useMemo, useState } from "react";
import { ShieldOff } from "lucide-react";
import { useArmas, useGear } from "../../api/useContentQueries";
import { normalizeArrayResponse } from "../../utils/formatters";
import type { Arma } from "../../types/weapons";
import type { GearContent } from "../../types/content";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../../api/config";
import LoadingModal from "../ui/LoadingModal";
import "./PlayerEconomyPanel.css";

export type PurchaseRound = {
  round_number: number;
  weapon_id?: string | null;
  armor_id?: string | null;
  weapon_name: string;
  armor_name: string;
  loadout_value: number | null;
  remaining: number | null;
  credits_before_buy: number | null;
  money_source: string;
  quality: number | null;
  status: string;
  history_rounds: number;
  agent_history_rounds: number;
  recommendation: {
    decision_type?: "buy" | "save" | "keep";
    remaining_after_choice?: number;
    next_credits_after_loss?: number;
    next_credits_after_save_loss?: number;
    weapon_id?: string | null;
    armor_id?: string | null;
    weapon_name: string | null;
    armor_name: string | null;
    support_matches: number;
  } | null;
};

type PurchaseResponse = {
  puuid: string;
  rounds: PurchaseRound[];
  model_available: boolean;
  grade_description: string;
};

const credits = (value: number | null) => value == null ? "—" : value.toLocaleString("es-ES");

export function recommendationLabel(round: PurchaseRound): string {
  const recommendation = round.recommendation;
  if (!recommendation) return round.quality == null ? "No evaluable" : "Sin mejora clara";
  if (recommendation.decision_type === "save") return "Ahorrar: no comprar arma ni escudo";
  if (recommendation.decision_type === "keep") return "Ahorrar: conservar el equipamiento";
  if (recommendation.weapon_name && recommendation.armor_name) {
    return `${recommendation.weapon_name} + ${recommendation.armor_name}`;
  }
  return recommendation.weapon_name
    ? `${recommendation.weapon_name} · conservar escudo`
    : `${recommendation.armor_name} · conservar arma`;
}

function unavailableReason(status: string): string {
  if (status === "incomplete_money") return "Faltan datos para reconstruir el presupuesto con fiabilidad.";
  if (status === "unsupported_purchase") return "No hay suficientes partidas comparables para esta compra.";
  return "No hay un modelo entrenado con partidas anteriores que permita evaluar esta ronda.";
}

type Equipment = { uuid?: string | null; displayName: string; displayIcon?: string | null; shopImage?: string | null };

function EquipmentImage({ id, name, items, shield = false }: {
  id?: string | null; name: string; items: Equipment[]; shield?: boolean;
}) {
  const item = items.find(entry => id && entry.uuid?.toLowerCase() === id.toLowerCase())
    ?? items.find(entry => entry.displayName.toLowerCase() === name.toLowerCase());
  const src = item?.displayIcon || item?.shopImage;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const label = item?.displayName || name;
  return <span className={`player-economy-equipment ${shield ? "is-shield" : "is-weapon"}`} title={label}>
    {shield && (id === "none" || name === "Sin escudo")
      ? <ShieldOff size={24} role="img" aria-label="Sin escudo" />
      : src && src !== failedSrc
        ? <img src={src} alt={label} loading="lazy" onError={() => setFailedSrc(src)} />
        : <span className="player-economy-equipment-fallback">{label}</span>}
  </span>;
}

export default function PlayerEconomyPanel({ matchId, playerId }: { matchId: string; playerId: string }) {
  const { data: weaponsData } = useArmas();
  const { data: gearData } = useGear();
  const weapons = useMemo(() => normalizeArrayResponse<Arma>(weaponsData), [weaponsData]);
  const shields = useMemo(() => normalizeArrayResponse<GearContent>(gearData), [gearData]);
  const query = useQuery<PurchaseResponse>({
    queryKey: ["player-purchases-v2", matchId, playerId],
    queryFn: async ({ signal }) => {
      const response = await fetch(apiUrl(`/economy-ml/matches/${encodeURIComponent(matchId)}/players/${encodeURIComponent(playerId)}/purchases`), { signal });
      if (!response.ok) throw new Error("No se pudo cargar la economía de este jugador.");
      return response.json();
    },
    enabled: Boolean(matchId && playerId), staleTime: 30_000, retry: false,
  });
  if (query.isPending) return <LoadingModal placement="section" />;
  if (query.isError) return <div role="alert" className="player-economy-message">
    <p>No se pudo cargar la economía de este jugador.</p>
    <button type="button" onClick={() => void query.refetch()}>Reintentar</button>
  </div>;
  const rounds = query.data.rounds;
  return <section className="player-economy-panel" aria-label="Economía del jugador seleccionado">
    <header>
      <h3>Economía por ronda</h3>
      <p>Equipamiento al comenzar el combate y créditos del jugador seleccionado.</p>
    </header>
    <p className="player-economy-explanation">La nota compara comprar ahora con ahorrar para la siguiente ronda, según tu historial y contexto. No es una probabilidad de victoria.</p>
    {!query.data.model_available && <p role="status">Los datos económicos están disponibles. El modelo aún no puede valorar las compras.</p>}
    {rounds.length === 0 ? <p>No hay rondas con información económica disponible.</p> : <>
      <div className="player-economy-table-wrap" tabIndex={0} role="region" aria-label="Tabla de compras por ronda">
        <table>
          <thead><tr>
            <th scope="col">Ronda</th><th scope="col">Arma inicial</th><th scope="col">Escudo inicial</th>
            <th scope="col">Loadout</th><th scope="col">Remaining</th><th scope="col">Antes de comprar</th>
            <th scope="col">Calidad de compra</th><th scope="col">Alternativa recomendada</th>
          </tr></thead>
          <tbody>{rounds.map(round => <tr key={round.round_number}>
            <th scope="row">{round.round_number}</th>
            <td><EquipmentImage id={round.weapon_id} name={round.weapon_name} items={weapons} /></td>
            <td><EquipmentImage id={round.armor_id} name={round.armor_name} items={shields} shield /></td>
            <td>{credits(round.loadout_value)}</td><td>{credits(round.remaining)}</td>
            <td title={round.money_source === "inconsistent" ? "El saldo registrado no concuerda con el cálculo de ingresos." : "Créditos calculados; no son una predicción del modelo."}>
              {credits(round.credits_before_buy)}{round.money_source === "inconsistent" ? " *" : ""}
            </td>
            <td>{round.quality == null
              ? <span className="player-economy-unavailable" title={unavailableReason(round.status)}>No evaluable</span>
              : <span className={`player-economy-grade ${round.quality >= 80 ? "is-high" : round.quality >= 50 ? "is-medium" : "is-low"}`} title={`${round.history_rounds} rondas previas; ${round.agent_history_rounds} con este agente.`}>{round.quality}<small>/100</small></span>}
            </td>
            <td className={round.recommendation ? "player-economy-recommendation" : "player-economy-unavailable"}>
              {!round.recommendation || round.recommendation.decision_type === "save" || round.recommendation.decision_type === "keep"
                ? recommendationLabel(round)
                : <div className="player-economy-alternative">
                  {round.recommendation.weapon_name && <EquipmentImage id={round.recommendation.weapon_id} name={round.recommendation.weapon_name} items={weapons} />}
                  {round.recommendation.weapon_name && round.recommendation.armor_name && <span aria-hidden="true">+</span>}
                  {round.recommendation.armor_name && <EquipmentImage id={round.recommendation.armor_id} name={round.recommendation.armor_name} items={shields} shield />}
                  {!round.recommendation.weapon_name && <small>Conservar arma</small>}
                  {!round.recommendation.armor_name && <small>Conservar escudo</small>}
                </div>}
              {(round.recommendation?.decision_type === "save" || round.recommendation?.decision_type === "keep") &&
                <small className="player-economy-saving-detail">
                  Saldo: {credits(round.recommendation.remaining_after_choice ?? null)}.
                  {" "}Si pierdes sin guardar equipo: {credits(round.recommendation.next_credits_after_loss ?? null)} en la siguiente ronda, sin extras.
                </small>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="player-economy-explanation">Si dos opciones tienen un valor parecido, no se propone un cambio. Las rondas sin historial o ejemplos suficientes se muestran sin nota.</p>
    </>}
  </section>;
}
