import React from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, Crosshair, LoaderCircle, Trophy } from "lucide-react";
import { getMatchById } from "../../api/playerApi";
import type { MatchCard, SideFilter } from "../../types/dashboard";
import type { RawMatchDetail } from "../../types/matches";
import { normalizeLabel } from "../../utils/formatters";
import { lockPageScroll } from "../../utils/lockPageScroll";
import {
  extractRoundHistoryEvents,
  type RoundEventKind,
  type RoundHistoryEvent,
} from "./roundEventHistory";

type Props = {
  kind: RoundEventKind;
  matches: MatchCard[];
  playerId: string;
  side: SideFilter;
  agentMediaMap: Record<
    string,
    {
      name?: string;
      image?: string | null;
      displayIcon?: string | null;
      roleName?: string;
    }
  >;
  mapMediaMap?: Record<string, string>;
  obscured?: boolean;
  onClose: () => void;
  onSelect: (event: RoundHistoryEvent) => void;
};

export default function RoundEventHistoryModal({
  kind,
  matches,
  playerId,
  side,
  agentMediaMap,
  mapMediaMap,
  obscured = false,
  onClose,
  onSelect,
}: Props) {
  const [selectedRole, setSelectedRole] = React.useState("all");
  const [selectedSide, setSelectedSide] = React.useState<SideFilter>(side);
  const [selectedAgent, setSelectedAgent] = React.useState("all");
  const [selectedMap, setSelectedMap] = React.useState("all");
  const queries = useQueries({
    queries: matches.map((match) => ({
      queryKey: ["match", match.id],
      queryFn: () => getMatchById(match.id),
      staleTime: Infinity,
    })),
  });
  const allEvents = React.useMemo(
    () =>
      queries.flatMap((query, index) =>
        extractRoundHistoryEvents(
          (query.data as RawMatchDetail | null | undefined) ?? null,
          matches[index],
          playerId,
          kind,
          "all",
        ),
      ),
    [kind, matches, playerId, queries],
  );
  const { events, roleOptions, sideOptions, agentOptions, mapOptions } =
    React.useMemo(() => {
      const eventRole = (event: RoundHistoryEvent) =>
        (event.match.role ||
          (event.match.agentId
            ? agentMediaMap[event.match.agentId]?.roleName
            : "") ||
          "").trim();
      const eventAgentId = (event: RoundHistoryEvent) =>
        event.match.agentId || event.match.agent;
      const matchesFilters = (
        event: RoundHistoryEvent,
        omitted?: "role" | "side" | "agent" | "map",
      ) => {
        const role =
          omitted === "role" || selectedRole === "all" ||
          eventRole(event) === selectedRole;
        const eventSide =
          omitted === "side" || selectedSide === "all" ||
          event.side === selectedSide;
        const agent =
          omitted === "agent" || selectedAgent === "all" ||
          eventAgentId(event) === selectedAgent;
        const map =
          omitted === "map" || selectedMap === "all" ||
          event.match.map === selectedMap;
        return role && eventSide && agent && map;
      };

      const filteredEvents = allEvents.filter((event) => matchesFilters(event));
      const roles = Array.from(
        new Set(
          allEvents
            .filter((event) => matchesFilters(event, "role"))
            .map(eventRole)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "es"));
      const sides = Array.from(
        new Set(
          allEvents
            .filter((event) => matchesFilters(event, "side"))
            .map((event) => event.side),
        ),
      );
      const agents = Array.from(
        new Map(
          allEvents
            .filter((event) => matchesFilters(event, "agent"))
            .map((event) => [eventAgentId(event), event.match.agent]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1], "es"));
      const maps = Array.from(
        new Set(
          allEvents
            .filter((event) => matchesFilters(event, "map"))
            .map((event) => event.match.map),
        ),
      ).sort((a, b) => a.localeCompare(b, "es"));

      return {
        events: filteredEvents,
        roleOptions: roles,
        sideOptions: sides,
        agentOptions: agents,
        mapOptions: maps,
      };
    }, [
      agentMediaMap,
      allEvents,
      selectedAgent,
      selectedMap,
      selectedRole,
      selectedSide,
    ]);
  const loadedCount = queries.filter(
    (query) => query.isSuccess || query.isError,
  ).length;
  const isLoading = loadedCount < queries.length;
  const title = kind === "ace" ? "ACE" : "Primeras sangres";

  React.useEffect(() => {
    if (obscured) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [obscured, onClose]);

  React.useEffect(lockPageScroll, []);

  return (
    <div
      className="list-modal-overlay round-event-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-event-modal-title"
      aria-hidden={obscured || undefined}
      onClick={onClose}
    >
      <div
        className={`list-modal-content round-event-modal round-event-modal--${kind === "ace" ? "ace" : "first-blood"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="list-modal-header round-event-modal-header">
          <div>
            <span className="round-event-modal-eyebrow">Estadísticas de rondas</span>
            <h3 id="round-event-modal-title">{title}</h3>
          </div>
          <button
            type="button"
            className="list-modal-close"
            onClick={onClose}
            aria-label={`Cerrar historial de ${title}`}
          >
            ✕
          </button>
        </div>

        <div className="list-modal-body round-event-modal-body">
          {allEvents.length > 0 ? (
            <div className="round-event-filters" aria-label="Filtros de eventos">
            <label>
              <span>Rol</span>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                <option value="all">Todos</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Lado</span>
              <select
                value={selectedSide}
                onChange={(event) => setSelectedSide(event.target.value as SideFilter)}
              >
                <option value="all">Ambos</option>
                {sideOptions.includes("attack") ? (
                  <option value="attack">Ataque</option>
                ) : null}
                {sideOptions.includes("defense") ? (
                  <option value="defense">Defensa</option>
                ) : null}
              </select>
            </label>
            <label>
              <span>Agente</span>
              <select
                value={selectedAgent}
                onChange={(event) => setSelectedAgent(event.target.value)}
              >
                <option value="all">Todos</option>
                {agentOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Mapa</span>
              <select
                value={selectedMap}
                onChange={(event) => setSelectedMap(event.target.value)}
              >
                <option value="all">Todos</option>
                {mapOptions.map((map) => (
                  <option key={map} value={map}>{map}</option>
                ))}
              </select>
            </label>
            </div>
          ) : null}

          {allEvents.length > 0 ? (
            <div className="round-event-modal-summary">
              {kind === "ace" ? <Trophy aria-hidden="true" /> : <Crosshair aria-hidden="true" />}
              <span>
                <strong>{events.length}</strong>
                {events.length === 1 ? " evento mostrado" : " eventos mostrados"}
              </span>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div className="round-event-list">
              {events.map((event) => {
                const agentMedia = event.match.agentId
                  ? agentMediaMap[event.match.agentId]
                  : undefined;
                const agentImage = agentMedia?.displayIcon || agentMedia?.image;
                const mapImage = mapMediaMap?.[normalizeLabel(event.match.map)];
                const role = event.match.role || agentMedia?.roleName;

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`round-event-row${mapImage ? " has-map-image" : ""}`}
                    style={
                      mapImage
                        ? ({
                            ["--round-event-map-bg" as string]: `url("${mapImage}")`,
                          } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => onSelect(event)}
                  >
                    <span className="round-event-agent">
                      {agentImage ? (
                        <img src={agentImage} alt={event.match.agent} />
                      ) : (
                        <strong>{event.match.agent.charAt(0)}</strong>
                      )}
                    </span>
                    <span className="round-event-match">
                      <strong>{event.match.map}</strong>
                      <small>
                        {event.match.dateLabel}
                        {role ? ` · ${role}` : ""}
                      </small>
                      <span className={`round-event-outcome is-${event.match.result.toLowerCase()}`}>
                        {event.match.result} · {event.match.roundScore}
                      </span>
                    </span>
                    <span className="round-event-round">
                      <small>Ronda</small>
                      <strong>{event.roundNum + 1}</strong>
                    </span>
                    <ChevronRight className="round-event-chevron" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : !isLoading ? (
            <div className="empty-panel">
              No se encontraron eventos en las partidas disponibles.
            </div>
          ) : null}

          {isLoading ? (
            <div className="round-event-loading" role="status">
              <LoaderCircle aria-hidden="true" />
              <span>
                Revisando partidas… {loadedCount} de {queries.length}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
