import { useEffect, useMemo, useState } from "react";
import {
  useMatchById,
  useAgentes,
  useArmas,
  useMapasGeo,
  useCompetitiveTiers,
} from "../../api/hooks";
import {
  safeDivide,
  formatDateTime,
  normalizeArrayResponse,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import {
  getRankNameFromTier,
  normalizeCompetitiveTierIconPath,
} from "../../utils/rankUtils";
import type { AgentContent } from "../../types/agents";
import type { Arma } from "../../types/weapons";
import type {
  RawKillEvent,
  RawLocation,
  RawMatchDetail,
  RawPlayer,
  RawPlayerLocation,
} from "../../types/matches";
import "./DetailModals.css";

type Props = {
  matchId: string;
  playerId: string;
  agentNameMap: Record<string, string>;
  onClose: () => void;
};

type MapGeoContent = {
  uuid?: string;
  displayName?: string;
  displayIcon?: string | null;
  xMultiplier?: number;
  xScalarToAdd?: number;
  yMultiplier?: number;
  yScalarToAdd?: number;
};

type CompetitiveTierContent = {
  tier?: number | string | null;
  tierName?: string;
  smallIcon?: string;
  largeIcon?: string;
};

type SideKey = "attack" | "defense";
type EventFilterKey =
  | "all"
  | "kills"
  | "deaths"
  | "opening"
  | "trade"
  | "objectives";
type MatchDetailSection =
  | "summary"
  | "rounds"
  | "duels"
  | "economy"
  | "team"
  | "map";

type WeaponCatalogEntry = {
  id: string;
  displayName: string;
  displayIcon?: string | null;
};

type KillRoundEvent = {
  id: string;
  kind: "kill";
  roundNum: number;
  timeMs: number;
  killer?: string;
  victim?: string;
  killerName: string;
  victimName: string;
  killerIcon?: string;
  victimIcon?: string;
  weaponId?: string;
  weaponName: string;
  weaponIcon?: string | null;
  damageType?: string;
  playerLocations: RawPlayerLocation[];
  killerLocation?: RawLocation;
  victimLocation?: RawLocation;
  isPlayerKill: boolean;
  isPlayerDeath: boolean;
  isOpening: boolean;
  isTrade: boolean;
};

type ObjectiveRoundEvent = {
  id: string;
  kind: "plant" | "defuse";
  roundNum: number;
  timeMs: number;
  actor?: string;
  actorName: string;
  site?: string;
  location?: RawLocation;
  playerLocations: RawPlayerLocation[];
};

type RoundEvent = KillRoundEvent | ObjectiveRoundEvent;

type RoundSummary = {
  roundNum: number;
  side: SideKey;
  didWin: boolean;
  winningTeam: string;
  roundResult: string;
  playerKills: number;
  playerDeaths: number;
  playerAssists: number;
  playerScore: number;
  playerSpent: number;
  playerLoadout: number;
  playerDamage: number;
  hadPlant: boolean;
  hadDefuse: boolean;
  events: RoundEvent[];
};

type SideSummary = {
  key: SideKey;
  label: string;
  rounds: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  spent: number;
  loadout: number;
  kd: number;
  kda: number;
  winRate: number;
  killsPerRound: number;
  avgSpent: number;
  avgLoadout: number;
};

type WeaponSummary = {
  id: string;
  name: string;
  icon?: string | null;
  kills: number;
};

type MatchAnalysis = {
  rounds: RoundSummary[];
  totalRounds: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  kd: number;
  kda: number;
  killsPerRound: number;
  totalDamage: number;
  adr: number;
  acs: number;
  kastPct: number;
  headshotPct: number;
  survivalRounds: number;
  survivalPct: number;
  multikillRounds: number;
  maxKillsInRound: number;
  roundsWon: number;
  roundsWonWithImpact: number;
  winRoundParticipationPct: number;
  tradeKills: number;
  openingWon: number;
  openingLost: number;
  roundsWithKills: number;
  topWeapons: WeaponSummary[];
  bestRound: RoundSummary | null;
  sideSummary: SideSummary[];
  totalSpent: number;
  avgSpent: number;
  avgLoadout: number;
  ecoRounds: number;
  ecoWins: number;
  fullBuyRounds: number;
  fullBuyWins: number;
  insights: string[];
};

const matchDetailSections = [
  { key: "summary", label: "Resumen" },
  { key: "rounds", label: "Rondas" },
  { key: "duels", label: "Duelos" },
  { key: "economy", label: "Economía" },
  { key: "team", label: "Equipo" },
  { key: "map", label: "Mapa" },
] as const satisfies ReadonlyArray<{
  key: MatchDetailSection;
  label: string;
}>;

type MapTransform = {
  xMultiplier: number;
  xScalarToAdd: number;
  yMultiplier: number;
  yScalarToAdd: number;
};

type EventMapMarker = {
  id: string;
  x: number;
  y: number;
  label: string;
  icon?: string;
  actorIcon?: string;
  actorLabel?: string;
  weaponIcon?: string | null;
  weaponLabel?: string;
  deathIcon?: string;
  team: "ally" | "enemy" | "neutral";
  kind: "player" | "victim" | "objective";
  isTarget: boolean;
};

type EventMapState = {
  markers: EventMapMarker[];
  hasSnapshot: boolean;
};

type MatchResultState = "win" | "loss" | "draw";

const WEAPON_ICON_ID_RE = /\/content\/weapons\/([^/]+)\/displayIcon\.png/i;

function cleanId(value?: string | null): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === "string") return "";
  return text;
}

function cleanSite(value?: string | null): string | undefined {
  const site = cleanId(value);
  return site || undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSecondsLabel(ms?: number): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function toGameDurationLabel(ms?: number): string {
  const millis = toNumber(ms);
  if (!millis) return "";
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseAssistants(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanId(String(entry))).filter(Boolean);
  }
  if (typeof value === "string") {
    const assistant = cleanId(value);
    return assistant ? [assistant] : [];
  }
  return [];
}

function getWeaponIdFromIcon(icon?: string | null): string {
  if (!icon) return "";
  const match = icon.match(WEAPON_ICON_ID_RE);
  return cleanId(match?.[1]);
}

function determineRoundSide(teamId: string, roundNum: number): SideKey {
  const isRed = teamId.toLowerCase() === "red";

  if (roundNum < 12) {
    return isRed ? "attack" : "defense";
  }
  if (roundNum < 24) {
    return isRed ? "defense" : "attack";
  }

  const overtimeSet = Math.floor((roundNum - 24) / 2);
  const redAttacks = overtimeSet % 2 === 0;
  if (redAttacks) {
    return isRed ? "attack" : "defense";
  }
  return isRed ? "defense" : "attack";
}

function getMvp(currentMatch: RawMatchDetail) {
  const players = currentMatch.players ?? [];
  if (players.length === 0) return null;

  return [...players].sort((a, b) => {
    const scoreA = a.stats?.score ?? 0;
    const scoreB = b.stats?.score ?? 0;
    return scoreB - scoreA;
  })[0];
}

function getPlayerDisplay(player?: RawPlayer | null) {
  if (!player) return "Unknown";
  if (player.gameName && player.tagLine) {
    return `${player.gameName}#${player.tagLine}`;
  }
  return player.gameName ?? "Unknown";
}

function getPlayerShortDisplay(player?: RawPlayer | null) {
  if (!player) return "Unknown";
  return player.gameName?.trim() || getPlayerDisplay(player);
}

function getPlayerMatchKda(player: RawPlayer): string {
  const kills = toNumber(player.stats?.kills);
  const deaths = toNumber(player.stats?.deaths);
  const assists = toNumber(player.stats?.assists);
  return `${kills}/${deaths}/${assists}`;
}

function getPlayerMatchKd(player: RawPlayer): number {
  return safeDivide(toNumber(player.stats?.kills), Math.max(toNumber(player.stats?.deaths), 1));
}

function getPlayerMatchAcs(player: RawPlayer): number {
  return safeDivide(toNumber(player.stats?.score), Math.max(toNumber(player.stats?.roundsPlayed), 1));
}

function getAgentMeta(
  player: RawPlayer | null | undefined,
  agentById: Map<string, AgentContent>,
  agentNameMap: Record<string, string>,
) {
  const agentId = cleanId(player?.characterId);
  const agent = agentId ? agentById.get(agentId) : undefined;
  return {
    agentId,
    name: agent?.displayName ?? agentNameMap[agentId] ?? "Agente desconocido",
    icon: agent?.displayIconSmall ?? agent?.displayIcon ?? null,
  };
}

function toMapTransform(mapMeta: MapGeoContent | null): MapTransform | null {
  if (
    !mapMeta ||
    mapMeta.xMultiplier === undefined ||
    mapMeta.xScalarToAdd === undefined ||
    mapMeta.yMultiplier === undefined ||
    mapMeta.yScalarToAdd === undefined
  ) {
    return null;
  }

  const transform = {
    xMultiplier: Number(mapMeta.xMultiplier),
    xScalarToAdd: Number(mapMeta.xScalarToAdd),
    yMultiplier: Number(mapMeta.yMultiplier),
    yScalarToAdd: Number(mapMeta.yScalarToAdd),
  };

  if (
    !Number.isFinite(transform.xMultiplier) ||
    !Number.isFinite(transform.xScalarToAdd) ||
    !Number.isFinite(transform.yMultiplier) ||
    !Number.isFinite(transform.yScalarToAdd)
  ) {
    return null;
  }

  return transform;
}

function transformLocation(
  location: RawLocation | undefined,
  transform: MapTransform | null,
): { x: number; y: number } | null {
  if (!location || !transform) return null;
  if (location.x === undefined || location.y === undefined) return null;

  const gameX = Number(location.x);
  const gameY = Number(location.y);
  if (!Number.isFinite(gameX) || !Number.isFinite(gameY)) return null;

  const normalizedX = gameY * transform.xMultiplier + transform.xScalarToAdd;
  const normalizedY = gameX * transform.yMultiplier + transform.yScalarToAdd;
  if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
    return null;
  }

  return {
    x: Math.max(0, Math.min(1, normalizedX)),
    y: Math.max(0, Math.min(1, normalizedY)),
  };
}

function roundLabel(roundNum: number): string {
  return `Ronda ${roundNum + 1}`;
}

function getEventDescription(event: RoundEvent): string {
  if (event.kind === "kill") {
    return `${event.killerName} eliminó a ${event.victimName}`;
  }
  return `${event.kind === "plant" ? "Plant" : "Defuse"}`;
}

function getTeamScoreState(
  currentMatch: RawMatchDetail | null,
  playerTeam: string,
): {
  selectedTeamRounds: number;
  opponentTeamRounds: number;
  resultState: MatchResultState;
} {
  const teams = currentMatch?.teams ?? [];
  const selectedTeamInfo =
    teams.find((team) => cleanId(team.teamId) === playerTeam) ?? null;
  const opponentTeamInfo =
    teams.find((team) => cleanId(team.teamId) !== playerTeam) ?? null;

  const selectedRoundsFromTeam = toNumber(selectedTeamInfo?.roundsWon);
  const opponentRoundsFromTeam = toNumber(opponentTeamInfo?.roundsWon);
  const selectedRoundsLost = toNumber(selectedTeamInfo?.roundsLost);
  let countedSelectedRounds = 0;
  let countedOpponentRounds = 0;

  for (const round of currentMatch?.roundResults ?? []) {
    const winningTeam = cleanId(round.winningTeam);
    if (!winningTeam) continue;
    if (winningTeam === playerTeam) {
      countedSelectedRounds += 1;
    } else {
      countedOpponentRounds += 1;
    }
  }

  const selectedTeamRounds = selectedRoundsFromTeam || countedSelectedRounds;
  let opponentTeamRounds = opponentRoundsFromTeam;

  if (!opponentTeamRounds && selectedRoundsLost > 0) {
    opponentTeamRounds = selectedRoundsLost;
  }

  if (!opponentTeamRounds && countedOpponentRounds > 0) {
    opponentTeamRounds = countedOpponentRounds;
  }

  const resultState: MatchResultState =
    selectedTeamRounds === opponentTeamRounds
      ? "draw"
      : selectedTeamRounds > opponentTeamRounds
        ? "win"
        : "loss";

  return { selectedTeamRounds, opponentTeamRounds, resultState };
}

function buildEventMapState({
  event,
  mapTransform,
  playersByPuuid,
  playerTeam,
  selectedPlayerId,
  agentById,
}: {
  event: RoundEvent | null;
  mapTransform: MapTransform | null;
  playersByPuuid: Map<string, RawPlayer>;
  playerTeam: string;
  selectedPlayerId: string;
  agentById: Map<string, AgentContent>;
}): EventMapState {
  if (!event) {
    return { markers: [], hasSnapshot: false };
  }

  const markers: EventMapMarker[] = [];
  const usedIds = new Set<string>();
  const objectiveActorId =
    event.kind === "plant" || event.kind === "defuse"
      ? cleanId(event.actor)
      : "";

  const pushMarker = (marker: EventMapMarker) => {
    if (usedIds.has(marker.id)) return;
    usedIds.add(marker.id);
    markers.push(marker);
  };

  const addSnapshotMarker = (entry: RawPlayerLocation, index: number) => {
    const puuid = cleanId(entry.puuid);
    if (objectiveActorId && puuid === objectiveActorId) return;

    const position = transformLocation(entry.location, mapTransform);
    if (!position) return;

    const player = puuid ? playersByPuuid.get(puuid) : undefined;
    const agent = cleanId(player?.characterId)
      ? agentById.get(cleanId(player?.characterId))
      : undefined;
    const teamId = puuid ? cleanId(player?.teamId) : "";

    pushMarker({
      id: `snapshot-${event.id}-${puuid || index}`,
      x: position.x,
      y: position.y,
      label: getPlayerDisplay(player),
      icon: agent?.displayIconSmall ?? agent?.displayIcon ?? undefined,
      team:
        !teamId || !playerTeam
          ? "neutral"
          : teamId === playerTeam
            ? "ally"
            : "enemy",
      kind: "player",
      isTarget: puuid === selectedPlayerId,
      weaponIcon:
        event.kind === "kill" && puuid === cleanId(event.killer)
          ? event.weaponIcon
          : undefined,
      weaponLabel:
        event.kind === "kill" && puuid === cleanId(event.killer)
          ? event.weaponName
          : undefined,
    });
  };

  event.playerLocations.forEach(addSnapshotMarker);

  if (event.kind === "kill") {
    const killerId = cleanId(event.killer);
    const hasKillerSnapshot = event.playerLocations.some(
      (entry) => cleanId(entry.puuid) === killerId,
    );
    const killerPos = transformLocation(event.killerLocation, mapTransform);
    if (killerId && killerPos && !hasKillerSnapshot) {
      const killer = playersByPuuid.get(killerId);
      const killerTeamId = cleanId(killer?.teamId);
      const killerAgent = cleanId(killer?.characterId)
        ? agentById.get(cleanId(killer?.characterId))
        : undefined;

      pushMarker({
        id: `killer-${event.id}`,
        x: killerPos.x,
        y: killerPos.y,
        label: event.killerName,
        icon: killerAgent?.displayIconSmall ?? killerAgent?.displayIcon ?? undefined,
        weaponIcon: event.weaponIcon,
        weaponLabel: event.weaponName,
        team:
          !killerTeamId || !playerTeam
            ? "neutral"
            : killerTeamId === playerTeam
              ? "ally"
              : "enemy",
        kind: "player",
        isTarget: killerId === selectedPlayerId,
      });
    }

    const victimPos = transformLocation(event.victimLocation, mapTransform);
    if (victimPos) {
      const victim = cleanId(event.victim)
        ? playersByPuuid.get(cleanId(event.victim))
        : undefined;
      const victimTeamId = cleanId(victim?.teamId);
      const victimAgent = cleanId(victim?.characterId)
        ? agentById.get(cleanId(victim?.characterId))
        : undefined;

      pushMarker({
        id: `victim-${event.id}`,
        x: victimPos.x,
        y: victimPos.y,
        label: `Posición de ${event.victimName}`,
        icon: victimAgent?.displayIconSmall ?? victimAgent?.displayIcon ?? undefined,
        deathIcon: "X",
        team:
          !victimTeamId || !playerTeam
            ? "neutral"
            : victimTeamId === playerTeam
              ? "ally"
              : "enemy",
        kind: "victim",
        isTarget: cleanId(event.victim) === selectedPlayerId,
      });
    }
  }

  if (event.kind === "plant" || event.kind === "defuse") {
    const objectivePos = transformLocation(event.location, mapTransform);
    if (objectivePos) {
      const actor = objectiveActorId
        ? playersByPuuid.get(objectiveActorId)
        : undefined;
      const actorAgent = cleanId(actor?.characterId)
        ? agentById.get(cleanId(actor?.characterId))
        : undefined;

      pushMarker({
        id: `${event.kind}-${event.id}-objective`,
        x: objectivePos.x,
        y: objectivePos.y,
        label:
          event.kind === "plant"
            ? `Plant${event.site ? ` en ${event.site}` : ""}`
            : "Defuse",
        actorIcon: actorAgent?.displayIconSmall ?? actorAgent?.displayIcon ?? undefined,
        actorLabel: getPlayerDisplay(actor) || event.actorName,
        team: "neutral",
        kind: "objective",
        isTarget: false,
      });
    }
  }

  return {
    markers,
    hasSnapshot: event.playerLocations.length > 0,
  };
}

function MatchEventMapCanvas({
  mapName,
  mapImageUrl,
  selectedEvent,
  eventMapState,
  mapTransform,
  compact = false,
}: {
  mapName: string;
  mapImageUrl: string;
  selectedEvent: RoundEvent | null;
  eventMapState: EventMapState;
  mapTransform: MapTransform | null;
  compact?: boolean;
}) {
  if (!selectedEvent) {
    return (
      <div className="empty-panel">
        Selecciona un evento de la ronda para ver el mapa.
      </div>
    );
  }

  const killConnection =
    selectedEvent.kind === "kill"
      ? (() => {
          const killerId = cleanId(selectedEvent.killer);
          const killerMarker = eventMapState.markers.find(
            (marker) =>
              marker.id === `killer-${selectedEvent.id}` ||
              marker.id === `snapshot-${selectedEvent.id}-${killerId}`,
          );
          const victimMarker = eventMapState.markers.find(
            (marker) => marker.id === `victim-${selectedEvent.id}`,
          );
          return killerMarker && victimMarker
            ? { killer: killerMarker, victim: victimMarker }
            : null;
        })()
      : null;
  const killConnectionLine = killConnection
    ? (() => {
        const x1 = killConnection.killer.x * 100;
        const y1 = killConnection.killer.y * 100;
        const x2 = killConnection.victim.x * 100;
        const y2 = killConnection.victim.y * 100;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0) return null;

        const markerEdgeOffset = Math.min(2.2, distance / 3);
        const ux = dx / distance;
        const uy = dy / distance;

        return {
          x1: x1 + ux * markerEdgeOffset,
          y1: y1 + uy * markerEdgeOffset,
          x2: x2 - ux * markerEdgeOffset,
          y2: y2 - uy * markerEdgeOffset,
        };
      })()
    : null;

  return (
    <>
      <div className={`match-event-map-header ${compact ? "is-hidden" : ""}`}>
        <strong>
          {roundLabel(selectedEvent.roundNum)} ·{" "}
          {toSecondsLabel(selectedEvent.timeMs)}
        </strong>
        <span>{getEventDescription(selectedEvent)}</span>
      </div>

      {mapImageUrl ? (
        <div className="match-event-map-stage">
          <img src={mapImageUrl} alt={mapName} />
          <div className="match-event-map-overlay">
            {killConnectionLine && (
              <svg
                className="event-map-action-line"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line
                  x1={killConnectionLine.x1}
                  y1={killConnectionLine.y1}
                  x2={killConnectionLine.x2}
                  y2={killConnectionLine.y2}
                />
              </svg>
            )}
            {eventMapState.markers.map((marker) => (
              <div
                key={marker.id}
                className={`event-map-marker event-map-marker--${marker.team} event-map-marker--${marker.kind} ${marker.isTarget ? "is-target" : ""}`}
                style={{
                  left: `${marker.x * 100}%`,
                  top: `${marker.y * 100}%`,
                }}
                title={marker.label}
              >
                {marker.kind === "objective" ? (
                  <>
                    <span>{selectedEvent.kind === "defuse" ? "D" : "P"}</span>
                    {marker.actorIcon || marker.actorLabel ? (
                      <span
                        className="event-map-marker-linked-agent"
                        title={marker.actorLabel}
                      >
                        {marker.actorIcon ? (
                          <img src={marker.actorIcon} alt={marker.actorLabel ?? ""} />
                        ) : (
                          marker.actorLabel?.charAt(0).toUpperCase()
                        )}
                      </span>
                    ) : null}
                  </>
                ) : marker.icon ? (
                  <>
                    <img src={marker.icon} alt={marker.label} />
                    {marker.weaponIcon || marker.weaponLabel ? (
                      <span
                        className="event-map-marker-weapon-badge"
                        title={marker.weaponLabel}
                      >
                        {marker.weaponIcon ? (
                          <img src={marker.weaponIcon} alt={marker.weaponLabel ?? ""} />
                        ) : (
                          marker.weaponLabel?.charAt(0).toUpperCase()
                        )}
                      </span>
                    ) : null}
                    {marker.deathIcon ? (
                      <span
                        className="event-map-marker-death-badge"
                        title="Jugador eliminado"
                      >
                        {marker.deathIcon}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span>{marker.label.charAt(0).toUpperCase()}</span>
                    {marker.deathIcon ? (
                      <span
                        className="event-map-marker-death-badge"
                        title="Jugador eliminado"
                      >
                        {marker.deathIcon}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-chart">No hay imagen de mapa disponible.</div>
      )}

      {!compact && !mapTransform && (
        <p className="match-event-map-note">
          Este mapa no tiene transformación de coordenadas disponible.
        </p>
      )}

      {!compact && mapTransform && eventMapState.markers.length === 0 && (
        <p className="match-event-map-note">
          No hay posiciones válidas para este evento en el dataset.
        </p>
      )}

      {!compact &&
        mapTransform &&
        eventMapState.markers.length > 0 &&
        !eventMapState.hasSnapshot && (
          <p className="match-event-map-note">
            Se muestra solo la posición del evento porque no hay snapshot
            completo de jugadores.
          </p>
        )}

      <div className={`match-event-map-legend ${compact ? "is-hidden" : ""}`}>
        <span>
          <i className="dot ally" /> Aliado
        </span>
        <span>
          <i className="dot enemy" /> Enemigo
        </span>
        <span>
          <i className="dot neutral" /> Objetivo
        </span>
        <span>
          <i className="dot target" /> Posición del jugador
        </span>
      </div>
    </>
  );
}

export default function MatchDetailModal({
  matchId,
  playerId,
  agentNameMap,
  onClose,
}: Props) {
  const { data: matchData, isLoading: matchLoading } = useMatchById(matchId);
  const { data: agentsData, isLoading: agentsLoading } = useAgentes();
  const { data: weaponsData, isLoading: weaponsLoading } = useArmas();
  const { data: mapsData, isLoading: mapsLoading } = useMapasGeo();
  const { data: tiersData, isLoading: tiersLoading } = useCompetitiveTiers();

  const [selectedPlayerState, setSelectedPlayerState] = useState(() => ({
    matchId,
    playerId,
    selectedPlayerId: playerId,
  }));
  const selectedPlayerId =
    selectedPlayerState.matchId === matchId &&
    selectedPlayerState.playerId === playerId
      ? selectedPlayerState.selectedPlayerId
      : playerId;
  const [selectedRoundNum, setSelectedRoundNum] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilterKey>("all");
  const [activeSectionState, setActiveSectionState] = useState(() => ({
    matchId,
    selectedPlayerId: playerId,
    section: "summary" as MatchDetailSection,
  }));
  const activeSection =
    activeSectionState.matchId === matchId &&
    activeSectionState.selectedPlayerId === selectedPlayerId
      ? activeSectionState.section
      : "summary";
  const setActiveSection = (section: MatchDetailSection) => {
    setActiveSectionState({
      matchId,
      selectedPlayerId,
      section,
    });
  };
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playbackEvents, setPlaybackEvents] = useState<RoundEvent[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackTitle, setPlaybackTitle] = useState("");

  const loading =
    matchLoading ||
    agentsLoading ||
    weaponsLoading ||
    mapsLoading ||
    tiersLoading;

  const currentMatch = (matchData as RawMatchDetail | null) ?? null;
  const agents = useMemo(
    () => normalizeArrayResponse<AgentContent>(agentsData),
    [agentsData],
  );
  const weapons = useMemo(
    () => normalizeArrayResponse<Arma>(weaponsData),
    [weaponsData],
  );
  const mapsGeo = useMemo(
    () => normalizeArrayResponse<MapGeoContent>(mapsData),
    [mapsData],
  );
  const competitiveTiers = useMemo(
    () => normalizeArrayResponse<CompetitiveTierContent>(tiersData),
    [tiersData],
  );

  const players = useMemo(() => currentMatch?.players ?? [], [currentMatch]);

  const playersByPuuid = useMemo(() => {
    const map = new Map<string, RawPlayer>();
    for (const player of players) {
      const puuid = cleanId(player.puuid);
      if (puuid) map.set(puuid, player);
    }
    return map;
  }, [players]);

  const playersByTeam = useMemo(() => {
    const map = new Map<string, RawPlayer[]>();
    for (const player of players) {
      const teamId = cleanId(player.teamId) || "Sin equipo";
      const current = map.get(teamId) ?? [];
      current.push(player);
      map.set(teamId, current);
    }
    return [...map.entries()].sort(([teamA], [teamB]) =>
      teamA.localeCompare(teamB),
    );
  }, [players]);

  const teamByPuuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of players) {
      const puuid = cleanId(player.puuid);
      const teamId = cleanId(player.teamId);
      if (puuid && teamId) {
        map.set(puuid, teamId);
      }
    }
    return map;
  }, [players]);

  const agentById = useMemo(() => {
    const map = new Map<string, AgentContent>();
    for (const agent of agents) {
      const id = cleanId(agent.uuid ?? agent.id);
      if (id) {
        map.set(id, agent);
      }
    }
    return map;
  }, [agents]);

  const mapById = useMemo(() => {
    const map = new Map<string, MapGeoContent>();
    for (const mapEntry of mapsGeo) {
      const id = cleanId(mapEntry.uuid);
      if (id) map.set(id, mapEntry);
    }
    return map;
  }, [mapsGeo]);

  const weaponById = useMemo(() => {
    const map = new Map<string, WeaponCatalogEntry>();
    for (const weapon of weapons) {
      const weaponId = getWeaponIdFromIcon(weapon.displayIcon);
      const displayName =
        (weapon.displayName ?? "").trim() || "Arma desconocida";
      if (!weaponId) continue;

      map.set(weaponId, {
        id: weaponId,
        displayName,
        displayIcon: weapon.displayIcon ?? null,
      });
    }
    return map;
  }, [weapons]);

  const tierByNumber = useMemo(() => {
    const map = new Map<number, CompetitiveTierContent>();
    for (const tier of competitiveTiers) {
      const numericTier = Number(tier.tier);
      if (!Number.isFinite(numericTier)) continue;
      map.set(numericTier, tier);
    }
    return map;
  }, [competitiveTiers]);

  const mvp = useMemo(
    () => (currentMatch ? getMvp(currentMatch) : null),
    [currentMatch],
  );

  const playerInfo = useMemo(() => {
    return playersByPuuid.get(selectedPlayerId) ?? null;
  }, [playersByPuuid, selectedPlayerId]);

  const playerTeam = cleanId(playerInfo?.teamId);
  const {
    name: playerAgentName,
    icon: playerAgentIcon,
  } = getAgentMeta(playerInfo, agentById, agentNameMap);

  const mapId = cleanId(currentMatch?.matchInfo?.mapId);
  const mapMeta = mapId ? (mapById.get(mapId) ?? null) : null;
  const mapName = (mapMeta?.displayName ?? mapId) || "Mapa desconocido";
  const mapImageUrl =
    mapMeta?.displayIcon?.trim() ||
    (mapId ? `/content/maps/${mapId}/displayIcon.png` : "");
  const mapTransform = useMemo(() => toMapTransform(mapMeta), [mapMeta]);

  const playerTier = playerInfo?.competitiveTier;
  const tierAsset =
    typeof playerTier === "number" ? tierByNumber.get(playerTier) : undefined;
  const playerRankName = getRankNameFromTier(playerTier ?? null);
  const playerRankIcon = normalizeCompetitiveTierIconPath(
    tierAsset?.smallIcon ??
      tierAsset?.largeIcon ??
      playerInfo?.competitiveTierImage ??
      null,
  );

  const matchAnalysis = useMemo<MatchAnalysis | null>(() => {
    if (!currentMatch || !playerInfo || !playerTeam) return null;

    const roundsRaw = currentMatch.roundResults ?? [];
    const totalRounds = roundsRaw.length;

    let totalHeadshots = 0;
    let totalBodyshots = 0;
    let totalLegshots = 0;
    let totalDamage = 0;
    let openingWon = 0;
    let openingLost = 0;
    let tradeKills = 0;

    const rounds: RoundSummary[] = [];
    const playerKillEvents: KillRoundEvent[] = [];

    for (let roundIndex = 0; roundIndex < roundsRaw.length; roundIndex += 1) {
      const round = roundsRaw[roundIndex];
      const roundNum = Number.isFinite(round.roundNum)
        ? Number(round.roundNum)
        : roundIndex;

      const side = determineRoundSide(playerTeam, roundNum);
      const didWin = cleanId(round.winningTeam) === playerTeam;

      const playerRoundStats = (round.playerStats ?? []).find(
        (stat) => cleanId(stat.puuid) === selectedPlayerId,
      );

      const playerScore = toNumber(playerRoundStats?.score);
      const playerSpent = toNumber(playerRoundStats?.economy?.spent);
      const playerLoadout = toNumber(playerRoundStats?.economy?.loadoutValue);

      const playerKills = (playerRoundStats?.kills ?? []).length;

      let playerRoundDamage = 0;
      for (const damageEntry of playerRoundStats?.damage ?? []) {
        playerRoundDamage += toNumber(damageEntry.damage);
        totalHeadshots += toNumber(damageEntry.headshots);
        totalBodyshots += toNumber(damageEntry.bodyshots);
        totalLegshots += toNumber(damageEntry.legshots);
      }
      totalDamage += playerRoundDamage;

      const timelineKills: Array<{ kill: RawKillEvent; ownerPuuid: string }> =
        [];
      for (const stat of round.playerStats ?? []) {
        const ownerPuuid = cleanId(stat.puuid);
        for (const kill of stat.kills ?? []) {
          timelineKills.push({ kill, ownerPuuid });
        }
      }

      timelineKills.sort(
        (a, b) =>
          toNumber(a.kill.timeSinceRoundStartMillis) -
          toNumber(b.kill.timeSinceRoundStartMillis),
      );

      const firstKill = timelineKills[0]?.kill;

      let playerDeaths = 0;
      let playerAssists = 0;
      const roundEvents: RoundEvent[] = [];

      for (
        let killIndex = 0;
        killIndex < timelineKills.length;
        killIndex += 1
      ) {
        const { kill, ownerPuuid } = timelineKills[killIndex];
        const killerId = cleanId(kill.killer) || ownerPuuid;
        const victimId = cleanId(kill.victim);

        if (victimId === selectedPlayerId) {
          playerDeaths += 1;
        }

        const assistants = parseAssistants(kill.assistants);
        if (
          killerId !== selectedPlayerId &&
          assistants.includes(selectedPlayerId)
        ) {
          playerAssists += 1;
        }

        const timeMs = toNumber(kill.timeSinceRoundStartMillis);
        const killer = killerId ? playersByPuuid.get(killerId) : undefined;
        const victim = victimId ? playersByPuuid.get(victimId) : undefined;

        const killerAgentId = cleanId(killer?.characterId);
        const victimAgentId = cleanId(victim?.characterId);

        const killerAgent = killerAgentId
          ? agentById.get(killerAgentId)
          : undefined;
        const victimAgent = victimAgentId
          ? agentById.get(victimAgentId)
          : undefined;

        const damageType = String(
          kill.finishingDamage?.damageType ?? "",
        ).trim();
        const damageItem = cleanId(
          kill.finishingDamage?.damageItem ?? kill.finishingDamage?.item,
        );
        const weaponData = damageItem ? weaponById.get(damageItem) : undefined;

        const weaponName =
          damageType && damageType.toLowerCase() !== "weapon"
            ? damageType
            : (weaponData?.displayName ?? "Arma desconocida");

        const weaponIcon =
          damageType.toLowerCase() === "weapon"
            ? (weaponData?.displayIcon ?? null)
            : null;

        const isPlayerKill = killerId === selectedPlayerId;
        const isPlayerDeath = victimId === selectedPlayerId;
        const isOpening = Boolean(
          firstKill && firstKill === kill && (isPlayerKill || isPlayerDeath),
        );

        if (isOpening) {
          if (isPlayerKill) openingWon += 1;
          if (isPlayerDeath) openingLost += 1;
        }

        let isTrade = false;
        if (isPlayerKill && victimId) {
          for (let back = killIndex - 1; back >= 0; back -= 1) {
            const previous = timelineKills[back].kill;
            const previousTime = toNumber(previous.timeSinceRoundStartMillis);
            if (timeMs - previousTime > 5000) break;

            const previousVictim = cleanId(previous.victim);
            const previousKiller = cleanId(previous.killer);
            if (!previousVictim || !previousKiller) continue;

            if (
              teamByPuuid.get(previousVictim) === playerTeam &&
              previousKiller === victimId
            ) {
              isTrade = true;
              tradeKills += 1;
              break;
            }
          }
        }

        const event: KillRoundEvent = {
          id: `kill-${roundNum}-${killIndex}-${killerId}-${victimId}-${timeMs}`,
          kind: "kill",
          roundNum,
          timeMs,
          killer: killerId,
          victim: victimId,
          killerName: getPlayerDisplay(killer),
          victimName: getPlayerDisplay(victim),
          killerIcon:
            killerAgent?.displayIconSmall ??
            killerAgent?.displayIcon ??
            undefined,
          victimIcon:
            victimAgent?.displayIconSmall ??
            victimAgent?.displayIcon ??
            undefined,
          weaponId: damageItem || undefined,
          weaponName,
          weaponIcon,
          damageType: damageType || undefined,
          playerLocations: Array.isArray(kill.playerLocations)
            ? kill.playerLocations
            : [],
          killerLocation: kill.killerLocation,
          victimLocation: kill.victimLocation,
          isPlayerKill,
          isPlayerDeath,
          isOpening,
          isTrade,
        };

        roundEvents.push(event);
        if (isPlayerKill) playerKillEvents.push(event);
      }

      const planterId = cleanId(round.bombPlanter);
      if (planterId) {
        roundEvents.push({
          id: `plant-${roundNum}-${planterId}`,
          kind: "plant",
          roundNum,
          timeMs: toNumber(round.plantRoundTime),
          actor: planterId,
          actorName: getPlayerDisplay(playersByPuuid.get(planterId)),
          site: cleanSite(round.plantSite),
          location: round.plantLocation,
          playerLocations: Array.isArray(round.plantPlayerLocations)
            ? round.plantPlayerLocations
            : [],
        });
      }

      const defuserId = cleanId(round.bombDefuser);
      if (defuserId) {
        roundEvents.push({
          id: `defuse-${roundNum}-${defuserId}`,
          kind: "defuse",
          roundNum,
          timeMs: toNumber(round.defuseRoundTime),
          actor: defuserId,
          actorName: getPlayerDisplay(playersByPuuid.get(defuserId)),
          site: cleanSite(round.plantSite),
          location: round.defuseLocation,
          playerLocations: Array.isArray(round.defusePlayerLocations)
            ? round.defusePlayerLocations
            : [],
        });
      }

      roundEvents.sort((a, b) => a.timeMs - b.timeMs);

      rounds.push({
        roundNum,
        side,
        didWin,
        winningTeam: cleanId(round.winningTeam),
        roundResult: cleanId(round.roundResult) || "Sin detalle",
        playerKills,
        playerDeaths,
        playerAssists,
        playerScore,
        playerSpent,
        playerLoadout,
        playerDamage: playerRoundDamage,
        hadPlant: Boolean(planterId),
        hadDefuse: Boolean(defuserId),
        events: roundEvents,
      });
    }

    const kills =
      toNumber(playerInfo.stats?.kills) ||
      rounds.reduce((sum, round) => sum + round.playerKills, 0);
    const deaths =
      toNumber(playerInfo.stats?.deaths) ||
      rounds.reduce((sum, round) => sum + round.playerDeaths, 0);
    const assists =
      toNumber(playerInfo.stats?.assists) ||
      rounds.reduce((sum, round) => sum + round.playerAssists, 0);
    const score =
      toNumber(playerInfo.stats?.score) ||
      rounds.reduce((sum, round) => sum + round.playerScore, 0);

    const kd = safeDivide(kills, Math.max(deaths, 1));
    const kda = safeDivide(kills + assists, Math.max(deaths, 1));
    const killsPerRound = safeDivide(kills, Math.max(totalRounds, 1));
    const adr = safeDivide(totalDamage, Math.max(totalRounds, 1));
    const acs = safeDivide(score, Math.max(totalRounds, 1));

    const roundsWon = rounds.filter((round) => round.didWin).length;
    const roundsWonWithImpact = rounds.filter(
      (round) =>
        round.didWin &&
        (round.playerKills + round.playerAssists > 0 || round.playerScore > 0),
    ).length;
    const winRoundParticipationPct =
      safeDivide(roundsWonWithImpact, Math.max(roundsWon, 1)) * 100;

    const survivalRounds = rounds.filter(
      (round) => round.playerDeaths === 0,
    ).length;
    const survivalPct =
      safeDivide(survivalRounds, Math.max(totalRounds, 1)) * 100;
    const roundsWithKills = rounds.filter(
      (round) => round.playerKills > 0,
    ).length;
    const kastRounds = rounds.filter(
      (round) =>
        round.playerKills > 0 ||
        round.playerAssists > 0 ||
        round.playerDeaths === 0 ||
        round.events.some(
          (event) => event.kind === "kill" && event.isTrade,
        ),
    ).length;
    const kastPct = safeDivide(kastRounds, Math.max(totalRounds, 1)) * 100;
    const multikillRounds = rounds.filter(
      (round) => round.playerKills >= 2,
    ).length;
    const maxKillsInRound = rounds.reduce(
      (maxKills, round) => Math.max(maxKills, round.playerKills),
      0,
    );

    const totalHits = totalHeadshots + totalBodyshots + totalLegshots;
    const headshotPct =
      safeDivide(totalHeadshots, Math.max(totalHits, 1)) * 100;

    const weaponTotals = new Map<string, WeaponSummary>();
    for (const event of playerKillEvents) {
      const key = event.weaponId || event.weaponName;
      const existing = weaponTotals.get(key);
      if (existing) {
        existing.kills += 1;
      } else {
        weaponTotals.set(key, {
          id: key,
          name: event.weaponName,
          icon: event.weaponIcon,
          kills: 1,
        });
      }
    }

    const topWeapons = [...weaponTotals.values()]
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 3);

    const bestRound =
      rounds.length > 0
        ? [...rounds].sort((a, b) => {
            const impactA =
              a.playerScore +
              a.playerKills * 180 +
              a.playerAssists * 60 -
              a.playerDeaths * 70 +
              (a.didWin ? 80 : 0);
            const impactB =
              b.playerScore +
              b.playerKills * 180 +
              b.playerAssists * 60 -
              b.playerDeaths * 70 +
              (b.didWin ? 80 : 0);
            return impactB - impactA;
          })[0]
        : null;

    const sideAccumulator: Record<
      SideKey,
      Omit<
        SideSummary,
        | "key"
        | "label"
        | "kd"
        | "kda"
        | "winRate"
        | "killsPerRound"
        | "avgSpent"
        | "avgLoadout"
      >
    > = {
      attack: {
        rounds: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        spent: 0,
        loadout: 0,
      },
      defense: {
        rounds: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        spent: 0,
        loadout: 0,
      },
    };

    for (const round of rounds) {
      const target = sideAccumulator[round.side];
      target.rounds += 1;
      target.wins += round.didWin ? 1 : 0;
      target.kills += round.playerKills;
      target.deaths += round.playerDeaths;
      target.assists += round.playerAssists;
      target.score += round.playerScore;
      target.spent += round.playerSpent;
      target.loadout += round.playerLoadout;
    }

    const sideSummary: SideSummary[] = (
      [
        ["attack", "Ataque"],
        ["defense", "Defensa"],
      ] as const
    ).map(([key, label]) => {
      const side = sideAccumulator[key];
      return {
        key,
        label,
        ...side,
        kd: safeDivide(side.kills, Math.max(side.deaths, 1)),
        kda: safeDivide(side.kills + side.assists, Math.max(side.deaths, 1)),
        winRate: safeDivide(side.wins, Math.max(side.rounds, 1)) * 100,
        killsPerRound: safeDivide(side.kills, Math.max(side.rounds, 1)),
        avgSpent: safeDivide(side.spent, Math.max(side.rounds, 1)),
        avgLoadout: safeDivide(side.loadout, Math.max(side.rounds, 1)),
      };
    });

    const totalSpent = rounds.reduce(
      (sum, round) => sum + round.playerSpent,
      0,
    );
    const avgSpent = safeDivide(totalSpent, Math.max(totalRounds, 1));
    const avgLoadout = safeDivide(
      rounds.reduce((sum, round) => sum + round.playerLoadout, 0),
      Math.max(totalRounds, 1),
    );

    const ecoRounds = rounds.filter(
      (round) => round.playerSpent <= 2000,
    ).length;
    const ecoWins = rounds.filter(
      (round) => round.playerSpent <= 2000 && round.didWin,
    ).length;
    const fullBuyRounds = rounds.filter(
      (round) => round.playerSpent >= 3900,
    ).length;
    const fullBuyWins = rounds.filter(
      (round) => round.playerSpent >= 3900 && round.didWin,
    ).length;

    const sideBest = [...sideSummary]
      .sort((a, b) => b.winRate - a.winRate || b.kda - a.kda)
      .find((entry) => entry.rounds > 0);

    const insights: string[] = [];
    if (sideBest) {
      insights.push(
        `Mejor lado: ${sideBest.label} (${formatPercent(sideBest.winRate, 1)} de win rate).`,
      );
    }
    if (topWeapons[0]) {
      insights.push(
        `Arma más efectiva: ${topWeapons[0].name} con ${formatNumber(topWeapons[0].kills)} kills.`,
      );
    }
    if (bestRound) {
      insights.push(
        `Ronda de mayor impacto: ${roundLabel(bestRound.roundNum)} (${bestRound.playerKills}K/${bestRound.playerAssists}A, ${bestRound.playerScore} score).`,
      );
    }
    if (openingWon + openingLost > 0) {
      insights.push(
        `Duelos iniciales: ${openingWon} ganados y ${openingLost} perdidos.`,
      );
    }
    if (tradeKills > 0) {
      insights.push(`Trade kills detectados: ${formatNumber(tradeKills)}.`);
    }

    return {
      rounds,
      totalRounds,
      kills,
      deaths,
      assists,
      score,
      kd,
      kda,
      killsPerRound,
      totalDamage,
      adr,
      acs,
      kastPct,
      headshotPct,
      survivalRounds,
      survivalPct,
      multikillRounds,
      maxKillsInRound,
      roundsWon,
      roundsWonWithImpact,
      winRoundParticipationPct,
      tradeKills,
      openingWon,
      openingLost,
      roundsWithKills,
      topWeapons,
      bestRound,
      sideSummary,
      totalSpent,
      avgSpent,
      avgLoadout,
      ecoRounds,
      ecoWins,
      fullBuyRounds,
      fullBuyWins,
      insights,
    };
  }, [
    currentMatch,
    playerInfo,
    playerTeam,
    selectedPlayerId,
    playersByPuuid,
    teamByPuuid,
    agentById,
    weaponById,
  ]);

  const allRoundEvents = useMemo(
    () => matchAnalysis?.rounds.flatMap((round) => round.events) ?? [],
    [matchAnalysis],
  );

  const selectedRound = useMemo(() => {
    if (!matchAnalysis) return null;
    if (selectedRoundNum === null) return matchAnalysis.rounds[0] ?? null;
    return (
      matchAnalysis.rounds.find((round) => round.roundNum === selectedRoundNum) ??
      matchAnalysis.rounds[0] ??
      null
    );
  }, [matchAnalysis, selectedRoundNum]);

  const filteredSelectedRoundEvents = useMemo(() => {
    const events = selectedRound?.events ?? [];
    switch (eventFilter) {
      case "kills":
        return events.filter(
          (event) => event.kind === "kill" && event.isPlayerKill,
        );
      case "deaths":
        return events.filter(
          (event) => event.kind === "kill" && event.isPlayerDeath,
        );
      case "opening":
        return events.filter(
          (event) => event.kind === "kill" && event.isOpening,
        );
      case "trade":
        return events.filter(
          (event) => event.kind === "kill" && event.isTrade,
        );
      case "objectives":
        return events.filter(
          (event) => event.kind === "plant" || event.kind === "defuse",
        );
      default:
        return events;
    }
  }, [eventFilter, selectedRound]);

  const sortedAllRoundEvents = useMemo(
    () =>
      [...allRoundEvents].sort(
        (a, b) => a.roundNum - b.roundNum || a.timeMs - b.timeMs,
      ),
    [allRoundEvents],
  );

  const filteredDuelEvents = useMemo(() => {
    switch (eventFilter) {
      case "kills":
        return sortedAllRoundEvents.filter(
          (event) => event.kind === "kill" && event.isPlayerKill,
        );
      case "deaths":
        return sortedAllRoundEvents.filter(
          (event) => event.kind === "kill" && event.isPlayerDeath,
        );
      case "opening":
        return sortedAllRoundEvents.filter(
          (event) => event.kind === "kill" && event.isOpening,
        );
      case "trade":
        return sortedAllRoundEvents.filter(
          (event) => event.kind === "kill" && event.isTrade,
        );
      case "objectives":
        return sortedAllRoundEvents.filter(
          (event) => event.kind === "plant" || event.kind === "defuse",
        );
      default:
        return sortedAllRoundEvents;
    }
  }, [eventFilter, sortedAllRoundEvents]);

  const selectedDuelEvent = useMemo(() => {
    const explicitEvent =
      filteredDuelEvents.find((event) => event.id === selectedEventId) ?? null;
    return explicitEvent ?? filteredDuelEvents[0] ?? null;
  }, [filteredDuelEvents, selectedEventId]);

  const duelEventMapState = useMemo(
    () =>
      buildEventMapState({
        event: selectedDuelEvent,
        mapTransform,
        playersByPuuid,
        playerTeam,
        selectedPlayerId,
        agentById,
      }),
    [
      selectedDuelEvent,
      mapTransform,
      playersByPuuid,
      playerTeam,
      selectedPlayerId,
      agentById,
    ],
  );

  const selectedEvent = useMemo(() => {
    const explicitEvent =
      filteredSelectedRoundEvents.find((event) => event.id === selectedEventId) ??
      null;
    return explicitEvent ?? filteredSelectedRoundEvents[0] ?? null;
  }, [filteredSelectedRoundEvents, selectedEventId]);

  const eventMapState = useMemo(
    () =>
      buildEventMapState({
        event: selectedEvent,
        mapTransform,
        playersByPuuid,
        playerTeam,
        selectedPlayerId,
        agentById,
      }),
    [
      selectedEvent,
      mapTransform,
      playersByPuuid,
      playerTeam,
      selectedPlayerId,
      agentById,
    ],
  );
  const sideBest = useMemo(() => {
    if (!matchAnalysis) return null;
    return [...matchAnalysis.sideSummary]
      .filter((side) => side.rounds > 0)
      .sort((a, b) => b.winRate - a.winRate || b.kda - a.kda)[0];
  }, [matchAnalysis]);

  const scoreState = useMemo(
    () => getTeamScoreState(currentMatch, playerTeam),
    [currentMatch, playerTeam],
  );
  const { resultState } = scoreState;

  const impactLevel = useMemo(() => {
    if (!matchAnalysis) return null;
    if (
      matchAnalysis.kd >= 1.2 ||
      matchAnalysis.winRoundParticipationPct >= 70 ||
      matchAnalysis.killsPerRound >= 0.85
    ) {
      return {
        label: "Impacto alto",
        tone: "high",
        text: "Buen impacto por KD, kills por ronda o participación en rondas ganadas.",
      };
    }
    if (
      matchAnalysis.kd < 0.8 &&
      matchAnalysis.winRoundParticipationPct < 45
    ) {
      return {
        label: "Impacto bajo",
        tone: "low",
        text: "Impacto limitado por bajo KD y poca participación en rondas ganadas.",
      };
    }
    return {
      label: "Impacto medio",
      tone: "medium",
      text: "Aportación estable, con margen para decidir más rondas ganadas.",
    };
  }, [matchAnalysis]);

  const buyTypeSummary = useMemo(() => {
    const empty = { rounds: 0, wins: 0, winRate: 0 };
    if (!matchAnalysis) {
      return {
        eco: empty,
        force: empty,
        fullBuy: empty,
      };
    }

    const summarize = (predicate: (round: RoundSummary) => boolean) => {
      const rounds = matchAnalysis.rounds.filter(predicate);
      const wins = rounds.filter((round) => round.didWin).length;
      return {
        rounds: rounds.length,
        wins,
        winRate: safeDivide(wins, Math.max(rounds.length, 1)) * 100,
      };
    };

    return {
      eco: summarize((round) => round.playerSpent <= 2000),
      force: summarize(
        (round) => round.playerSpent > 2000 && round.playerSpent < 3900,
      ),
      fullBuy: summarize((round) => round.playerSpent >= 3900),
    };
  }, [matchAnalysis]);

  const activeSectionLabel =
    matchDetailSections.find((section) => section.key === activeSection)
      ?.label ?? "Resumen";

  useEffect(() => {
    if (!playbackOpen || !playbackPlaying || playbackEvents.length <= 1) return;
    const interval = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= playbackEvents.length - 1) {
          setPlaybackPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1400);
    return () => window.clearInterval(interval);
  }, [playbackEvents.length, playbackOpen, playbackPlaying]);

  if (!loading && !currentMatch) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel modal-panel-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
          <div className="empty-panel">No se pudo cargar la partida.</div>
        </div>
      </div>
    );
  }

  if (!loading && currentMatch && !playerInfo) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel modal-panel-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
          <div className="empty-panel">
            El jugador objetivo no aparece en esta partida.
          </div>
        </div>
      </div>
    );
  }

  const handleRoundSelect = (round: RoundSummary) => {
    setSelectedRoundNum(round.roundNum);
    setSelectedEventId(round.events[0]?.id ?? null);
    setEventFilter("all");
  };

  const handlePlayerSelect = (nextPlayerId: string) => {
    setSelectedPlayerState({
      matchId,
      playerId,
      selectedPlayerId: nextPlayerId,
    });
    setSelectedRoundNum(null);
    setSelectedEventId(null);
    setEventFilter("all");
    setActiveSection("summary");
    setPlaybackOpen(false);
    setPlaybackPlaying(false);
  };

  const eventFilterOptions: Array<{ key: EventFilterKey; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "kills", label: "Kills del jugador" },
    { key: "deaths", label: "Muertes del jugador" },
    { key: "opening", label: "Opening" },
    { key: "trade", label: "Trade" },
    { key: "objectives", label: "Objetivos" },
  ];

  const renderRoundEventButton = (event: RoundEvent) => {
    const isActive = selectedEvent?.id === event.id;
    const renderActionParticipant = (
      puuid: string | undefined,
      name: string,
      icon?: string,
    ) => {
      const cleanPuuid = cleanId(puuid);
      const participantTeam = cleanPuuid
        ? cleanId(playersByPuuid.get(cleanPuuid)?.teamId)
        : "";
      const tone =
        cleanPuuid === selectedPlayerId
          ? "target"
          : participantTeam && participantTeam === playerTeam
            ? "ally"
            : "enemy";

      return (
        <span className={`match-action-player is-${tone}`}>
          {icon ? (
            <img src={icon} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
          <strong>{name}</strong>
        </span>
      );
    };

    if (event.kind === "kill") {
      return (
        <button
          key={event.id}
          type="button"
          className={`match-round-event-btn ${isActive ? "is-active" : ""}`}
          onClick={() => {
            setSelectedRoundNum(event.roundNum);
            setSelectedEventId(event.id);
          }}
          aria-pressed={isActive}
        >
          <div className="match-round-event-top">
            <span className="match-round-event-time">
              {toSecondsLabel(event.timeMs)}
            </span>
            <span className="match-action-text">
              {renderActionParticipant(
                event.killer,
                event.killerName,
                event.killerIcon,
              )}
              <span>eliminó a</span>
              {renderActionParticipant(
                event.victim,
                event.victimName,
                event.victimIcon,
              )}
            </span>
          </div>

          <div className="match-round-event-meta">
            {event.weaponIcon && (
              <img src={event.weaponIcon} alt={event.weaponName} />
            )}
            <span>{event.weaponName}</span>
            {event.isPlayerKill && <span className="meta-pill">Kill</span>}
            {event.isPlayerDeath && <span className="meta-pill">Muerte</span>}
            {event.isOpening && <span className="meta-pill">Opening</span>}
            {event.isTrade && <span className="meta-pill">Trade</span>}
          </div>
        </button>
      );
    }

    const actorMeta = getAgentMeta(
      event.actor ? playersByPuuid.get(event.actor) : null,
      agentById,
      agentNameMap,
    );

    return (
      <button
        key={event.id}
        type="button"
        className={`match-round-event-btn match-round-event-btn-objective ${isActive ? "is-active" : ""}`}
        onClick={() => {
          setSelectedRoundNum(event.roundNum);
          setSelectedEventId(event.id);
        }}
        aria-pressed={isActive}
      >
        <div className="match-round-event-top">
          <span className="match-round-event-time">
            {toSecondsLabel(event.timeMs)}
          </span>
          {actorMeta.icon &&
            renderActionParticipant(event.actor, event.actorName, actorMeta.icon)}
          <strong>
            {event.kind === "plant" ? "Plant" : "Defuse"}
          </strong>
        </div>
        <div className="match-round-event-meta">
          <span>
            {event.site
              ? `${event.kind === "plant" ? "Spike en" : "Sitio"} ${event.site}`
              : "Evento de objetivo"}
          </span>
        </div>
      </button>
    );
  };

  const openRoundPlayback = (round: RoundSummary) => {
    if (round.events.length === 0) return;
    setPlaybackEvents(round.events);
    setPlaybackIndex(0);
    setPlaybackTitle(`Reproducción de ${roundLabel(round.roundNum)}`);
    setPlaybackPlaying(true);
    setPlaybackOpen(true);
  };

  const openMatchPlayback = () => {
    if (allRoundEvents.length === 0) return;
    setPlaybackEvents(sortedAllRoundEvents);
    setPlaybackIndex(0);
    setPlaybackTitle("Reproducción de partida");
    setPlaybackPlaying(true);
    setPlaybackOpen(true);
  };

  const closePlayback = () => {
    setPlaybackOpen(false);
    setPlaybackPlaying(false);
  };

  const nextPlaybackEvent = () => {
    setPlaybackIndex((current) => {
      if (current >= playbackEvents.length - 1) {
        setPlaybackPlaying(false);
        return current;
      }
      return current + 1;
    });
  };

  const previousPlaybackEvent = () => {
    setPlaybackIndex((current) => Math.max(0, current - 1));
  };

  const restartPlayback = () => {
    setPlaybackIndex(0);
    setPlaybackPlaying(playbackEvents.length > 0);
  };

  const playbackEvent = playbackEvents[playbackIndex] ?? null;
  const playbackMapState = buildEventMapState({
    event: playbackEvent,
    mapTransform,
    playersByPuuid,
    playerTeam,
    selectedPlayerId,
    agentById,
  });

  const renderPlaybackEventButton = (event: RoundEvent, index: number) => {
    const isActive = index === playbackIndex;
    const renderActionParticipant = (
      puuid: string | undefined,
      name: string,
      icon?: string,
    ) => {
      const cleanPuuid = cleanId(puuid);
      const participantTeam = cleanPuuid
        ? cleanId(playersByPuuid.get(cleanPuuid)?.teamId)
        : "";
      const tone =
        cleanPuuid === selectedPlayerId
          ? "target"
          : participantTeam && participantTeam === playerTeam
            ? "ally"
            : "enemy";

      return (
        <span className={`match-action-player is-${tone}`}>
          {icon ? (
            <img src={icon} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
          <strong>{name}</strong>
        </span>
      );
    };
    const actorMeta =
      event.kind === "kill"
        ? null
        : getAgentMeta(
            event.actor ? playersByPuuid.get(event.actor) : null,
            agentById,
            agentNameMap,
          );

    return (
      <button
        key={event.id}
        type="button"
        className={`match-playback-action ${isActive ? "is-active" : ""}`}
        onClick={() => setPlaybackIndex(index)}
        aria-current={isActive ? "true" : undefined}
      >
        <span className="match-round-event-time">
          {roundLabel(event.roundNum)} · {toSecondsLabel(event.timeMs)}
        </span>
        <span className="match-action-text">
          {event.kind === "kill" ? (
            <>
              {renderActionParticipant(
                event.killer,
                event.killerName,
                event.killerIcon,
              )}
              <span>eliminó a</span>
              {renderActionParticipant(
                event.victim,
                event.victimName,
                event.victimIcon,
              )}
            </>
          ) : (
            <>
              {actorMeta?.icon &&
                renderActionParticipant(event.actor, event.actorName, actorMeta.icon)}
              <span>{event.kind === "plant" ? "Plant" : "Defuse"}</span>
            </>
          )}
        </span>
      </button>
    );
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {loading || !matchAnalysis ? (
          <div
            className="match-detail-loading-state"
            role="status"
            aria-live="polite"
          >
            <div className="loading-card">
              <div className="loading-spinner" />
              <h2>Cargando partida</h2>
            </div>
          </div>
        ) : (
          <div className="match-detail-shell">
            <section className="match-teams-strip" aria-label="Jugadores de la partida">
              {playersByTeam.map(([teamId, teamPlayers], teamIndex) => (
                <div key={teamId} className="match-team-roster">
                  {teamPlayers.map((player) => {
                    const puuid = cleanId(player.puuid);
                    const agent = getAgentMeta(player, agentById, agentNameMap);
                    const isSelected = puuid === selectedPlayerId;
                    const playerName = getPlayerShortDisplay(player);
                    return (
                      <button
                        key={puuid || `${teamId}-${playerName}`}
                        type="button"
                        className={`match-team-player-button ${isSelected ? "is-selected" : ""}`}
                        onClick={() => puuid && handlePlayerSelect(puuid)}
                        aria-label={`Ver partida desde la perspectiva de ${playerName} con ${agent.name}`}
                        aria-pressed={isSelected}
                      >
                        {agent.icon ? (
                          <img src={agent.icon} alt="" />
                        ) : (
                          <span className="match-team-agent-fallback">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{playerName}</span>
                      </button>
                    );
                  })}
                  {teamIndex === 0 && playersByTeam.length > 1 && (
                    <span className="match-team-vs">VS</span>
                  )}
                </div>
              ))}
            </section>

            <header className="match-detail-hero">
              <div className="match-detail-hero-copy">
                <span className="stats-eyebrow">Detalle de partida</span>

                <div className="match-detail-title-row">
                  {playerAgentIcon && (
                    <img
                      src={playerAgentIcon}
                      alt={playerAgentName}
                      className="match-detail-player-agent"
                    />
                  )}
                  <h2 className="stats-title modal-title-small">{mapName}</h2>
                </div>

                <p className="stats-subtitle">
                  {getPlayerDisplay(playerInfo)} · {playerAgentName}
                </p>

                <div className="match-detail-meta-row">
                  <span
                    className={`meta-pill match-pill-${resultState}`}
                  >
                    {resultState === "draw"
                      ? "Empate"
                      : resultState === "win"
                        ? "Victoria"
                        : "Derrota"}
                  </span>
                  <span className="meta-pill">
                    {matchAnalysis.totalRounds} rondas
                  </span>
                  <span className="meta-pill">
                    {cleanId(currentMatch?.matchInfo?.queueId) || "Cola desconocida"}
                  </span>
                  <span className="meta-pill">
                    {cleanId(currentMatch?.matchInfo?.gameMode) || "Modo desconocido"}
                  </span>
                  <span className="meta-pill">
                    {toGameDurationLabel(currentMatch?.matchInfo?.gameLengthMillis) ||
                      "Duración no disponible"}
                  </span>
                  <span className="meta-pill">
                    {formatDateTime(currentMatch?.matchInfo?.gameStartMillis)}
                  </span>
                </div>
              </div>

              <div className={`match-result-card result-${resultState}`}>
                <div className="match-score-main">
                  <span className="match-score-label">Resultado</span>
                  <strong className="match-score-value">
                    {scoreState.selectedTeamRounds} -{" "}
                    {scoreState.opponentTeamRounds}
                  </strong>
                </div>

                <div className="match-score-split">
                  <div>
                    <span>K / D / A</span>
                    <strong>
                      {matchAnalysis.kills}/{matchAnalysis.deaths}/
                      {matchAnalysis.assists}
                    </strong>
                  </div>
                  <div>
                    <span>KD</span>
                    <strong>{formatNumber(matchAnalysis.kd, 2)}</strong>
                  </div>
                  <div>
                    <span>KDA</span>
                    <strong>{formatNumber(matchAnalysis.kda, 2)}</strong>
                  </div>
                  <div>
                    <span>Score</span>
                    <strong>{formatNumber(matchAnalysis.score)}</strong>
                  </div>
                  <div>
                    <span>ACS</span>
                    <strong>{formatNumber(matchAnalysis.acs)}</strong>
                  </div>
                  <div>
                    <span>ADR</span>
                    <strong>{formatNumber(matchAnalysis.adr, 1)}</strong>
                  </div>
                  <div>
                    <span>Supervivencia</span>
                    <strong>{formatPercent(matchAnalysis.survivalPct, 1)}</strong>
                  </div>
                  <div>
                    <span>Impacto en wins</span>
                    <strong>
                      {formatPercent(matchAnalysis.winRoundParticipationPct, 1)}
                    </strong>
                  </div>
                </div>

                <div className="match-rank-line">
                  {playerRankIcon && (
                    <img
                      src={playerRankIcon}
                      alt={playerRankName}
                      className="match-rank-icon-inline"
                    />
                  )}
                  <span>{playerRankName}</span>
                  <span>MVP partida: {getPlayerDisplay(mvp)}</span>
                  <button
                    type="button"
                    className="match-play-button"
                    onClick={openMatchPlayback}
                    disabled={allRoundEvents.length === 0}
                    title={
                      allRoundEvents.length === 0
                        ? "Sin eventos reproducibles"
                        : "Reproducir partida"
                    }
                  >
                    Reproducir partida
                  </button>
                </div>
              </div>
            </header>

            <nav
              className="match-detail-tabs"
              aria-label="Secciones del detalle de partida"
            >
              {matchDetailSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={activeSection === section.key ? "is-active" : ""}
                  onClick={() => setActiveSection(section.key)}
                  aria-pressed={activeSection === section.key}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            <div className="match-detail-section-body">
              {activeSection === "summary" && (
                <section
                  className="match-summary-section"
                  role="region"
                  aria-label={activeSectionLabel}
                >
                  {impactLevel && (
                    <div className="match-summary-hero-card">
                      <span className={`impact-level-badge is-${impactLevel.tone}`}>
                        {impactLevel.label}
                      </span>
                      <p>{impactLevel.text}</p>
                      <div className="match-summary-actions">
                        {matchAnalysis.bestRound && (
                          <button
                            type="button"
                            onClick={() => {
                              handleRoundSelect(matchAnalysis.bestRound!);
                              setActiveSection("rounds");
                            }}
                          >
                            Ver ronda clave
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openMatchPlayback}
                          disabled={allRoundEvents.length === 0}
                        >
                          Reproducir partida
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="match-summary-grid">
                    <article>
                      <span>Ronda clave</span>
                      <strong>
                        {matchAnalysis.bestRound
                          ? `${roundLabel(matchAnalysis.bestRound.roundNum)} · ${matchAnalysis.bestRound.playerKills}K`
                          : "Sin datos"}
                      </strong>
                    </article>
                    <article>
                      <span>Mejor lado</span>
                      <strong>
                        {sideBest
                          ? `${sideBest.label} · ${formatPercent(sideBest.winRate, 1)}`
                          : "Sin datos"}
                      </strong>
                    </article>
                    <article>
                      <span>Arma principal</span>
                      <strong>
                        {matchAnalysis.topWeapons[0]
                          ? `${matchAnalysis.topWeapons[0].name} · ${matchAnalysis.topWeapons[0].kills}K`
                          : "Sin kills"}
                      </strong>
                    </article>
                    <article>
                      <span>Duelos iniciales</span>
                      <strong>
                        {matchAnalysis.openingWon} ganados /{" "}
                        {matchAnalysis.openingLost} perdidos
                      </strong>
                    </article>
                    <article>
                      <span>Trade kills</span>
                      <strong>{formatNumber(matchAnalysis.tradeKills)}</strong>
                    </article>
                    <article>
                      <span>Economía</span>
                      <strong>
                        Eco {matchAnalysis.ecoWins}/{matchAnalysis.ecoRounds} · Full{" "}
                        {matchAnalysis.fullBuyWins}/{matchAnalysis.fullBuyRounds}
                      </strong>
                    </article>
                    <article>
                      <span>KAST aprox.</span>
                      <strong>{formatPercent(matchAnalysis.kastPct, 1)}</strong>
                    </article>
                    <article>
                      <span>Multikills</span>
                      <strong>
                        {matchAnalysis.multikillRounds} rondas · máximo{" "}
                        {matchAnalysis.maxKillsInRound}K
                      </strong>
                    </article>
                  </div>
                </section>
              )}

            {activeSection === "rounds" && (
            <section
              className="match-round-strip"
              role="region"
              aria-label={activeSectionLabel}
            >
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Timeline de rondas</h3>
                  <p className="panel-subtitle">
                    Secuencia principal de rondas. El detalle se abre justo debajo.
                  </p>
                </div>
              </div>

              <div className="match-round-strip-track">
                {matchAnalysis.rounds.map((round) => {
                  const isOpen = selectedRound?.roundNum === round.roundNum;
                  return (
                    <button
                      key={`strip-${round.roundNum}`}
                      type="button"
                      className={`match-round-chip ${round.didWin ? "is-win" : "is-loss"} ${isOpen ? "is-open" : ""}`}
                      onClick={() => handleRoundSelect(round)}
                      aria-label={`Abrir ronda ${round.roundNum + 1}, ${round.didWin ? "ganada" : "perdida"}, ${round.playerKills} kills`}
                      aria-current={isOpen ? "true" : undefined}
                      aria-pressed={isOpen}
                    >
                      <span>{round.roundNum + 1}</span>
                      {round.playerKills > 0 && (
                        <small>{round.playerKills}K</small>
                      )}
                      {(round.hadPlant || round.hadDefuse) && (
                        <em>{round.hadDefuse ? "D" : "P"}</em>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedRound && (
                <article className="match-selected-round-detail">
                  <div className="match-selected-round-header">
                    <div>
                      <h4>{roundLabel(selectedRound.roundNum)}</h4>
                      <p>
                        {selectedRound.side === "attack" ? "Ataque" : "Defensa"} ·{" "}
                        {selectedRound.roundResult}
                      </p>
                    </div>
                    <div className="round-trigger-summary">
                      <button
                        type="button"
                        className="match-play-button"
                        onClick={() => openRoundPlayback(selectedRound)}
                        disabled={selectedRound.events.length === 0}
                        title={
                          selectedRound.events.length === 0
                            ? "Sin eventos reproducibles"
                            : "Reproducir ronda"
                        }
                      >
                        Reproducir ronda
                      </button>
                      <span
                        className={
                          selectedRound.didWin ? "text-positive" : "text-negative"
                        }
                      >
                        {selectedRound.didWin ? "Ganada" : "Perdida"}
                      </span>
                      <span>{selectedRound.playerKills}K</span>
                      <span>{selectedRound.playerDeaths}D</span>
                      <span>{selectedRound.playerAssists}A</span>
                      {selectedRound.hadPlant && <em>Plant</em>}
                      {selectedRound.hadDefuse && <em>Defuse</em>}
                    </div>
                  </div>

                  <div className="match-selected-round-layout">
                    <div className="match-selected-round-actions">
                    <div className="match-round-player-row">
                      <span>
                        Score <strong>{formatNumber(selectedRound.playerScore)}</strong>
                      </span>
                      <span>
                        Daño <strong>{formatNumber(selectedRound.playerDamage)}</strong>
                      </span>
                      <span>
                        Gasto <strong>{formatNumber(selectedRound.playerSpent)}</strong>
                      </span>
                      <span>
                        Loadout{" "}
                        <strong>{formatNumber(selectedRound.playerLoadout)}</strong>
                      </span>
                    </div>

                    <div className="match-event-filters" aria-label="Filtros de eventos">
                      {eventFilterOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={eventFilter === option.key ? "is-active" : ""}
                          onClick={() => setEventFilter(option.key)}
                          aria-pressed={eventFilter === option.key}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="match-round-events">
                      {filteredSelectedRoundEvents.length === 0 ? (
                        <div className="empty-chart">
                          No hay eventos para este filtro en la ronda seleccionada.
                        </div>
                      ) : (
                        filteredSelectedRoundEvents.map(renderRoundEventButton)
                      )}
                    </div>
                    </div>
                    <aside className="match-selected-round-map">
                      <MatchEventMapCanvas
                        mapName={mapName}
                        mapImageUrl={mapImageUrl}
                        selectedEvent={selectedEvent}
                        eventMapState={eventMapState}
                        mapTransform={mapTransform}
                      />
                    </aside>
                  </div>
                </article>
              )}
            </section>
            )}

            {activeSection === "duels" && (
              <section
                className="match-duels-section"
                role="region"
                aria-label={activeSectionLabel}
              >
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Duelos y combate</h3>
                    <p className="panel-subtitle">
                      Eventos de combate de toda la partida desde esta perspectiva.
                    </p>
                  </div>
                </div>

                <div className="match-duel-stats-grid">
                  <article>
                    <span>Opening</span>
                    <strong>
                      {matchAnalysis.openingWon}W / {matchAnalysis.openingLost}L
                    </strong>
                  </article>
                  <article>
                    <span>Kills</span>
                    <strong>{matchAnalysis.kills}</strong>
                  </article>
                  <article>
                    <span>Muertes</span>
                    <strong>{matchAnalysis.deaths}</strong>
                  </article>
                  <article>
                    <span>Trade kills</span>
                    <strong>{matchAnalysis.tradeKills}</strong>
                  </article>
                  <article>
                    <span>Rondas con kill</span>
                    <strong>
                      {matchAnalysis.roundsWithKills}/{matchAnalysis.totalRounds}
                    </strong>
                  </article>
                  <article>
                    <span>Supervivencia</span>
                    <strong>{formatPercent(matchAnalysis.survivalPct, 1)}</strong>
                  </article>
                </div>

                <div className="match-event-filters" aria-label="Filtros de duelos">
                  {eventFilterOptions.map((option) => (
                    <button
                      key={`duel-${option.key}`}
                      type="button"
                      className={eventFilter === option.key ? "is-active" : ""}
                      onClick={() => setEventFilter(option.key)}
                      aria-pressed={eventFilter === option.key}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="match-duels-layout">
                  <div className="match-duels-list">
                    {filteredDuelEvents.length === 0 ? (
                      <div className="empty-chart">
                        No hay eventos para este filtro.
                      </div>
                    ) : (
                      filteredDuelEvents.map(renderRoundEventButton)
                    )}
                  </div>
                  <aside className="match-selected-round-map">
                    <MatchEventMapCanvas
                      mapName={mapName}
                      mapImageUrl={mapImageUrl}
                      selectedEvent={selectedDuelEvent}
                      eventMapState={duelEventMapState}
                      mapTransform={mapTransform}
                    />
                  </aside>
                </div>
              </section>
            )}

            {activeSection === "team" && (
            <section
              className="match-team-section"
              role="region"
              aria-label={activeSectionLabel}
            >
            <div className="match-side-comparison-zone">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Ataque vs Defensa</h3>
                  <p className="panel-subtitle">
                    Ataque y defensa derivados por orden real de rondas.
                  </p>
                </div>
                {sideBest && (
                  <span className="meta-pill match-side-badge">
                    Mejor lado: {sideBest.label}
                  </span>
                )}
              </div>

              <div className="match-side-cards">
                {matchAnalysis.sideSummary.map((side) => (
                  <article key={side.key} className="match-side-card">
                    <header>
                      <h4>{side.label}</h4>
                      <strong>{formatPercent(side.winRate, 1)}</strong>
                    </header>

                    <div className="match-side-grid">
                      <span>Rondas</span>
                      <strong>{side.rounds}</strong>

                      <span>K / D / A</span>
                      <strong>
                        {side.kills}/{side.deaths}/{side.assists}
                      </strong>

                      <span>KD</span>
                      <strong>{formatNumber(side.kd, 2)}</strong>

                      <span>KPR</span>
                      <strong>{formatNumber(side.killsPerRound, 2)}</strong>

                      <span>Score total</span>
                      <strong>{formatNumber(side.score)}</strong>

                      <span>Gasto medio</span>
                      <strong>{formatNumber(side.avgSpent)}</strong>
                    </div>
                  </article>
                ))}
              </div>

            </div>

            <div className="match-scoreboard-panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Scoreboard</h3>
                  <p className="panel-subtitle">
                    Cambia la perspectiva pulsando cualquier jugador.
                  </p>
                </div>
              </div>

              <div className="match-scoreboard-teams">
                {playersByTeam.map(([teamId, teamPlayers]) => (
                  <div key={`scoreboard-${teamId}`} className="match-scoreboard-team">
                    <h4>{teamId}</h4>
                    <div className="match-scoreboard-header">
                      <span>Jugador</span>
                      <span>K / D / A</span>
                      <span>KD</span>
                      <span>ACS</span>
                      <span>Score</span>
                      <span>Rango</span>
                    </div>
                    {teamPlayers.map((player) => {
                      const puuid = cleanId(player.puuid);
                      const agent = getAgentMeta(player, agentById, agentNameMap);
                      const rankName = getRankNameFromTier(
                        player.competitiveTier ?? null,
                      );
                      return (
                        <button
                          key={`score-${puuid || getPlayerDisplay(player)}`}
                          type="button"
                          className={`match-scoreboard-row ${puuid === selectedPlayerId ? "is-selected" : ""}`}
                          onClick={() => puuid && handlePlayerSelect(puuid)}
                          aria-label={`Ver partida desde la perspectiva de ${getPlayerShortDisplay(player)}`}
                        >
                          <span className="match-scoreboard-player">
                            {agent.icon ? (
                              <img src={agent.icon} alt="" />
                            ) : (
                              <i>{agent.name.charAt(0).toUpperCase()}</i>
                            )}
                            <strong>{getPlayerShortDisplay(player)}</strong>
                          </span>
                          <span>{getPlayerMatchKda(player)}</span>
                          <span>{formatNumber(getPlayerMatchKd(player), 2)}</span>
                          <span>{formatNumber(getPlayerMatchAcs(player))}</span>
                          <span>{formatNumber(player.stats?.score)}</span>
                          <span>{rankName}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            </section>
            )}

            {activeSection === "economy" && (
            <section
              className="match-economy-panel"
              role="region"
              aria-label={activeSectionLabel}
            >
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Economía</h3>
                  <p className="panel-subtitle">
                    Gasto y valor de equipamiento del jugador seleccionado.
                  </p>
                </div>
              </div>

              <div className="match-economy-cards">
                <div>
                  <span>Gasto total</span>
                  <strong>{formatNumber(matchAnalysis.totalSpent)}</strong>
                </div>
                <div>
                  <span>Gasto medio/ronda</span>
                  <strong>{formatNumber(matchAnalysis.avgSpent)}</strong>
                </div>
                <div>
                  <span>Loadout medio</span>
                  <strong>{formatNumber(matchAnalysis.avgLoadout)}</strong>
                </div>
                <div>
                  <span>Eco rounds ganadas</span>
                  <strong>
                    {matchAnalysis.ecoWins}/{matchAnalysis.ecoRounds}
                  </strong>
                </div>
                <div>
                  <span>Full buy ganadas</span>
                  <strong>
                    {matchAnalysis.fullBuyWins}/{matchAnalysis.fullBuyRounds}
                  </strong>
                </div>
              </div>

              <div className="match-buy-type-grid">
                <article>
                  <span>Eco</span>
                  <strong>
                    {buyTypeSummary.eco.wins}/{buyTypeSummary.eco.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.eco.winRate, 1)}</small>
                </article>
                <article>
                  <span>Force</span>
                  <strong>
                    {buyTypeSummary.force.wins}/{buyTypeSummary.force.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.force.winRate, 1)}</small>
                </article>
                <article>
                  <span>Full buy</span>
                  <strong>
                    {buyTypeSummary.fullBuy.wins}/{buyTypeSummary.fullBuy.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.fullBuy.winRate, 1)}</small>
                </article>
              </div>
            </section>
            )}

            {activeSection === "map" && (
              <section
                className="match-map-section"
                role="region"
                aria-label={activeSectionLabel}
              >
                <aside className="match-map-event-list">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Eventos de partida</h3>
                      <p className="panel-subtitle">
                        {filteredDuelEvents.length} de {sortedAllRoundEvents.length} eventos
                      </p>
                    </div>
                    <button
                      type="button"
                      className="match-play-button"
                      onClick={openMatchPlayback}
                      disabled={allRoundEvents.length === 0}
                    >
                      Reproducir partida
                    </button>
                  </div>

                  <div className="match-event-filters" aria-label="Filtros del mapa">
                    {eventFilterOptions.map((option) => (
                      <button
                        key={`map-${option.key}`}
                        type="button"
                        className={eventFilter === option.key ? "is-active" : ""}
                        onClick={() => setEventFilter(option.key)}
                        aria-pressed={eventFilter === option.key}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="match-map-event-scroll">
                    {filteredDuelEvents.length === 0 ? (
                      <div className="empty-chart">No hay eventos para este filtro.</div>
                    ) : (
                      filteredDuelEvents.map(renderRoundEventButton)
                    )}
                  </div>
                </aside>

                <div className="match-map-main">
                  <MatchEventMapCanvas
                    mapName={mapName}
                    mapImageUrl={mapImageUrl}
                    selectedEvent={selectedDuelEvent}
                    eventMapState={duelEventMapState}
                    mapTransform={mapTransform}
                  />
                </div>
              </section>
            )}
            </div>

          </div>
        )}
      </div>
      {playbackOpen && (
        <div
          className="match-playback-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={playbackTitle}
          onClick={closePlayback}
        >
          <div
            className="match-playback-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="match-playback-header">
              <div>
                <span className="stats-eyebrow">{playbackTitle}</span>
              </div>
              <button type="button" className="modal-close" onClick={closePlayback}>
                ×
              </button>
            </header>

            <div className="match-playback-body">
              <aside className="match-playback-actions">
                <div className="match-playback-progress">
                  Evento {playbackEvents.length === 0 ? 0 : playbackIndex + 1} de{" "}
                  {playbackEvents.length}
                </div>
                <div className="match-playback-action-list">
                  {playbackEvents.map(renderPlaybackEventButton)}
                </div>
              </aside>

              <div className="match-playback-map">
                <MatchEventMapCanvas
                  mapName={mapName}
                  mapImageUrl={mapImageUrl}
                  selectedEvent={playbackEvent}
                  eventMapState={playbackMapState}
                  mapTransform={mapTransform}
                  compact
                />
              </div>

              <div className="match-playback-controls">
                <button type="button" onClick={restartPlayback}>
                  Reiniciar
                </button>
                <button
                  type="button"
                  onClick={previousPlaybackEvent}
                  disabled={playbackIndex === 0}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPlaybackPlaying((playing) => !playing)}
                  disabled={playbackEvents.length <= 1}
                >
                  {playbackPlaying ? "Pausar" : "Reanudar"}
                </button>
                <button
                  type="button"
                  onClick={nextPlaybackEvent}
                  disabled={playbackIndex >= playbackEvents.length - 1}
                >
                  Siguiente
                </button>
                <button type="button" onClick={closePlayback}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

