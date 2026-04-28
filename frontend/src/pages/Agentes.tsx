import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, useRegions } from "../api/hooks";
import BackButton from "../components/BackButton";
import FloatingActionButton from "../components/FloatingActionButton";
import type { Agente } from "../types/agents";
import "./Agentes.css";

/* =============================
   COMPONENTE
============================== */

export default function Agentes() {
  const { data: rawAgentes, isLoading: loading } = useAgentes();
  const { data: regions } = useRegions();
  const location = useLocation();
  const navigate = useNavigate();

  const routeState =
    (location.state as {
      agentName?: string;
      returnTo?: string;
      returnLabel?: string;
    } | null) ?? null;

  const returnTo = routeState?.returnTo ?? null;
  const returnLabel = routeState?.returnLabel ?? "Volver";

  const agentes = useMemo(() => {
    if (!rawAgentes) return [];
    return [...(rawAgentes as Agente[])].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [rawAgentes]);

  const regionStats = regions?.[0];
  const agentStatsById = useMemo(
    () => regionStats?.agentStats ?? {},
    [regionStats?.agentStats],
  );
  const agentStatsByName = useMemo(() => {
    const map = new Map<string, (typeof agentStatsById)[string]>();
    Object.values(agentStatsById).forEach((stats) => {
      if (stats.agent_name) {
        map.set(stats.agent_name.toLowerCase(), stats);
      }
    });
    return map;
  }, [agentStatsById]);

  const getAgentGlobalStats = (agent: Agente) =>
    agentStatsById[agent.uuid ?? agent.id ?? ""] ??
    agentStatsByName.get(agent.displayName.toLowerCase());

  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(
    null,
  );

  const [mostrarRol, setMostrarRol] = useState(false);
  const consumedRouteAgentNameRef = useRef<string | null>(null);

  // 🆕 Filtros
  const [rolActivo, setRolActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const detalleRef = useRef<HTMLDivElement | null>(null);

  /* =============================
     AUTO-SELECT FROM ROUTE STATE
  ============================== */
  useEffect(() => {
    const routeAgentName = routeState?.agentName?.trim() || null;
    if (
      !routeAgentName ||
      consumedRouteAgentNameRef.current === routeAgentName ||
      agentes.length === 0 ||
      agenteSeleccionado
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const match = agentes.find(
        (a) => a.displayName.toLowerCase() === routeAgentName.toLowerCase(),
      );
      if (match) {
        setAgenteSeleccionado(match);
        setMostrarRol(false);
      }
      consumedRouteAgentNameRef.current = routeAgentName;
    });

    return () => cancelAnimationFrame(frame);
  }, [agentes, routeState?.agentName, agenteSeleccionado]);

  /* =============================
     SCROLL AL DETALLE
  ============================== */
  useEffect(() => {
    if (agenteSeleccionado && detalleRef.current) {
      detalleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [agenteSeleccionado]);

  /* =============================
     ROLES ÚNICOS
  ============================== */
  const rolesUnicos = Array.from(
    new Map(agentes.map((a) => [a.role.displayName, a.role])).values(),
  );

  const roleSummary = rolesUnicos.map((role) => {
    const roleAgents = agentes.filter(
      (agent) => agent.role.displayName === role.displayName,
    );
    const picks = roleAgents.reduce(
      (total, agent) => total + (getAgentGlobalStats(agent)?.picks ?? 0),
      0,
    );
    const wins = roleAgents.reduce(
      (total, agent) => total + (getAgentGlobalStats(agent)?.wins ?? 0),
      0,
    );

    return {
      ...role,
      agents: roleAgents.length,
      picks,
      winRate: picks > 0 ? (wins * 100) / picks : 0,
    };
  });

  /* =============================
     FILTRADO
  ============================== */
  const agentesFiltrados = agentes.filter((agente) => {
    const coincideRol = !rolActivo || agente.role.displayName === rolActivo;

    const coincideBusqueda = agente.displayName
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    return coincideRol && coincideBusqueda;
  });

  /* =============================
     LOADING
  ============================== */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando agentes</h2>
          <p>Plantando la spike...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-container">
      <BackButton />
      {returnTo && (
        <FloatingActionButton
          label={returnLabel}
          onClick={() => navigate(returnTo)}
          ariaLabel={returnLabel}
        />
      )}
      {/* =============================
         HEADER
      ============================== */}
      <div className="agents-header">
        <span className="agents-eyebrow">Valorant</span>
        <h1 className="agents-title">Agentes</h1>
        <div className="agents-divider" />
      </div>

      <section className="agents-role-summary" aria-label="Resumen por rol">
        {roleSummary.map((role) => (
          <article key={role.displayName} className="agents-role-summary-card">
            {role.displayIcon && <img src={role.displayIcon} alt="" />}
            <div>
              <span>{role.displayName}</span>
              <strong>{role.agents} agentes</strong>
              <small>
                {role.picks > 0
                  ? `${role.picks} picks · ${role.winRate.toFixed(1)}% WR`
                  : "Sin muestra global"}
              </small>
            </div>
          </article>
        ))}
      </section>

      {/* =============================
         FILTROS + BUSCADOR
      ============================== */}
      <div className="agents-filters">
        <div className="roles-filter">
          {rolesUnicos.map((rol) => (
            <button
              key={rol.displayName}
              className={`role-filter-btn ${
                rolActivo === rol.displayName ? "active" : ""
              }`}
              onClick={() =>
                setRolActivo((prev) =>
                  prev === rol.displayName ? null : rol.displayName,
                )
              }
            >
              {rol.displayIcon && (
                <img src={rol.displayIcon} alt={rol.displayName} />
              )}
              <span>{rol.displayName}</span>
            </button>
          ))}

          <button
            className="role-filter-btn reset"
            onClick={() => setRolActivo(null)}
          >
            Todos
          </button>
        </div>

        <input
          type="text"
          className="agents-search"
          placeholder="Buscar agente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* =============================
         DETALLE DEL AGENTE
      ============================== */}
      {agenteSeleccionado && (
        <div ref={detalleRef} className="agent-detail">
          <button
            className="agent-detail-close"
            onClick={() => {
              setAgenteSeleccionado(null);
              setMostrarRol(false);
            }}
            aria-label="Cerrar detalle"
          >
            ✕
          </button>

          <div className="agent-detail-content">
            <div className="agent-detail-left">
              <h2 className="agent-detail-name">
                {agenteSeleccionado.displayName}
              </h2>

              <button
                className="agent-role-badge"
                onClick={() => setMostrarRol((p) => !p)}
              >
                {agenteSeleccionado.role.displayName}
              </button>

              {mostrarRol && (
                <div className="agent-role-info">
                  {agenteSeleccionado.role.displayIcon && (
                    <img
                      src={agenteSeleccionado.role.displayIcon}
                      alt={agenteSeleccionado.role.displayName}
                    />
                  )}
                  <p>{agenteSeleccionado.role.description}</p>
                </div>
              )}

              <p className="agent-description">
                {agenteSeleccionado.description}
              </p>

              <div className="agent-extra-grid">
                <div>
                  <span>Fecha de salida</span>
                  <strong>{agenteSeleccionado.releaseDate || "-"}</strong>
                </div>
                <div>
                  <span>Origen</span>
                  <strong>
                    {agenteSeleccionado.isBaseContent
                      ? "Contenido base"
                      : "Contenido añadido"}
                  </strong>
                </div>
                <div>
                  <span>Picks globales</span>
                  <strong>
                    {getAgentGlobalStats(agenteSeleccionado)?.picks ?? "-"}
                  </strong>
                </div>
                <div>
                  <span>Win rate global</span>
                  <strong>
                    {getAgentGlobalStats(agenteSeleccionado)?.win_rate
                      ? `${getAgentGlobalStats(agenteSeleccionado)?.win_rate?.toFixed(1)}%`
                      : "-"}
                  </strong>
                </div>
              </div>

              {(agenteSeleccionado.characterTags?.length ?? 0) > 0 && (
                <div className="agent-tags">
                  {agenteSeleccionado.characterTags?.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}

              <h3 className="abilities-title">Habilidades</h3>

              <div className="abilities-list">
                {agenteSeleccionado.abilities.map((hab, index) => (
                  <div key={index} className="ability-card">
                    <div className="ability-header">
                      {hab.displayIcon && (
                        <img
                          src={hab.displayIcon}
                          alt={hab.displayName}
                          className="ability-icon"
                        />
                      )}
                      <span className="ability-slot">{hab.slot}</span>
                      <h4 className="ability-name">{hab.displayName}</h4>
                    </div>

                    <p className="ability-description">{hab.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="agent-detail-right">
              {agenteSeleccionado.background && (
                <img
                  src={agenteSeleccionado.background}
                  alt="Background"
                  className="agent-background"
                />
              )}

              {agenteSeleccionado.fullPortrait && (
                <img
                  src={agenteSeleccionado.fullPortrait}
                  alt={agenteSeleccionado.displayName}
                  className="agent-fullportrait"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================
         GRID DE AGENTES
      ============================== */}
      <div className="agents-grid">
        {agentesFiltrados.map((agente, idx) => {
          const activo = agenteSeleccionado?.displayName === agente.displayName;

          return (
            <div
              key={idx}
              className={`agent-card ${activo ? "active" : ""}`}
              onClick={() => {
                if (activo) {
                  setAgenteSeleccionado(null);
                  setMostrarRol(false);
                  return;
                }
                setAgenteSeleccionado(agente);
                setMostrarRol(false);
              }}
            >
              {agente.displayIcon && (
                <img
                  src={agente.displayIcon}
                  alt={agente.displayName}
                  className="agent-image"
                  loading="lazy"
                />
              )}

              <h2 className="agent-name">{agente.displayName}</h2>
              <p className="agent-role">{agente.role.displayName}</p>
              {getAgentGlobalStats(agente)?.picks ? (
                <p className="agent-global-line">
                  {getAgentGlobalStats(agente)?.picks} picks ·{" "}
                  {getAgentGlobalStats(agente)?.win_rate?.toFixed(1)}% WR
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
