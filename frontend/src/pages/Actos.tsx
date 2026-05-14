import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActos,
  useCompetitiveTiers,
  useLeaderboard,
  useLeaderboardRegions,
  useRankDistribution,
} from "../api/hooks";
import type {
  ActContent,
  LeaderboardContent,
  LeaderboardPlayer,
  LeaderboardRankDistributionItem,
} from "../types/content";
import {
  ClearableSearchInput,
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import "./ContentPages.css";

function getActLabel(act: ActContent) {
  return act.name || act.id || "Acto sin nombre";
}

function getActNumber(act: ActContent) {
  const match = getActLabel(act).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isEpisode(act: ActContent) {
  return normalizeText(act.type ?? "") === "episode";
}

function isAct(act: ActContent) {
  return normalizeText(act.type ?? "") === "act";
}

function matchesActSearch(act: ActContent, needle: string) {
  return normalizeText(`${getActLabel(act)} ${act.parentName ?? ""} ${act.type ?? ""}`).includes(needle);
}

function getRankIcon(rankIconByTier: Map<number, string>, tier?: number | string | null) {
  const numericTier = Number(tier);
  if (!Number.isFinite(numericTier)) return null;
  return rankIconByTier.get(numericTier) ?? null;
}

function getLeaderboardPlayerKey(player: LeaderboardPlayer) {
  return [
    player.leaderboardRank ?? "",
    normalizeText(player.gameName ?? ""),
    normalizeText(player.tagLine ?? ""),
  ].join(":");
}

function normalizeLeaderboardSearch(value: unknown) {
  return normalizeText(String(value ?? "").replace(/\u00a0/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function matchesLeaderboardPlayer(player: LeaderboardPlayer, gameName: string, tagLine: string) {
  const gameNameNeedle = normalizeLeaderboardSearch(gameName);
  const tagLineNeedle = normalizeLeaderboardSearch(tagLine);
  if (!gameNameNeedle && !tagLineNeedle) return true;

  const playerName = normalizeLeaderboardSearch(player.gameName);
  const playerTag = normalizeLeaderboardSearch(player.tagLine);

  if (gameNameNeedle && tagLineNeedle) {
    return playerName === gameNameNeedle && playerTag === tagLineNeedle;
  }

  return (
    (!gameNameNeedle || playerName.includes(gameNameNeedle))
    && (!tagLineNeedle || playerTag.includes(tagLineNeedle))
  );
}

function LeaderboardPanel({
  data,
  region,
  platform,
  rankIconByTier,
  rankDistribution,
  leaderboardSearch,
  setLeaderboardSearch,
  leaderboardTag,
  setLeaderboardTag,
  onLeaderboardSearchSubmit,
  onLeaderboardSearchClear,
  isLeaderboardSearching,
  isLeaderboardSearchActive,
  highlightedPlayerKey,
  pageInput,
  setPageInput,
  onPageSubmit,
  onPageChange,
  onClose,
  onPlayerClick,
  onGoToPlayerPage,
}: {
  data: LeaderboardContent;
  region: string;
  platform: string;
  rankIconByTier: Map<number, string>;
  rankDistribution: LeaderboardRankDistributionItem[];
  leaderboardSearch: string;
  setLeaderboardSearch: (value: string) => void;
  leaderboardTag: string;
  setLeaderboardTag: (value: string) => void;
  onLeaderboardSearchSubmit: () => void;
  onLeaderboardSearchClear: () => void;
  isLeaderboardSearching: boolean;
  isLeaderboardSearchActive: boolean;
  highlightedPlayerKey: string | null;
  pageInput: string;
  setPageInput: (value: string) => void;
  onPageSubmit: () => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
  onPlayerClick: (puuid: string) => void;
  onGoToPlayerPage: (player: LeaderboardPlayer) => void;
}) {
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const visiblePlayers = isLeaderboardSearchActive
    ? data.players.filter((player) => matchesLeaderboardPlayer(player, leaderboardSearch, leaderboardTag))
    : data.players;

  useEffect(() => {
    if (!highlightedPlayerKey || !highlightedRowRef.current) return;
    highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data.page, highlightedPlayerKey]);

  return (
    <article className="content-detail actos-leaderboard-detail">
      <button
        className="content-detail-close"
        type="button"
        aria-label="Cerrar leaderboard"
        onClick={onClose}
      >
        <span className="content-detail-close-icon" aria-hidden="true" />
      </button>
      <div className="actos-leaderboard-header">
        <div>
          <h2 className="content-detail-title">
            {data.act_name}
            <span>{region.toUpperCase()} - {platform.toUpperCase()}</span>
          </h2>
          <div className="content-badge-row">
            <span className="content-badge">
              Pagina {data.page} de {data.total_pages}
            </span>
            {isLeaderboardSearchActive ? (
              <span className="content-badge">
                Resultados {visiblePlayers.length}
              </span>
            ) : (
              <span className="content-badge">
                Jugadores {data.filtered_players === 0 ? 0 : (data.page - 1) * data.page_size + 1}-
                {Math.min(data.page * data.page_size, data.filtered_players)}
              </span>
            )}
          </div>
        </div>
      </div>

      <RankDistributionChart
        distribution={rankDistribution}
        rankIconByTier={rankIconByTier}
      />

      <div className="actos-leaderboard-controls">
        <form
          className="actos-leaderboard-search"
          onSubmit={(event) => {
            event.preventDefault();
            onLeaderboardSearchSubmit();
          }}
        >
          <ClearableSearchInput
            inputClassName="content-search--catalog"
            placeholder="gameName"
            value={leaderboardSearch}
            onChange={(event) => setLeaderboardSearch(event.target.value)}
            onClear={() => setLeaderboardSearch("")}
          />
          <ClearableSearchInput
            inputClassName="content-search--catalog"
            placeholder="tagLine"
            value={leaderboardTag}
            onChange={(event) => setLeaderboardTag(event.target.value)}
            onClear={() => setLeaderboardTag("")}
          />
          <button type="submit">
            Buscar
          </button>
          {(leaderboardSearch || leaderboardTag) && (
            <button type="button" onClick={onLeaderboardSearchClear}>
              Limpiar
            </button>
          )}
        </form>
        {isLeaderboardSearching && (
          <div className="actos-search-status" aria-live="polite">
            Buscando jugador...
          </div>
        )}
        <button type="button" onClick={() => onPageChange(Math.max(1, data.page - 1))}>
          Anterior
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onPageSubmit();
          }}
        >
          <input
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            inputMode="numeric"
            aria-label="Pagina"
          />
        </form>
        <button type="button" onClick={() => onPageChange(Math.min(data.total_pages, data.page + 1))}>
          Siguiente
        </button>
      </div>

      {isLeaderboardSearching || visiblePlayers.length === 0 ? (
        <ContentEmpty
          message={
            isLeaderboardSearching
              ? "Buscando jugador..."
              : isLeaderboardSearchActive
              ? "Jugador no encontrado en este acto."
              : "Sin jugadores para este acto."
          }
        />
      ) : (
        <div className="actos-leaderboard-table-wrap">
          <table className="content-table actos-leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Jugador</th>
                <th>Rango</th>
                <th className="actos-delta-heading">24h</th>
                <th>RR</th>
                <th>Victorias</th>
                {isLeaderboardSearchActive && <th>Pagina</th>}
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((player) => {
                const clickable = Boolean(player.hasProfile && player.puuid);
                const name = player.gameName?.trim() || "Desconocido";
                const playerKey = getLeaderboardPlayerKey(player);
                const isHighlighted = highlightedPlayerKey === playerKey;
                return (
                  <tr
                    key={`${player.leaderboardRank}-${name}-${player.tagLine ?? ""}`}
                    ref={(element) => {
                      if (isHighlighted) highlightedRowRef.current = element;
                    }}
                    className={`${clickable ? "is-clickable" : ""} ${isHighlighted ? "is-highlighted" : ""}`.trim()}
                    onClick={() => {
                      if (clickable && player.puuid) onPlayerClick(player.puuid);
                    }}
                  >
                    <td>{player.leaderboardRank ?? "-"}</td>
                    <td>
                      <div className="actos-player-cell">
                        {player.playerCardIcon && (
                          <img
                            src={player.playerCardIcon}
                            alt=""
                            loading="lazy"
                            onError={hideBrokenImage}
                          />
                        )}
                        <span>
                          {player.prefix && <small>{player.prefix}</small>}
                          <strong>{name}</strong>
                          {player.tagLine && <em>#{player.tagLine}</em>}
                        </span>
                      </div>
                    </td>
                    <td>
                      {getRankIcon(rankIconByTier, player.competitiveTier) ? (
                        <img
                          className="actos-rank-icon"
                          src={getRankIcon(rankIconByTier, player.competitiveTier) ?? ""}
                          alt={`Rango ${player.competitiveTier}`}
                          loading="lazy"
                          onError={hideBrokenImage}
                        />
                      ) : (
                        player.competitiveTier ?? "-"
                      )}
                    </td>
                    <td className="actos-rank-delta">
                      {typeof player.rankDelta24h === "number"
                        ? player.rankDelta24h > 0
                          ? `+${player.rankDelta24h}`
                          : player.rankDelta24h
                        : "-"}
                    </td>
                    <td>{player.rankedRating ?? "-"}</td>
                    <td>{player.numberOfWins ?? "-"}</td>
                    {isLeaderboardSearchActive && (
                      <td>
                        {player.leaderboardPage ? (
                          <button
                            className="actos-row-page-link"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onGoToPlayerPage(player);
                            }}
                          >
                            Ir a pagina {player.leaderboardPage}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function RankDistributionChart({
  distribution,
  rankIconByTier,
}: {
  distribution: LeaderboardRankDistributionItem[];
  rankIconByTier: Map<number, string>;
}) {
  if (distribution.length === 0) return null;
  const maxPercentage = Math.max(...distribution.map((item) => item.percentage), 1);
  return (
    <div className="actos-rank-chart">
      {distribution.map((item) => (
        <div className="actos-rank-bar" key={item.tier}>
          <div className="actos-rank-bar-track">
            <span style={{ height: `${Math.max(5, (item.percentage / maxPercentage) * 100)}%` }} />
          </div>
          {getRankIcon(rankIconByTier, item.tier) ? (
            <img src={getRankIcon(rankIconByTier, item.tier) ?? ""} alt={`Rango ${item.tier}`} />
          ) : (
            <small>{item.tier}</small>
          )}
          <strong>{item.percentage}%</strong>
        </div>
      ))}
    </div>
  );
}

export default function Actos() {
  const navigate = useNavigate();
  const actosQuery = useActos();
  const { data: leaderboardRegions } = useLeaderboardRegions();
  const competitiveTiersQuery = useCompetitiveTiers();
  const [search, setSearch] = useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("eu");
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardTag, setLeaderboardTag] = useState("");
  const [debouncedLeaderboardSearch, setDebouncedLeaderboardSearch] = useState("");
  const [debouncedLeaderboardTag, setDebouncedLeaderboardTag] = useState("");
  const [highlightedPlayerKey, setHighlightedPlayerKey] = useState<string | null>(null);
  const [displayLeaderboardData, setDisplayLeaderboardData] = useState<LeaderboardContent | null>(null);
  const [pageInput, setPageInput] = useState("1");
  const skipNextSearchResetRef = useRef(false);

  const acts = useMemo(
    () => [...(actosQuery.data ?? [])],
    [actosQuery.data],
  );

  const episodeDocs = useMemo(() => acts.filter(isEpisode), [acts]);
  const realActs = useMemo(() => acts.filter(isAct), [acts]);
  const activeAct = realActs.find((act) => act.isActive) ?? null;
  const activeEpisodeId = activeAct?.parentId ?? "";
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!selectedEpisodeId && activeEpisodeId) setSelectedEpisodeId(activeEpisodeId);
      if (!selectedActId && activeAct?.id) setSelectedActId(activeAct.id);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeAct?.id, activeEpisodeId, selectedActId, selectedEpisodeId]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDisplayLeaderboardData(null);
      setLeaderboardPage(1);
      setPageInput("1");
      setHighlightedPlayerKey(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedActId, selectedRegion]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = leaderboardSearch.trim();
      const nextTag = leaderboardTag.trim();
      const preserveCurrentPage = skipNextSearchResetRef.current && !nextSearch && !nextTag;
      setDebouncedLeaderboardSearch(nextSearch);
      setDebouncedLeaderboardTag(nextTag);
      skipNextSearchResetRef.current = false;
      if (preserveCurrentPage) return;
      setLeaderboardPage(1);
      setPageInput("1");
      setHighlightedPlayerKey(null);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [leaderboardSearch, leaderboardTag]);

  const rankIconByTier = useMemo(() => {
    const map = new Map<number, string>();
    (competitiveTiersQuery.data ?? []).forEach((tier) => {
      if (typeof tier.tier === "number" && (tier.smallIcon || tier.largeIcon)) {
        map.set(tier.tier, tier.smallIcon || tier.largeIcon || "");
      }
    });
    return map;
  }, [competitiveTiersQuery.data]);
  const searchNeedle = useMemo(() => normalizeText(search), [search]);
  const selectedEpisode = episodeDocs.find((episode) => episode.id === selectedEpisodeId) ?? null;
  const selectedEpisodeActs = selectedEpisode
    ? realActs
        .filter((act) => act.parentId === selectedEpisode.id)
        .filter((act) => matchesActSearch(act, searchNeedle) || matchesActSearch(selectedEpisode, searchNeedle))
        .sort((a, b) => getActNumber(a) - getActNumber(b) || getActLabel(a).localeCompare(getActLabel(b)))
    : [];

  const regionOptions = useMemo(() => {
    const values = (leaderboardRegions ?? [])
      .map((region) => region.toLowerCase())
      .filter((region): region is string => Boolean(region));
    return values.length > 0 ? values : ["eu"];
  }, [leaderboardRegions]);
  const effectiveSelectedRegion = regionOptions.includes(selectedRegion)
    ? selectedRegion
    : regionOptions[0] ?? "eu";
  const selectedAct = selectedActId
    ? realActs.find((act) => act.id === selectedActId) ?? null
    : null;
  const distributionActIds = selectedEpisode && !selectedAct
    ? selectedEpisodeActs.map((act) => act.id).filter((id): id is string => Boolean(id))
    : selectedAct?.id ? [selectedAct.id] : [];
  const rankDistributionQuery = useRankDistribution(distributionActIds);
  const leaderboardQuery = useLeaderboard(
    selectedAct?.id,
    effectiveSelectedRegion,
    "pc",
    leaderboardPage,
    "",
    debouncedLeaderboardSearch,
    debouncedLeaderboardTag,
  );
  const resultCount = selectedEpisodeActs.length;
  const hasLeaderboardSearchDraft = Boolean(leaderboardSearch.trim() || leaderboardTag.trim());
  const isLeaderboardSearchActive = Boolean(debouncedLeaderboardSearch || debouncedLeaderboardTag);
  const isLeaderboardSearchDebouncing =
    leaderboardSearch.trim() !== debouncedLeaderboardSearch
    || leaderboardTag.trim() !== debouncedLeaderboardTag;
  const isLeaderboardSearching =
    hasLeaderboardSearchDraft && (isLeaderboardSearchDebouncing || leaderboardQuery.isFetching);

  useEffect(() => {
    if (!leaderboardQuery.data) return;
    const timeoutId = window.setTimeout(() => {
      setDisplayLeaderboardData(leaderboardQuery.data ?? null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [leaderboardQuery.data]);

  const openAct = (act: ActContent) => {
    setSelectedActId((current) => (current === act.id ? null : act.id ?? null));
  };

  const goToCurrentAct = () => {
    if (!activeAct?.id) return;
    if (activeAct.parentId) setSelectedEpisodeId(activeAct.parentId);
    setSelectedActId(activeAct.id);
    setLeaderboardPage(1);
    setPageInput("1");
  };

  const submitLeaderboardSearch = () => {
    setDebouncedLeaderboardSearch(leaderboardSearch.trim());
    setDebouncedLeaderboardTag(leaderboardTag.trim());
    setLeaderboardPage(1);
    setPageInput("1");
    setHighlightedPlayerKey(null);
  };

  const clearLeaderboardSearch = () => {
    setLeaderboardSearch("");
    setLeaderboardTag("");
    setDebouncedLeaderboardSearch("");
    setDebouncedLeaderboardTag("");
    setLeaderboardPage(1);
    setPageInput("1");
    setHighlightedPlayerKey(null);
  };

  if (actosQuery.isLoading) {
    return <ContentLoading title="Cargando actos" />;
  }

  const leaderboardContent = selectedAct && (
    <>
      {leaderboardQuery.isLoading && !displayLeaderboardData && (
        <div className="content-state-card actos-leaderboard-loading">
          <h2>Cargando leaderboard</h2>
          <p>Consultando {effectiveSelectedRegion.toUpperCase()} - PC.</p>
        </div>
      )}
      {leaderboardQuery.isError && (
        <ContentError
          title="Sin leaderboard"
          message="No hay leaderboard disponible para este acto."
          onRetry={() => leaderboardQuery.refetch()}
        />
      )}
      {displayLeaderboardData && (
        <LeaderboardPanel
          data={displayLeaderboardData}
          region={effectiveSelectedRegion}
          platform="pc"
          rankIconByTier={rankIconByTier}
          rankDistribution={rankDistributionQuery.data ?? displayLeaderboardData.rank_distribution ?? []}
          leaderboardSearch={leaderboardSearch}
          setLeaderboardSearch={setLeaderboardSearch}
          leaderboardTag={leaderboardTag}
          setLeaderboardTag={setLeaderboardTag}
          onLeaderboardSearchSubmit={submitLeaderboardSearch}
          onLeaderboardSearchClear={clearLeaderboardSearch}
          isLeaderboardSearching={isLeaderboardSearching}
          isLeaderboardSearchActive={isLeaderboardSearchActive}
          highlightedPlayerKey={highlightedPlayerKey}
          pageInput={pageInput}
          setPageInput={setPageInput}
          onPageSubmit={() => {
            const nextPage = Number(pageInput);
            if (Number.isFinite(nextPage)) {
              setLeaderboardPage(Math.max(1, Math.min(displayLeaderboardData.total_pages, nextPage)));
            }
          }}
          onPageChange={(page) => {
            setLeaderboardPage(page);
            setPageInput(String(page));
          }}
          onClose={() => setSelectedActId(null)}
          onPlayerClick={(puuid) => navigate(`/estadisticas/${puuid}`)}
          onGoToPlayerPage={(player) => {
            const page = player.leaderboardPage;
            if (!page) return;
            setHighlightedPlayerKey(getLeaderboardPlayerKey(player));
            skipNextSearchResetRef.current = true;
            setLeaderboardSearch("");
            setLeaderboardTag("");
            setDebouncedLeaderboardSearch("");
            setDebouncedLeaderboardTag("");
            setLeaderboardPage(page);
            setPageInput(String(page));
          }}
        />
      )}
    </>
  );

  return (
    <ContentShell
      title="Actos"
      subtitle="Actos por episodio y leaderboard por region y plataforma."
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
          <div className="content-toolbar content-toolbar--catalog actos-toolbar">
            <ClearableSearchInput
              inputClassName="content-search--catalog"
              placeholder="Buscar acto o episodio..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
            <span className="content-result-count">{resultCount}</span>
            <button
              className="actos-current-button"
              type="button"
              disabled={!activeAct?.id}
              onClick={goToCurrentAct}
            >
              Acto actual
            </button>
            <label className="content-select-label content-level-selector actos-filter-select">
              Episodio
              <select
                className="content-select content-level-select"
                value={selectedEpisodeId}
                onChange={(event) => {
                  const nextEpisode = event.target.value;
                  setSelectedEpisodeId(nextEpisode);
                  setSelectedActId(null);
                }}
              >
                {episodeDocs.map((episode) => (
                  <option key={episode.id ?? getActLabel(episode)} value={episode.id ?? ""}>
                    {getActLabel(episode)}
                  </option>
                ))}
              </select>
            </label>
            {selectedEpisode && (
              <label className="content-select-label content-level-selector actos-filter-select">
                Acto
                <select
                  className="content-select content-level-select"
                  value={selectedActId ?? ""}
                  onChange={(event) => setSelectedActId(event.target.value || null)}
                >
                  <option value="">Elegir acto</option>
                  {selectedEpisodeActs.map((act) => (
                    <option key={act.id ?? getActLabel(act)} value={act.id ?? ""}>
                      {getActLabel(act)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="content-select-label content-level-selector">
              Region
              <select
                className="content-select content-level-select"
                value={effectiveSelectedRegion}
                onChange={(event) => {
                  setSelectedRegion(event.target.value);
                  setLeaderboardPage(1);
                  setPageInput("1");
                }}
              >
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedEpisode ? (
            <div className="actos-episode-list">
              <section className="actos-episode is-open">
                <button
                  className="actos-episode-toggle"
                  type="button"
                  onClick={() => undefined}
                  aria-expanded
                >
                  <span>{getActLabel(selectedEpisode)}</span>
                  <strong>{selectedEpisodeActs.length}</strong>
                </button>
                {!selectedAct && (rankDistributionQuery.data?.length ?? 0) > 0 && (
                  <div className="actos-episode-distribution">
                    <RankDistributionChart
                      distribution={rankDistributionQuery.data ?? []}
                      rankIconByTier={rankIconByTier}
                    />
                  </div>
                )}
                <div className="content-grid actos-act-grid">
                  {selectedEpisodeActs.map((act) => (
                    <div key={act.id ?? getActLabel(act)} className="actos-act-slot">
                      <button
                        className={`content-card actos-act-card ${selectedActId === act.id ? "active" : ""}`}
                        type="button"
                        onClick={() => openAct(act)}
                      >
                        {act.isActive && <span className="content-badge actos-current-badge">Acto actual</span>}
                        <h2 className="content-card-title">{getActLabel(act)}</h2>
                        <p className="content-card-meta">{getActLabel(selectedEpisode)}</p>
                      </button>
                      {selectedActId === act.id && (
                        <div className="actos-leaderboard-slot">
                          {leaderboardContent}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <ContentEmpty message="No hay actos con ese filtro." />
          )}
        </>
      )}
    </ContentShell>
  );
}
