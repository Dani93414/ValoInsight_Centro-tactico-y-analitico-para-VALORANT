import { useMemo, useState } from "react";
import { useGameModes } from "../api/hooks";
import type { GameModeContent } from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import {
  formatNumber,
  hideBrokenImage,
  normalizeText,
} from "./contentFormatters";
import "./ContentPages.css";

export default function Modos() {
  const query = useGameModes();
  const [search, setSearch] = useState("");
  const [economyFilter, setEconomyFilter] = useState("all");
  const [selected, setSelected] = useState<GameModeContent | null>(null);

  const modes = useMemo(
    () =>
      [...(query.data ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [query.data],
  );

  const economyTypes = useMemo(() => {
    const types = new Set(
      modes
        .map((mode) => mode.economyType)
        .filter((value): value is string => Boolean(value)),
    );
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [modes]);

  const filtered = modes.filter((mode) => {
    const matchesSearch = normalizeText(
      `${mode.displayName} ${mode.description ?? ""} ${mode.economyType ?? ""}`,
    ).includes(normalizeText(search));
    const matchesEconomy =
      economyFilter === "all" || mode.economyType === economyFilter;
    return matchesSearch && matchesEconomy;
  });

  const getModeRules = (mode: GameModeContent): Array<[string, string]> => [
    ["Duracion", mode.duration || "-"],
    ["Rondas por mitad", formatNumber(mode.roundsPerHalf)],
    ["Economia", mode.economyType || "-"],
    ["Orbes", formatNumber(mode.orbCount)],
    ["Voz de equipo", mode.isTeamVoiceAllowed ? "Si" : "No"],
    ["Minimapa oculto", mode.isMinimapHidden ? "Si" : "No"],
    ["Timeouts", mode.allowsMatchTimeouts ? "Si" : "No"],
    ["Replays custom", mode.allowsCustomGameReplays ? "Si" : "No"],
    [
      "Roles",
      (mode.teamRoles ?? []).length > 0 ? (mode.teamRoles ?? []).join(", ") : "-",
    ],
  ];

  if (query.isLoading) {
    return <ContentLoading title="Cargando modos" />;
  }

  return (
    <ContentShell
      title="Modos de juego"
      subtitle="Modos disponibles con descripcion, reglas, economia e icono local cuando existe."
    >
      {query.isError && (
        <ContentError
          message="No se pudieron cargar los modos de juego."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && modes.length === 0 && (
        <ContentEmpty message="No hay modos de juego disponibles." />
      )}

      {!query.isError && modes.length > 0 && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder="Buscar modo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {economyTypes.length > 0 && (
              <label className="content-select-label">
                Economia
                <select
                  className="content-select"
                  value={economyFilter}
                  onChange={(event) => setEconomyFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {economyTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selected && (
            <article className="content-detail">
              <button
                className="content-detail-close"
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                x
              </button>
              <div className="content-detail-grid">
                <div>
                  <h2 className="content-detail-title">
                    {selected.displayName}
                  </h2>
                  <div className="content-badge-row">
                    <span className="content-badge">
                      {selected.duration || "Sin duracion"}
                    </span>
                    {selected.roundsPerHalf !== undefined &&
                      selected.roundsPerHalf !== null && (
                        <span className="content-badge">
                          {selected.roundsPerHalf} rondas/mitad
                        </span>
                      )}
                    {selected.economyType && (
                      <span className="content-badge">
                        {selected.economyType}
                      </span>
                    )}
                  </div>
                  <p className="content-detail-text">
                    {selected.description || "Sin descripcion."}
                  </p>
                  <div className="content-rule-grid">
                    {getModeRules(selected).map(([label, value]) => (
                      <div className="content-rule" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="content-detail-media">
                  {(selected.listViewIconTall || selected.displayIcon) && (
                    <img
                      className="content-detail-image"
                      src={selected.listViewIconTall || selected.displayIcon || ""}
                      alt={selected.displayName}
                      onError={hideBrokenImage}
                    />
                  )}
                </div>
              </div>
            </article>
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay modos con ese filtro." />
          ) : (
            <div className="content-grid">
              {filtered.map((mode) => {
                const active = selected?.displayName === mode.displayName;
                const icon = mode.displayIcon || mode.listViewIconTall;
                return (
                  <button
                    key={mode.uuid ?? mode.displayName}
                    className={`content-card ${active ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelected(active ? null : mode)}
                  >
                    {icon && (
                      <span className="content-card-image-wrap">
                        <img
                          className="content-card-image"
                          src={icon}
                          alt={mode.displayName}
                          loading="lazy"
                          onError={hideBrokenImage}
                        />
                      </span>
                    )}
                    <h2 className="content-card-title">{mode.displayName}</h2>
                    <p className="content-card-meta">
                      {mode.duration || "Modo"}
                    </p>
                    {mode.economyType && (
                      <p className="content-card-meta">{mode.economyType}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
