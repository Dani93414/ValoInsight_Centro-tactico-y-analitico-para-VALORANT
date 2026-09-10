import { purchaseAssessment, recommendationOrigin } from "./economyAssessment";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ShieldOff, UserRound } from "lucide-react";
import { useArmas, useGear } from "../../api/useContentQueries";
import { normalizeArrayResponse } from "../../utils/formatters";
import type { AgentContent } from "../../types/agents";
import type { EconomyMlResponse } from "../../types/matches";
import "./EconomyRoundTable.css";

type CatalogItem = { uuid?: string | null; displayName?: string | null; displayIcon?: string | null; shopImage?: string | null };
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const credits = (value: unknown) => number(value)?.toLocaleString("es-ES") ?? "—";
const reference = (value: unknown) => String(value ?? "").toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function teamActionLabel(action?: string | null) {
  const labels: Record<string, string> = {
    ECO_CLASSIC: "Ahorrar con Classic", ECO_PISTOL_UPGRADE: "Compra económica de pistolas",
    ECO_ONE_SHERIFF: "Ahorrar con un Sheriff", ECO_TWO_SHERIFFS: "Ahorrar con dos Sheriff",
    ECO_SHERIFF: "Compra económica con Sheriff", ECO_SHERIFF_STACK: "Varios Sheriff",
    SEMI_SMG: "Compra parcial de subfusiles", SEMI_MARSHAL: "Compra parcial con Marshal",
    FORCE_OUTLAW: "Forzar con Outlaw", FORCE_RIFLE_LIGHT: "Forzar rifles y escudo ligero",
    FORCE_2_RIFLES: "Forzar con dos rifles", FULL_RIFLES: "Compra completa de rifles",
    FULL_OPERATOR: "Compra completa con Operator", BONUS_KEEP_WEAPONS: "Conservar las armas",
    MIXED_LOW_BUY: "Compra económica mixta",
  };
  return action ? labels[action] || "Estrategia de equipo" : "Sin estrategia propuesta";
}

function Equipment({ name, shield, catalog }: { name?: string | null; shield?: boolean; catalog: CatalogItem[] }) {
  const entry = catalog.find(item => reference(item.uuid) === reference(name) || reference(item.displayName) === reference(name));
  const src = entry?.displayIcon || entry?.shopImage;
  const [failed, setFailed] = useState<string | null>(null);
  const label = entry?.displayName || name || "Sin datos";
  return <span className={`economy-clear-item ${shield ? "is-shield" : ""}`} title={label}>
    {shield && reference(name) === "sinescudo" ? <ShieldOff size={24} role="img" aria-label="Sin escudo" />
      : src && failed !== src ? <img src={src} alt={label} loading="lazy" onError={() => setFailed(src)} />
        : <span>{label}</span>}
  </span>;
}

export default function EconomyRoundTable({ ml, playerId, agents }: { ml: EconomyMlResponse; playerId: string; agents: AgentContent[] }) {
  const { data: rawWeapons } = useArmas();
  const { data: rawGear } = useGear();
  const weapons = useMemo(() => normalizeArrayResponse<CatalogItem>(rawWeapons), [rawWeapons]);
  const shields = useMemo(() => normalizeArrayResponse<CatalogItem>(rawGear), [rawGear]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failedAgentIcon, setFailedAgentIcon] = useState<string | null>(null);
  const teamId = ml.rounds.find(round => round.players.some(player => player.puuid === playerId))?.team_id;
  const rows = ml.rounds.filter(round => round.team_id === teamId).sort((a, b) => a.round_number - b.round_number);
  const identity = rows.flatMap(round => round.players).find(player => player.puuid === playerId);
  const agent = identity?.agent ? agents.find(item => [item.uuid, item.id, item.displayName, item.name].some(value => reference(value) === reference(identity.agent))) : undefined;
  const agentIcon = agent?.displayIcon || agent?.displayIconSmall;
  const spends = rows.map(round => number(round.real_team_buy_observed?.[playerId]?.spent));
  const totalSpent = spends.length && spends.every(value => value !== null) ? spends.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const alternatives = rows.filter(round => purchaseAssessment(round.players.find(player => player.puuid === playerId)).alternative).length;
  const evaluated = rows.filter(round => number(round.players.find(player => player.puuid === playerId)?.purchase_score) !== null).length;
  return <section className="economy-clear" aria-label="Predicción económica">
    <header className="economy-clear-header">
      <div className="economy-clear-player">
        {agentIcon && failedAgentIcon !== agentIcon
          ? <img className="economy-clear-agent" src={agentIcon} alt={agent?.displayName || "Agente utilizado"} title={agent?.displayName} onError={() => setFailedAgentIcon(agentIcon)} />
          : <span className="economy-clear-agent economy-clear-agent-fallback" role="img" aria-label="Imagen del agente no disponible"><UserRound size={32} aria-hidden="true" /></span>}
        <strong>{identity?.player_name || "Jugador"}</strong>
      </div>
      <div className="economy-clear-summary">
        <span><small>Gasto total registrado</small><strong>{credits(totalSpent)}</strong></span>
        <span><small>Rondas evaluadas</small><strong>{evaluated} / {rows.length}</strong></span>
        <span><small>Con alternativa individual</small><strong>{alternatives}</strong></span>
      </div>
    </header>
    {!rows.length ? <p>No hay información económica para este jugador.</p> : <div className="economy-clear-scroll" role="region" aria-label="Tabla de compras" tabIndex={0}>
      <table><thead><tr><th scope="col">Ronda</th><th scope="col">Dinero disponible <small>calculado antes de comprar</small></th><th scope="col">Equipamiento real</th><th scope="col">Valoración</th><th scope="col">Recomendación y detalle</th></tr></thead>
        <tbody>{rows.map(round => {
          const player = round.players.find(item => item.puuid === playerId);
          const actual = round.real_team_buy_observed?.[playerId];
          const assessment = purchaseAssessment(player);
          const purchase = player?.recommended_purchase;
          const id = `economy-${playerId}-${round.round_number}`;
          const open = expanded === id;
          const score = player?.score_range && player.score_range[0] !== player.score_range[1]
            ? `${credits(player.score_range[0])}–${credits(player.score_range[1])}` : credits(player?.purchase_score);
          return <Fragment key={id}><tr className={open ? "is-open" : ""}>
            <th scope="row">{round.round_number}</th><td>{credits(player?.credits_before_buy)}</td>
            <td><div className="economy-clear-loadout"><Equipment name={actual?.weapon ?? player?.observed_weapon} catalog={weapons} /><Equipment name={actual?.armor ?? player?.observed_armor} catalog={shields} shield /></div></td>
            <td><span className={`economy-clear-badge is-${assessment.tone}`}>{assessment.label}</span><small className="economy-clear-origin">{recommendationOrigin(round)}</small></td>
            <td><button type="button" className="economy-clear-toggle" aria-expanded={open} aria-controls={id} aria-label={`${open ? "Cerrar" : "Ver"} detalle de la ronda ${round.round_number}`} onClick={() => setExpanded(open ? null : id)}>
              <span>{assessment.alternative ? "Ver alternativa" : assessment.tone === "good" ? "Mantener · ver detalle" : "Ver detalle"}</span><ChevronDown size={16} aria-hidden="true" /></button></td>
          </tr><tr hidden={!open} id={id} className="economy-clear-detail-row"><td colSpan={5}>
            <div className="economy-clear-detail">
              <div className="economy-clear-comparison">
                <article><h4>Lo que ocurrió</h4><p>Datos registrados en la partida</p>
                  <div className="economy-clear-loadout"><Equipment name={actual?.weapon ?? player?.observed_weapon} catalog={weapons} /><Equipment name={actual?.armor ?? player?.observed_armor} catalog={shields} shield /></div>
                  <dl><div><dt>Gasto registrado</dt><dd>{credits(actual?.spent)}</dd></div><div><dt>Saldo después de comprar</dt><dd>{credits(actual?.remaining)}</dd></div><div><dt>Valor del equipamiento</dt><dd>{credits(actual?.loadoutValue)}</dd></div></dl>
                </article>
                <article className="is-proposal"><h4>Propuesta para este jugador</h4><p>Estimación dentro del plan de su equipo</p>
                  {purchase ? <><div className="economy-clear-loadout"><Equipment name={purchase.weapon?.displayName || purchase.display?.weapon_label || "No comprar arma"} catalog={weapons} /><Equipment name={purchase.armor?.displayName || "Sin escudo"} catalog={shields} shield /></div>
                    <dl><div><dt>Coste para el jugador</dt><dd>{credits(purchase.self_cost)}</dd></div><div><dt>Saldo estimado</dt><dd>{credits(purchase.expected_remaining)}</dd></div></dl>
                    <p>{purchase.keep_weapon ? "Conservar el arma. " : ""}{purchase.keep_armor ? "Conservar el escudo." : ""}</p>
                    <p><strong>Habilidades: </strong>{purchase.display?.ability_label || purchase.abilities?.map(item => `${item.name} ×${item.charges}`).join(", ") || "Sin compra propuesta"}</p>
                  </> : <p>No hay una propuesta disponible.</p>}
                </article>
              </div>
              <div className="economy-clear-explanation"><h4>Cómo interpretar esta ronda</h4>
                <p><strong>Origen de la propuesta: {recommendationOrigin(round)}.</strong> {round.recommendation_source === "ml_guided_solver" ? `El ML favorece esta estrategia de equipo: ${teamActionLabel(round.advanced_context?.macro_model?.recommended_action)}. El motor sigue considerando presupuesto, inventario y reglas; esto no implica que cambien tu arma o tu nota.` : round.recommendation_source === "deterministic_solver" ? "En esta ronda el ML no está orientando la recomendación de compra; se mantiene el motor de reglas." : "La respuesta no indica qué motor intervino."}</p>
                <p>{number(player?.purchase_score) !== null ? `Valoración individual del v12: ${score}/100. No es una probabilidad de victoria.` : "El análisis no proporciona una valoración individual para esta ronda."}</p>
                {player?.recommendation_equivalent_to_actual && <p>Las opciones son equivalentes para el análisis: no es necesario cambiar la compra.</p>}
                {player?.reason && <p>{player.reason}</p>}
                {player?.ambiguity_reason && <p className="economy-clear-caution">{player.ambiguity_reason}</p>}
                {round.coordination_only_improvement && <p className="economy-clear-caution">La mejora requiere coordinar las compras del equipo; no significa que tu compra individual sea mala.</p>}
                <details className="economy-clear-team"><summary>Contexto del equipo y limitaciones</summary>
                  <p>Marcador antes de la ronda: tu equipo {round.score_before?.team ?? "—"} · rival {round.score_before?.enemy ?? "—"}.</p>
                  <p>Valoración del equipo: {credits(round.team_purchase_score)}{number(round.team_purchase_score) !== null ? "/100" : ""}. Esta valoración corresponde al conjunto del equipo.</p>
                  {[...(player?.warnings ?? []), ...(round.warnings ?? [])].filter((value, index, all) => all.indexOf(value) === index).map(warning => <p key={warning}>{warning}</p>)}
                </details>
              </div>
            </div>
          </td></tr></Fragment>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}
