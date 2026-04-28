import { useEffect, useMemo, useState } from "react";
import { useActos, useLeaderboard, useRegions } from "../api/hooks";
import type { ActContent } from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import { normalizeText } from "./contentFormatters";
import "./ContentPages.css";

function getActLabel(act: ActContent) {
  return act.name || act.id || "Acto sin nombre";
}

export default function Actos() {
  const actosQuery = useActos();
  const { data: regions } = useRegions();
  const [search, setSearch] = useState("");
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("eu");

  const acts = useMemo(
    () =>
      [...(actosQuery.data ?? [])].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return getActLabel(a).localeCompare(getActLabel(b));
      }),
    [actosQuery.data],
  );

  const fallbackActId = acts.find((act) => act.isActive)?.id ?? acts[0]?.id ?? null;
  const currentActId =
    selectedActId && acts.some((act) => act.id === selectedActId)
      ? selectedActId
      : fallbackActId;
  const selectedAct = acts.find((act) => act.id === currentActId) ?? null;
  const regionOptions = useMemo(() => {
    const values = (regions ?? [])
      .map((region) => region.region)
      .filter((region): region is string => Boolean(region));
    return values.length > 0 ? values : ["eu"];
  }, [regions]);
  const leaderboardQuery = useLeaderboard(currentActId, selectedRegion);

  useEffect(() => {
    if (!regionOptions.includes(selectedRegion)) {
      setSelectedRegion(regionOptions[0] ?? "eu");
    }
  }, [regionOptions, selectedRegion]);

  const filtered = acts.filter((act) =>
    normalizeText(`${getActLabel(act)} ${act.parentName ?? ""} ${act.type ?? ""}`)
      .includes(normalizeText(search)),
  );

  if (actosQuery.isLoading) {
    return <ContentLoading title="Cargando actos" />;
  }

  return (
    <ContentShell
      title="Actos"
      subtitle="Actos del contenido local y leaderboard por region del acto seleccionado."
    >
      {actosQuery.isError && (
        <ContentError
          message="No se pudieron cargar los actos."
          onRetry={() => actosQuery.refetch()}
        />
      )}

      {!actosQuery.isError && acts.length === 0 && (
        <ContentEmpty message="No hay actos disponibles." />
      )}

      {!actosQuery.isError && acts.length > 0 && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder="Buscar acto..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="content-select-label">
              Region
              <select
                className="content-select"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
              >
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedAct && (
            <article className="content-detail">
              <div className="content-detail-grid">
                <div>
                  <h2 className="content-detail-title">
                    {getActLabel(selectedAct)}
                  </h2>
                  <div className="content-badge-row">
                    <span className="content-badge">
                      {selectedAct.type ?? "Acto"}
                    </span>
                    {selectedAct.parentName && (
                      <span className="content-badge">
                        {selectedAct.parentName}
                      </span>
                    )}
                    {selectedAct.isActive && (
                      <span className="content-badge">Activo</span>
                    )}
                    <span className="content-badge">
                      Region {selectedRegion.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div>
                  {leaderboardQuery.isLoading && (
                    <div className="content-state-card">
                      <h2>Cargando leaderboard</h2>
                      <p>
                        Consultando top 100 del acto en{" "}
                        {selectedRegion.toUpperCase()}.
                      </p>
                    </div>
                  )}
                  {leaderboardQuery.isError && (
                    <ContentError
                      title="Sin leaderboard"
                      message="No hay leaderboard disponible para este acto."
                      onRetry={() => leaderboardQuery.refetch()}
                    />
                  )}
                  {leaderboardQuery.data && (
                    <div className="content-panel">
                      <h3 className="content-panel-title">
                        Leaderboard {leaderboardQuery.data.act_name} ·{" "}
                        {selectedRegion.toUpperCase()}
                      </h3>
                      <p className="content-panel-subtitle">
                        {leaderboardQuery.data.returned_players} de{" "}
                        {leaderboardQuery.data.total_players} jugadores
                        disponibles.
                      </p>
                      {leaderboardQuery.data.players.length === 0 ? (
                        <ContentEmpty message="Sin jugadores para este acto." />
                      ) : (
                        <table className="content-table">
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Jugador</th>
                              <th>RR</th>
                              <th>Victorias</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboardQuery.data.players.map((player) => (
                              <tr
                                key={`${player.leaderboardRank}-${player.gameName}`}
                              >
                                <td>{player.leaderboardRank ?? "-"}</td>
                                <td>
                                  {player.gameName ?? "Unknown"}
                                  {player.tagLine ? `#${player.tagLine}` : ""}
                                </td>
                                <td>{player.rankedRating ?? "-"}</td>
                                <td>{player.numberOfWins ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay actos con ese filtro." />
          ) : (
            <div className="content-grid">
              {filtered.map((act) => {
                const id = act.id ?? getActLabel(act);
                const active = currentActId === act.id;
                return (
                  <button
                    key={id}
                    className={`content-card ${active ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelectedActId(act.id ?? null)}
                  >
                    <h2 className="content-card-title">{getActLabel(act)}</h2>
                    <p className="content-card-meta">
                      {act.isActive ? "Activo" : act.type || "Acto"}
                    </p>
                    {act.parentName && (
                      <p className="content-card-meta">{act.parentName}</p>
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
