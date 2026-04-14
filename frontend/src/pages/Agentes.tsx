import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAgentes } from "../api/hooks";
import BackButton from "../components/BackButton";
import type { Agente } from "../types/agents";
import "./Agentes.css";

/* =============================
   COMPONENTE
============================== */

export default function Agentes() {
  const { data: rawAgentes, isLoading: loading } = useAgentes();
  const location = useLocation();
  const agentes = useMemo(() => {
    if (!rawAgentes) return [];
    return [...(rawAgentes as Agente[])].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [rawAgentes]);

  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(
    null,
  );

  const [mostrarRol, setMostrarRol] = useState(false);

  // 🆕 Filtros
  const [rolActivo, setRolActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const detalleRef = useRef<HTMLDivElement | null>(null);

  /* =============================
     AUTO-SELECT FROM ROUTE STATE
  ============================== */
  useEffect(() => {
    const state = location.state as { agentName?: string } | null;
    if (state?.agentName && agentes.length > 0 && !agenteSeleccionado) {
      const match = agentes.find(
        (a) => a.displayName.toLowerCase() === state.agentName!.toLowerCase(),
      );
      if (match) {
        const frame = requestAnimationFrame(() => {
          setAgenteSeleccionado(match);
          setMostrarRol(false);
        });
        return () => cancelAnimationFrame(frame);
      }
    }
  }, [agentes, location.state, agenteSeleccionado]);

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
          <p>Plantando la spike…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-container">
      <BackButton />
      {/* =============================
         HEADER
      ============================== */}
      <div className="agents-header">
        <span className="agents-eyebrow">Valorant</span>
        <h1 className="agents-title">Agentes</h1>
        <div className="agents-divider" />
      </div>

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
