import { useEffect, useRef, useState } from "react";
import { getAgentes } from "../api/content";
import "./Agentes.css";

type Ability = {
  slot: string;
  displayName: string;
  description: string;
};

type Agente = {
  displayName: string;
  description: string;
  displayIcon?: string | null;
  role: {
    displayName: string;
  };
  abilities: Ability[];
};

export default function Agentes() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [agenteSeleccionado, setAgenteSeleccionado] =
    useState<Agente | null>(null);

  const detalleRef = useRef<HTMLDivElement | null>(null);

  /* Carga de agentes */
  useEffect(() => {
    getAgentes().then((data) => {
      setAgentes(data);
      setLoading(false);
    });
  }, []);

  /* Scroll automático al abrir detalle */
  useEffect(() => {
    if (agenteSeleccionado && detalleRef.current) {
      detalleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [agenteSeleccionado]);

  if (loading) {
    return <p className="loading-text">Cargando agentes...</p>;
  }

  return (
    <div className="agents-container">
      <h1 className="agents-title">Agentes</h1>

      {/* DETALLE DEL AGENTE (ARRIBA) */}
      {agenteSeleccionado && (
        <div ref={detalleRef} className="agent-detail">
          <button
            className="agent-detail-close"
            onClick={() => setAgenteSeleccionado(null)}
            aria-label="Cerrar detalle"
          >
            ✕
          </button>

          {/* Imagen grande */}
          {agenteSeleccionado.displayIcon && (
            <img
              src={agenteSeleccionado.displayIcon}
              alt={agenteSeleccionado.displayName}
              className="agent-detail-image"
              loading="lazy"
            />
          )}

          <div className="agent-detail-header">
            <h2 className="agent-detail-name">
              {agenteSeleccionado.displayName}
            </h2>
            <span className="agent-detail-role">
              {agenteSeleccionado.role.displayName}
            </span>
          </div>

          <p className="agent-description">
            {agenteSeleccionado.description}
          </p>

          <h3>Habilidades</h3>

          <div className="abilities-list">
            {agenteSeleccionado.abilities.map((hab, i) => (
              <div key={i} className="ability-card">
                <span className="ability-slot">{hab.slot}</span>
                <h4 className="ability-name">{hab.displayName}</h4>
                <p className="ability-description">
                  {hab.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRID DE AGENTES */}
      <div className="agents-grid">
        {agentes.map((agente, idx) => {
          const activo =
            agenteSeleccionado?.displayName === agente.displayName;

          return (
            <div
              key={idx}
              className={`agent-card ${activo ? "active" : ""}`}
              onClick={() =>
                setAgenteSeleccionado(activo ? null : agente)
              }
            >
              {/* Imagen pequeña */}
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
