import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Circle, Clock3, Crosshair, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  analyzeEconomyEfficiency,
  classifyTeamEconomy,
} from "../../utils/analytics/economyDecision";
import type {
  EconomyEfficiency,
  EconomyEfficiencyAnalysis,
} from "../../utils/analytics/economyDecision";
import { calculateMatchMomentum } from "../../utils/analytics/momentum";
import type {
  MatchMomentumResult,
  MomentumInputRound,
} from "../../utils/analytics/momentum";
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
  | "classification"
  | "rounds"
  | "duels"
  | "economy";
type TeamScoreboardMode = "grouped" | "combined";
type ScoreboardSideFilter = "all" | "attack" | "defense";
type DuelMatrixFilter = "all" | "withKills" | "teamA" | "teamB" | "ties";

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
  roundCeremony: string;
  playerKills: number;
  playerDeaths: number;
  playerAssists: number;
  playerScore: number;
  playerSpent: number;
  playerLoadout: number;
  teamSpent: number;
  teamLoadout: number;
  buyType: EconomyBuyType;
  playerDamage: number;
  playerWasTraded: boolean;
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

type AverageTeamRank = {
  tier: number | null;
  name: string;
  icon: string | null;
};

type PlayerScoreboardStats = {
  player: RawPlayer;
  puuid: string;
  teamId: string;
  agentName: string;
  agentIcon?: string | null;
  rankTier?: number | null;
  rankName: string;
  rankIcon?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  rounds: number;
  acs: number;
  kd: number;
  plusMinus: number;
  damageDealt: number;
  damageReceived: number;
  damageDelta: number;
  adr: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  hsPct: number;
  kastRounds: number;
  kastPct: number;
  firstKills: number;
  firstDeaths: number;
  multikillRounds: number;
};

type RoundTeamLoadout = {
  roundNum: number;
  teamAValue: number;
  teamBValue: number;
  teamASpent: number;
  teamBSpent: number;
  teamACredits: number;
  teamBCredits: number;
  teamAWon: boolean;
  teamBWon: boolean;
  hadPlant: boolean;
  hadDefuse: boolean;
};

type TeamEconomySummary = {
  key: "teamA" | "teamB";
  label: string;
  totalLoadout: number;
  avgLoadout: number;
  totalSpent: number;
  avgSpent: number;
  buyTypes: Record<EconomyBuyType, { rounds: number; wins: number; winRate: number }>;
};

type EconomyBuyType = "eco" | "semiEco" | "fullBuy";
type RoundWinCondition = "elimination" | "defuse" | "time" | "fallback";

type PlayerDuelCell = {
  key: string;
  teamAPlayer: RawPlayer;
  teamBPlayer: RawPlayer;
  teamAKillsOnB: number;
  teamBKillsOnA: number;
  total: number;
  leader: "teamA" | "teamB" | "tie";
  events: RoundEvent[];
};

const matchDetailSections = [
  { key: "summary", label: "Resumen" },
  { key: "classification", label: "Tabla de clasificación" },
  { key: "rounds", label: "Rondas" },
  { key: "duels", label: "Duelos" },
  { key: "economy", label: "Economía" },
] as const satisfies ReadonlyArray<{
  key: MatchDetailSection;
  label: string;
}>;

const economyBuyLabels: Record<EconomyBuyType, string> = {
  eco: "ECO",
  semiEco: "SEMIECO",
  fullBuy: "FULL",
};

const economyBuyColors: Record<EconomyBuyType, string> = {
  eco: "#ff4655",
  semiEco: "#f3c567",
  fullBuy: "#46c878",
};

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

function compareScoreboardPlayers(
  a: PlayerScoreboardStats,
  b: PlayerScoreboardStats,
): number {
  return (
    b.acs - a.acs ||
    b.kd - a.kd ||
    b.kills - a.kills ||
    b.score - a.score
  );
}

function getAverageTeamRank(
  players: RawPlayer[],
  tierByNumber: Map<number, CompetitiveTierContent>,
): AverageTeamRank {
  const tiers = players
    .map((player) => Number(player.competitiveTier))
    .filter((tier) => Number.isFinite(tier) && tier > 0);

  if (tiers.length === 0) {
    return { tier: null, name: "Sin rango", icon: null };
  }

  const tier = Math.round(
    tiers.reduce((sum, current) => sum + current, 0) / tiers.length,
  );
  const tierAsset = tierByNumber.get(tier);
  return {
    tier,
    name: getRankNameFromTier(tier),
    icon: normalizeCompetitiveTierIconPath(
      tierAsset?.smallIcon ?? tierAsset?.largeIcon ?? null,
    ),
  };
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

function classifyRoundEconomy(teamSpent: number, teamLoadout: number): EconomyBuyType {
  const economyType = classifyTeamEconomy(teamLoadout || teamSpent);
  if (economyType === "FULL") return "fullBuy";
  if (economyType === "SEMIECO") return "semiEco";
  return "eco";
}

function getRoundWinCondition(round: RoundSummary): RoundWinCondition {
  const text = `${round.roundResult} ${round.roundCeremony}`.toLowerCase();

  if (round.hadDefuse || text.includes("defuse") || text.includes("defused")) {
    return "defuse";
  }
  if (
    text.includes("time") ||
    text.includes("timeout") ||
    text.includes("expired") ||
    text.includes("detonate") ||
    text.includes("spike")
  ) {
    return "time";
  }
  if (
    text.includes("elim") ||
    text.includes("kill") ||
    text.includes("ace") ||
    text.includes("flawless") ||
    text.includes("survived")
  ) {
    return "elimination";
  }
  return "fallback";
}

function getRoundWinIcon(condition: RoundWinCondition): LucideIcon {
  if (condition === "defuse") return Wrench;
  if (condition === "time") return Clock3;
  if (condition === "elimination") return Crosshair;
  return Circle;
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

function getTeamRoundsWon(currentMatch: RawMatchDetail | null, teamId: string): number {
  const teamInfo =
    currentMatch?.teams?.find((team) => cleanId(team.teamId) === teamId) ?? null;
  const roundsFromTeam = toNumber(teamInfo?.roundsWon);
  if (roundsFromTeam > 0) return roundsFromTeam;

  return (currentMatch?.roundResults ?? []).filter(
    (round) => cleanId(round.winningTeam) === teamId,
  ).length;
}

function buildRoundTeamLoadoutTimeline(
  currentMatch: RawMatchDetail,
  playersByTeam: Array<[string, RawPlayer[]]>,
): RoundTeamLoadout[] {
  const teamAId = cleanId(playersByTeam[0]?.[0]);
  const teamBId = cleanId(playersByTeam[1]?.[0]);
  const playerTeamByPuuid = new Map<string, string>();

  for (const [teamId, teamPlayers] of playersByTeam) {
    for (const player of teamPlayers) {
      const puuid = cleanId(player.puuid);
      if (puuid) playerTeamByPuuid.set(puuid, cleanId(teamId));
    }
  }

  return (currentMatch.roundResults ?? []).map((round, index) => {
    const roundNum = Number.isFinite(round.roundNum)
      ? Number(round.roundNum)
      : index;
    let teamAValue = 0;
    let teamBValue = 0;
    let teamASpent = 0;
    let teamBSpent = 0;
    let teamACredits = 0;
    let teamBCredits = 0;

    for (const stat of round.playerStats ?? []) {
      const puuid = cleanId(stat.puuid);
      const teamId = puuid ? playerTeamByPuuid.get(puuid) : "";
      const loadoutValue = toNumber(stat.economy?.loadoutValue);
      const spent = toNumber(stat.economy?.spent);
      const remaining = toNumber(stat.economy?.remaining);
      if (teamId === teamAId) {
        teamAValue += loadoutValue;
        teamASpent += spent;
        teamACredits += remaining;
      }
      if (teamId === teamBId) {
        teamBValue += loadoutValue;
        teamBSpent += spent;
        teamBCredits += remaining;
      }
    }

    const winningTeam = cleanId(round.winningTeam);
    return {
      roundNum,
      teamAValue,
      teamBValue,
      teamASpent,
      teamBSpent,
      teamACredits,
      teamBCredits,
      teamAWon: Boolean(teamAId) && winningTeam === teamAId,
      teamBWon: Boolean(teamBId) && winningTeam === teamBId,
      hadPlant: Boolean(cleanId(round.bombPlanter)),
      hadDefuse: Boolean(cleanId(round.bombDefuser)),
    };
  });
}

function MatchLoadoutTimeline({
  data,
  teamALabel,
  teamBLabel,
}: {
  data: RoundTeamLoadout[];
  teamALabel: string;
  teamBLabel: string;
}) {
  const globalMax = Math.max(
    ...data.flatMap((round) => [round.teamAValue, round.teamBValue]),
    0,
  );

  return (
    <section className="match-loadout-timeline-panel">
      <div className="match-loadout-timeline-header">
        <div>
          <h4>Comparativa de loadout por ronda</h4>
          <p>Valor total de equipamiento por equipo antes de cada ronda.</p>
        </div>
        <div className="match-loadout-legend" aria-label="Leyenda loadout">
          <span><i className="is-team-a" /> {teamALabel}</span>
          <span><i className="is-team-b" /> {teamBLabel}</span>
        </div>
      </div>

      {data.length === 0 || globalMax <= 0 ? (
        <div className="empty-chart">No hay datos de loadout por ronda.</div>
      ) : (
        <div className="match-loadout-timeline-scroll">
          {data.map((round) => {
            const winner = round.teamAWon
              ? teamALabel
              : round.teamBWon
                ? teamBLabel
                : "Empate";
            const teamAHeight = Math.max(6, safeDivide(round.teamAValue, globalMax) * 100);
            const teamBHeight = Math.max(6, safeDivide(round.teamBValue, globalMax) * 100);

            return (
              <article
                key={`loadout-${round.roundNum}`}
                className={`match-loadout-round ${
                  round.teamAWon ? "is-team-a-win" : round.teamBWon ? "is-team-b-win" : ""
                }`}
                title={`${roundLabel(round.roundNum)} · ${teamALabel} ${formatNumber(
                  round.teamAValue,
                )} · ${teamBLabel} ${formatNumber(round.teamBValue)} · Ganó ${winner}`}
              >
                <span className="match-loadout-round-number">
                  {round.roundNum + 1}
                </span>
                <div className="match-loadout-bars" aria-hidden="true">
                  <span
                    className="match-loadout-bar match-loadout-bar--team-a"
                    style={{ height: `${teamAHeight}%` }}
                  />
                  <span
                    className="match-loadout-bar match-loadout-bar--team-b"
                    style={{ height: `${teamBHeight}%` }}
                  />
                </div>
                <span className="match-loadout-round-meta">
                  {round.hadPlant && <em>P</em>}
                  {round.hadDefuse && <em>DEF</em>}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getTeamLabel(
  teamId: string | null | undefined,
  teamAId: string,
  teamBId: string,
  teamALabel: string,
  teamBLabel: string,
): string {
  if (!teamId) return "Neutral";
  if (teamId === teamAId) return teamALabel;
  if (teamId === teamBId) return teamBLabel;
  return teamId;
}

function MatchMomentumPanel({
  momentum,
  teamAId,
  teamBId,
  teamALabel,
  teamBLabel,
}: {
  momentum: MatchMomentumResult | null;
  teamAId: string;
  teamBId: string;
  teamALabel: string;
  teamBLabel: string;
}) {
  if (!momentum || momentum.rounds.length === 0) {
    return (
      <section className="match-analytics-panel match-momentum-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Momentum de la partida</h3>
            <p className="panel-subtitle">
              No hay rondas suficientes para calcular cambios de dominio.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const chartData = momentum.rounds.map((round) => ({
    round: round.roundNumber,
    diff: round.momentumDiff,
    swing: round.isSwingRound ? round.momentumDiff : null,
  }));
  const keyMoments = [
    ...momentum.domainChanges.map((change) => ({
      roundNumber: change.roundNumber,
      label: "Cambio de dominio",
      detail: change.reason,
    })),
    ...momentum.rounds
      .filter((round) => round.isStreakBreaker)
      .map((round) => ({
        roundNumber: round.roundNumber,
        label: "Ruptura de racha",
        detail: round.explanation,
      })),
    ...momentum.rounds
      .filter((round) => round.tags.includes("Victoria con economía inferior"))
      .map((round) => ({
        roundNumber: round.roundNumber,
        label: "Victoria con economía inferior",
        detail: round.explanation,
      })),
  ]
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .slice(0, 6);

  return (
    <section className="match-analytics-panel match-momentum-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Momentum de la partida</h3>
          <p className="panel-subtitle">
            Tendencia ronda a ronda con suavizado y señales económicas.
          </p>
        </div>
      </div>

      <div className="match-momentum-summary-grid">
        <article>
          <span>Dominio principal</span>
          <strong>
            {getTeamLabel(
              momentum.globalDominantTeamId,
              teamAId,
              teamBId,
              teamALabel,
              teamBLabel,
            )}
          </strong>
        </article>
        <article>
          <span>Cambios de dominio</span>
          <strong>{formatNumber(momentum.summary.totalDomainChanges)}</strong>
        </article>
        <article>
          <span>Ronda de mayor impacto</span>
          <strong>
            {momentum.biggestSwingRound
              ? roundLabel(momentum.biggestSwingRound.roundNumber - 1)
              : "Sin datos"}
          </strong>
        </article>
        <article>
          <span>Control de Team A</span>
          <strong>{formatPercent(momentum.summary.teamAControlPercentage, 0)}</strong>
        </article>
        <article>
          <span>Control de Team B</span>
          <strong>{formatPercent(momentum.summary.teamBControlPercentage, 0)}</strong>
        </article>
      </div>

      <div className="match-momentum-chart">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis dataKey="round" stroke="#9ea8b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#9ea8b8" tickLine={false} axisLine={false} />
            <ReTooltip
              contentStyle={{
                background: "#11151c",
                border: "1px solid rgba(255,70,85,0.35)",
                borderRadius: 10,
                color: "#f4f7fb",
              }}
              labelFormatter={(label) => `Ronda ${label}`}
            />
            <Line
              type="monotone"
              dataKey="diff"
              name="Momentum"
              stroke="#46c878"
              strokeWidth={3}
              dot={{ r: 3, fill: "#151a22", stroke: "#46c878" }}
            />
            <Line
              type="monotone"
              dataKey="swing"
              name="Swing rounds"
              stroke="#ff4655"
              strokeWidth={0}
              dot={{ r: 5, fill: "#ff4655", stroke: "#ffd7dc" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="match-key-moments">
        <h4>Momentos clave</h4>
        {keyMoments.length === 0 ? (
          <div className="empty-chart">No se detectaron swings destacados.</div>
        ) : (
          keyMoments.map((moment) => (
            <article key={`${moment.label}-${moment.roundNumber}-${moment.detail}`}>
              <strong>{roundLabel(moment.roundNumber - 1)}: {moment.label}</strong>
              <span>{moment.detail}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function getEfficiencyLabel(efficiency: EconomyEfficiency): string {
  switch (efficiency) {
    case "optimal":
      return "Óptima";
    case "acceptable":
      return "Aceptable";
    case "risky":
      return "Arriesgada";
    case "inefficient":
      return "Ineficiente";
    default:
      return efficiency;
  }
}

function EconomyOptimalPanel({
  analysis,
  momentum,
  teamALabel,
  teamBLabel,
}: {
  analysis: EconomyEfficiencyAnalysis | null;
  momentum: MatchMomentumResult | null;
  teamALabel: string;
  teamBLabel: string;
}) {
  if (!analysis || analysis.rounds.length === 0) {
    return (
      <section className="match-economy-optimal-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Economía óptima vs real</h3>
            <p className="panel-subtitle">
              No hay datos de economía por ronda suficientes.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const momentumByRound = new Map(
    (momentum?.rounds ?? []).map((round) => [round.roundNumber, round]),
  );
  const chartData = analysis.rounds.map((round) => ({
    round: round.roundNumber,
    teamA: round.teamA.efficiencyScore,
    teamB: round.teamB.efficiencyScore,
  }));
  const flattenedRows = analysis.rounds.flatMap((round) => [
    {
      roundNumber: round.roundNumber,
      team: teamALabel,
      data: round.teamA,
      momentum: momentumByRound.get(round.roundNumber),
    },
    {
      roundNumber: round.roundNumber,
      team: teamBLabel,
      data: round.teamB,
      momentum: momentumByRound.get(round.roundNumber),
    },
  ]);
  const biggestError = [
    analysis.summary.teamAMostInefficientRound,
    analysis.summary.teamBMostInefficientRound,
  ]
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)[0];

  return (
    <section className="match-economy-optimal-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Economía óptima vs real</h3>
          <p className="panel-subtitle">
            Compra real comparada con una recomendación explicable por ronda.
          </p>
        </div>
      </div>

      <div className="match-economy-optimal-summary">
        <article>
          <span>Eficiencia {teamALabel}</span>
          <strong>{formatPercent(analysis.summary.teamAAverageEfficiency, 0)}</strong>
        </article>
        <article>
          <span>Eficiencia {teamBLabel}</span>
          <strong>{formatPercent(analysis.summary.teamBAverageEfficiency, 0)}</strong>
        </article>
        <article>
          <span>Óptima {teamALabel}</span>
          <strong>{analysis.summary.teamAOptimalRounds}</strong>
        </article>
        <article>
          <span>Óptima {teamBLabel}</span>
          <strong>{analysis.summary.teamBOptimalRounds}</strong>
        </article>
        <article>
          <span>Mayor error económico</span>
          <strong>{biggestError ? roundLabel(biggestError - 1) : "Sin datos"}</strong>
        </article>
        <article>
          <span>Mejor aprovechamiento económico</span>
          <strong>
            {analysis.summary.biggestEconomicUpsetRound
              ? roundLabel(analysis.summary.biggestEconomicUpsetRound - 1)
              : "Sin datos"}
          </strong>
        </article>
      </div>

      <div className="match-economy-efficiency-chart">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis dataKey="round" stroke="#9ea8b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#9ea8b8" tickLine={false} axisLine={false} domain={[0, 100]} />
            <ReTooltip
              contentStyle={{
                background: "#11151c",
                border: "1px solid rgba(255,70,85,0.35)",
                borderRadius: 10,
                color: "#f4f7fb",
              }}
              labelFormatter={(label) => `Ronda ${label}`}
            />
            <Line type="monotone" dataKey="teamA" name={teamALabel} stroke="#46c878" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="teamB" name={teamBLabel} stroke="#ff4655" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="match-economy-optimal-table-wrap">
        <table className="match-economy-optimal-table">
          <thead>
            <tr>
              <th>Ronda</th>
              <th>Equipo</th>
              <th>Compra real</th>
              <th>Compra recomendada</th>
              <th>Loadout</th>
              <th>Resultado</th>
              <th>Eficiencia</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {flattenedRows.map((row) => {
              const momentumTag = row.momentum?.isSwingRound
                ? "Ronda de alto momentum"
                : row.data.isEconomicSwing
                  ? "Swing económico"
                  : "";
              return (
                <tr key={`${row.roundNumber}-${row.team}`}>
                  <td>{row.roundNumber}</td>
                  <td>{row.team}</td>
                  <td>{row.data.realType}</td>
                  <td>{row.data.recommendedType}</td>
                  <td>{formatNumber(row.data.loadout)}</td>
                  <td>{row.data.result === "win" ? "Victoria" : "Derrota"}</td>
                  <td>
                    <span className={`match-efficiency-pill is-${row.data.efficiency}`}>
                      {getEfficiencyLabel(row.data.efficiency)} · {row.data.efficiencyScore}
                    </span>
                  </td>
                  <td>
                    {row.data.reason}
                    {momentumTag ? <em>{momentumTag}</em> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function summarizeTeamEconomy(
  data: RoundTeamLoadout[],
  team: "teamA" | "teamB",
  label: string,
): TeamEconomySummary {
  const valueKey = team === "teamA" ? "teamAValue" : "teamBValue";
  const spentKey = team === "teamA" ? "teamASpent" : "teamBSpent";
  const wonKey = team === "teamA" ? "teamAWon" : "teamBWon";
  const buyTypes = (["eco", "semiEco", "fullBuy"] as const).reduce(
    (acc, key) => {
      const rounds = data.filter(
        (round) => classifyRoundEconomy(round[spentKey], round[valueKey]) === key,
      );
      const wins = rounds.filter((round) => round[wonKey]).length;
      acc[key] = {
        rounds: rounds.length,
        wins,
        winRate: safeDivide(wins, Math.max(rounds.length, 1)) * 100,
      };
      return acc;
    },
    {} as TeamEconomySummary["buyTypes"],
  );

  const totalLoadout = data.reduce((sum, round) => sum + round[valueKey], 0);
  const totalSpent = data.reduce((sum, round) => sum + round[spentKey], 0);

  return {
    key: team,
    label,
    totalLoadout,
    avgLoadout: safeDivide(totalLoadout, Math.max(data.length, 1)),
    totalSpent,
    avgSpent: safeDivide(totalSpent, Math.max(data.length, 1)),
    buyTypes,
  };
}

function buildPlayerScoreboardStats({
  player,
  currentMatch,
  sideFilter,
  teamByPuuid,
  agentById,
  agentNameMap,
  tierByNumber,
}: {
  player: RawPlayer;
  currentMatch: RawMatchDetail;
  sideFilter: ScoreboardSideFilter;
  teamByPuuid: Map<string, string>;
  agentById: Map<string, AgentContent>;
  agentNameMap: Record<string, string>;
  tierByNumber: Map<number, CompetitiveTierContent>;
}): PlayerScoreboardStats {
  const puuid = cleanId(player.puuid);
  const teamId = cleanId(player.teamId) || "Sin equipo";
  const agent = getAgentMeta(player, agentById, agentNameMap);
  const rankTier =
    typeof player.competitiveTier === "number" ? player.competitiveTier : null;
  const tierAsset = rankTier !== null ? tierByNumber.get(rankTier) : undefined;
  const rankIcon = normalizeCompetitiveTierIconPath(
    tierAsset?.smallIcon ??
      tierAsset?.largeIcon ??
      player.competitiveTierImage ??
      null,
  );

  let rounds = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let score = 0;
  let damageDealt = 0;
  let damageReceived = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;
  let firstKills = 0;
  let firstDeaths = 0;
  let kastRounds = 0;
  let multikillRounds = 0;

  for (const [roundIndex, round] of (currentMatch.roundResults ?? []).entries()) {
    const roundNum = Number.isFinite(round.roundNum)
      ? Number(round.roundNum)
      : roundIndex;
    const side = determineRoundSide(teamId, roundNum);
    if (sideFilter !== "all" && side !== sideFilter) continue;

    rounds += 1;
    const roundState = { kills: 0, assists: 0, deaths: 0, traded: false };
    const timelineKills: Array<{ kill: RawKillEvent; ownerPuuid: string }> = [];

    for (const stat of round.playerStats ?? []) {
      const ownerPuuid = cleanId(stat.puuid);
      if (ownerPuuid === puuid) {
        score += toNumber(stat.score);
        for (const damageEntry of stat.damage ?? []) {
          damageDealt += toNumber(damageEntry.damage);
          headshots += toNumber(damageEntry.headshots);
          bodyshots += toNumber(damageEntry.bodyshots);
          legshots += toNumber(damageEntry.legshots);
        }
      }

      for (const damageEntry of stat.damage ?? []) {
        if (cleanId(damageEntry.receiver) === puuid) {
          damageReceived += toNumber(damageEntry.damage);
        }
      }

      for (const kill of stat.kills ?? []) {
        timelineKills.push({ kill, ownerPuuid });
      }
    }

    timelineKills.sort(
      (a, b) =>
        toNumber(a.kill.timeSinceRoundStartMillis) -
        toNumber(b.kill.timeSinceRoundStartMillis),
    );
    const firstKill = timelineKills[0]?.kill ?? null;

    for (let killIndex = 0; killIndex < timelineKills.length; killIndex += 1) {
      const { kill, ownerPuuid } = timelineKills[killIndex];
      const killerId = cleanId(kill.killer) || ownerPuuid;
      const victimId = cleanId(kill.victim);
      const timeMs = toNumber(kill.timeSinceRoundStartMillis);

      if (killerId === puuid) {
        roundState.kills += 1;
        if (firstKill === kill) firstKills += 1;
      }

      if (victimId === puuid) {
        roundState.deaths += 1;
        if (firstKill === kill) firstDeaths += 1;

        for (let forward = killIndex + 1; forward < timelineKills.length; forward += 1) {
          const next = timelineKills[forward].kill;
          const nextTime = toNumber(next.timeSinceRoundStartMillis);
          if (nextTime - timeMs > 5000) break;

          const nextKiller = cleanId(next.killer);
          const nextVictim = cleanId(next.victim);
          if (
            nextVictim === killerId &&
            nextKiller &&
            teamByPuuid.get(nextKiller) === teamByPuuid.get(victimId)
          ) {
            roundState.traded = true;
            break;
          }
        }
      }

      if (killerId !== puuid && parseAssistants(kill.assistants).includes(puuid)) {
        roundState.assists += 1;
      }
    }

    kills += roundState.kills;
    deaths += roundState.deaths;
    assists += roundState.assists;
    if (roundState.kills >= 3) multikillRounds += 1;
    if (
      roundState.kills > 0 ||
      roundState.assists > 0 ||
      roundState.deaths === 0 ||
      roundState.traded
    ) {
      kastRounds += 1;
    }
  }

  const totalHits = headshots + bodyshots + legshots;
  return {
    player,
    puuid,
    teamId,
    agentName: agent.name,
    agentIcon: agent.icon,
    rankTier,
    rankName: getRankNameFromTier(rankTier),
    rankIcon,
    kills,
    deaths,
    assists,
    score,
    rounds,
    acs: safeDivide(score, Math.max(rounds, 1)),
    kd: safeDivide(kills, Math.max(deaths, 1)),
    plusMinus: kills - deaths,
    damageDealt,
    damageReceived,
    damageDelta: safeDivide(damageDealt - damageReceived, Math.max(rounds, 1)),
    adr: safeDivide(damageDealt, Math.max(rounds, 1)),
    headshots,
    bodyshots,
    legshots,
    hsPct: safeDivide(headshots, Math.max(totalHits, 1)) * 100,
    kastRounds,
    kastPct: safeDivide(kastRounds, Math.max(rounds, 1)) * 100,
    firstKills,
    firstDeaths,
    multikillRounds,
  };
}

function buildDuelMatrix(
  playersByTeam: Array<[string, RawPlayer[]]>,
  allRoundEvents: RoundEvent[],
): PlayerDuelCell[] {
  const teamAPlayers = playersByTeam[0]?.[1] ?? [];
  const teamBPlayers = playersByTeam[1]?.[1] ?? [];
  const teamAIds = new Set(teamAPlayers.map((player) => cleanId(player.puuid)).filter(Boolean));
  const teamBIds = new Set(teamBPlayers.map((player) => cleanId(player.puuid)).filter(Boolean));
  const cells = new Map<string, PlayerDuelCell>();

  for (const teamAPlayer of teamAPlayers) {
    const teamAId = cleanId(teamAPlayer.puuid);
    if (!teamAId) continue;
    for (const teamBPlayer of teamBPlayers) {
      const teamBId = cleanId(teamBPlayer.puuid);
      if (!teamBId) continue;
      cells.set(`${teamAId}:${teamBId}`, {
        key: `${teamAId}:${teamBId}`,
        teamAPlayer,
        teamBPlayer,
        teamAKillsOnB: 0,
        teamBKillsOnA: 0,
        total: 0,
        leader: "tie",
        events: [],
      });
    }
  }

  for (const event of allRoundEvents) {
    if (event.kind !== "kill") continue;
    const killer = cleanId(event.killer);
    const victim = cleanId(event.victim);
    if (!killer || !victim) continue;

    let key = "";
    let teamAKill = false;
    if (teamAIds.has(killer) && teamBIds.has(victim)) {
      key = `${killer}:${victim}`;
      teamAKill = true;
    } else if (teamBIds.has(killer) && teamAIds.has(victim)) {
      key = `${victim}:${killer}`;
    }

    const cell = key ? cells.get(key) : undefined;
    if (!cell) continue;
    if (teamAKill) {
      cell.teamAKillsOnB += 1;
    } else {
      cell.teamBKillsOnA += 1;
    }
    cell.total += 1;
    cell.events.push(event);
  }

  for (const cell of cells.values()) {
    cell.events.sort((a, b) => a.roundNum - b.roundNum || a.timeMs - b.timeMs);
    cell.leader =
      cell.teamAKillsOnB > cell.teamBKillsOnA
        ? "teamA"
        : cell.teamBKillsOnA > cell.teamAKillsOnB
          ? "teamB"
          : "tie";
  }

  return [...cells.values()];
}

function MatchRoundResultTimeline({
  rounds,
  playersByTeam,
  currentMatch,
  bestRoundNum,
}: {
  rounds: RoundSummary[];
  playersByTeam: Array<[string, RawPlayer[]]>;
  currentMatch: RawMatchDetail | null;
  bestRoundNum?: number | null;
}) {
  const teams = playersByTeam.slice(0, 2).map(([teamId], index) => ({
    teamId,
    label: `Team ${String.fromCharCode(65 + index)}`,
    score: getTeamRoundsWon(currentMatch, teamId),
  }));

  if (teams.length < 2 || rounds.length === 0) {
    return (
      <div className="match-summary-round-timeline empty-panel">
        No hay rondas suficientes para construir el timeline.
      </div>
    );
  }

  return (
    <section className="match-summary-round-timeline" aria-label="Resultado por ronda">
      {teams.map((team) => (
        <div key={`summary-team-${team.teamId}`} className="match-summary-round-row">
          <div className="match-summary-round-team-label">{team.label}</div>
          <div className="match-summary-round-score">{team.score}</div>
          <div className="match-summary-round-track">
            {rounds.map((round) => {
              const isWin = round.winningTeam === team.teamId;
              const condition = getRoundWinCondition(round);
              const RoundIcon = isWin ? getRoundWinIcon(condition) : Circle;
              const isBestRound = round.roundNum === bestRoundNum;
              return (
                <span
                  key={`summary-${team.teamId}-${round.roundNum}`}
                  className={`match-summary-round-cell ${isWin ? "is-win" : "is-loss"} ${
                    isBestRound ? "is-best-round" : ""
                  }`}
                  title={`${roundLabel(round.roundNum)} · ${
                    isWin ? "ganada" : "perdida"
                  }`}
                >
                  {isWin ? <RoundIcon aria-hidden="true" size={15} strokeWidth={2.4} /> : <span aria-hidden="true" />}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div className="match-summary-round-numbers" aria-hidden="true">
        <span />
        <span />
        <div className="match-summary-round-track">
          {rounds.map((round) => (
            <small key={`summary-number-${round.roundNum}`}>
              {round.roundNum + 1}
            </small>
          ))}
        </div>
      </div>
    </section>
  );
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
  const matchDetailPanelRef = useRef<HTMLDivElement | null>(null);
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
  const [teamScoreboardMode, setTeamScoreboardMode] =
    useState<TeamScoreboardMode>("grouped");
  const [scoreboardSideFilter, setScoreboardSideFilter] =
    useState<ScoreboardSideFilter>("all");
  const [selectedDuelKey, setSelectedDuelKey] = useState<string | null>(null);
  const [duelMatrixFilter, setDuelMatrixFilter] =
    useState<DuelMatrixFilter>("all");
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playbackEvents, setPlaybackEvents] = useState<RoundEvent[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackTitle, setPlaybackTitle] = useState("");
  const [isMatchDetailOverflowing, setIsMatchDetailOverflowing] =
    useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

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
  const { icon: mvpAgentIcon } = getAgentMeta(mvp, agentById, agentNameMap);

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
      let teamSpent = 0;
      let teamLoadout = 0;
      for (const stat of round.playerStats ?? []) {
        const statPuuid = cleanId(stat.puuid);
        if (statPuuid && teamByPuuid.get(statPuuid) === playerTeam) {
          teamSpent += toNumber(stat.economy?.spent);
          teamLoadout += toNumber(stat.economy?.loadoutValue);
        }
      }
      const buyType = classifyRoundEconomy(
        teamSpent || playerSpent,
        teamLoadout || playerLoadout,
      );

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
      let playerWasTraded = false;
      const roundEvents: RoundEvent[] = [];

      for (
        let killIndex = 0;
        killIndex < timelineKills.length;
        killIndex += 1
      ) {
        const { kill, ownerPuuid } = timelineKills[killIndex];
        const killerId = cleanId(kill.killer) || ownerPuuid;
        const victimId = cleanId(kill.victim);
        const timeMs = toNumber(kill.timeSinceRoundStartMillis);

        if (victimId === selectedPlayerId) {
          playerDeaths += 1;
          for (let forward = killIndex + 1; forward < timelineKills.length; forward += 1) {
            const next = timelineKills[forward].kill;
            const nextTime = toNumber(next.timeSinceRoundStartMillis);
            if (nextTime - timeMs > 5000) break;

            const nextKiller = cleanId(next.killer);
            const nextVictim = cleanId(next.victim);
            if (
              nextVictim === killerId &&
              nextKiller &&
              teamByPuuid.get(nextKiller) === playerTeam
            ) {
              playerWasTraded = true;
              break;
            }
          }
        }

        const assistants = parseAssistants(kill.assistants);
        if (
          killerId !== selectedPlayerId &&
          assistants.includes(selectedPlayerId)
        ) {
          playerAssists += 1;
        }

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
        roundCeremony: cleanId(round.roundCeremony),
        playerKills,
        playerDeaths,
        playerAssists,
        playerScore,
        playerSpent,
        playerLoadout,
        teamSpent,
        teamLoadout,
        buyType,
        playerDamage: playerRoundDamage,
        playerWasTraded,
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
        round.playerWasTraded,
    ).length;
    const kastPct = safeDivide(kastRounds, Math.max(totalRounds, 1)) * 100;
    const multikillRounds = rounds.filter(
      (round) => round.playerKills >= 3,
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

    const ecoRounds = rounds.filter((round) => round.buyType === "eco").length;
    const ecoWins = rounds.filter(
      (round) => round.buyType === "eco" && round.didWin,
    ).length;
    const fullBuyRounds = rounds.filter(
      (round) => round.buyType === "fullBuy",
    ).length;
    const fullBuyWins = rounds.filter(
      (round) => round.buyType === "fullBuy" && round.didWin,
    ).length;

    const insights: string[] = [];
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

  const playerScoreboardStatsByPuuid = useMemo(() => {
    const stats = new Map<string, PlayerScoreboardStats>();
    if (!currentMatch) return stats;

    for (const player of players) {
      const puuid = cleanId(player.puuid);
      if (!puuid) continue;
      stats.set(
        puuid,
        buildPlayerScoreboardStats({
          player,
          currentMatch,
          sideFilter: scoreboardSideFilter,
          teamByPuuid,
          agentById,
          agentNameMap,
          tierByNumber,
        }),
      );
    }

    return stats;
  }, [
    currentMatch,
    players,
    scoreboardSideFilter,
    teamByPuuid,
    agentById,
    agentNameMap,
    tierByNumber,
  ]);


  const teamScoreboardGroups = useMemo(() => {
    return playersByTeam.map(([teamId, teamPlayers], index) => {
      const teamLabel = `Team ${String.fromCharCode(65 + index)}`;
      const tone = index === 0 ? "team-a" : "team-b";
      const rows = teamPlayers
        .map((player) => {
          const puuid = cleanId(player.puuid);
          return puuid ? playerScoreboardStatsByPuuid.get(puuid) : undefined;
        })
        .filter((entry): entry is PlayerScoreboardStats => Boolean(entry))
        .sort(compareScoreboardPlayers);

      return {
        teamId,
        teamLabel,
        tone,
        averageRank: getAverageTeamRank(teamPlayers, tierByNumber),
        rows,
      };
    });
  }, [playersByTeam, playerScoreboardStatsByPuuid, tierByNumber]);

  const combinedScoreboardRows = useMemo(
    () =>
      [...playerScoreboardStatsByPuuid.values()].sort(compareScoreboardPlayers),
    [playerScoreboardStatsByPuuid],
  );

  const roundTeamLoadoutTimeline = useMemo(
    () =>
      currentMatch
        ? buildRoundTeamLoadoutTimeline(currentMatch, playersByTeam)
        : [],
    [currentMatch, playersByTeam],
  );

  const teamAId = cleanId(playersByTeam[0]?.[0]);
  const teamBId = cleanId(playersByTeam[1]?.[0]);
  const teamALabel = teamAId === playerTeam ? "Tu equipo" : "Team A";
  const teamBLabel = teamBId === playerTeam ? "Tu equipo" : "Team B";

  const teamEconomySummaries = useMemo(() => {
    return [
      summarizeTeamEconomy(roundTeamLoadoutTimeline, "teamA", teamALabel),
      summarizeTeamEconomy(roundTeamLoadoutTimeline, "teamB", teamBLabel),
    ];
  }, [roundTeamLoadoutTimeline, teamALabel, teamBLabel]);

  const momentumAnalysis = useMemo<MatchMomentumResult | null>(() => {
    if (!currentMatch || !teamAId || !teamBId) return null;

    let teamAScore = 0;
    let teamBScore = 0;
    const loadoutByRound = new Map(
      roundTeamLoadoutTimeline.map((round) => [round.roundNum, round]),
    );

    const rounds: MomentumInputRound[] = (currentMatch.roundResults ?? []).map(
      (round, index) => {
        const roundNum = Number.isFinite(round.roundNum)
          ? Number(round.roundNum)
          : index;
        const loadout = loadoutByRound.get(roundNum);
        const winningTeam = cleanId(round.winningTeam);
        if (winningTeam === teamAId) teamAScore += 1;
        if (winningTeam === teamBId) teamBScore += 1;

        let teamAKills = 0;
        let teamBKills = 0;
        for (const stat of round.playerStats ?? []) {
          for (const kill of stat.kills ?? []) {
            const killerTeam = teamByPuuid.get(cleanId(kill.killer));
            if (killerTeam === teamAId) teamAKills += 1;
            if (killerTeam === teamBId) teamBKills += 1;
          }
        }

        const selectedRound = matchAnalysis?.rounds.find(
          (entry) => entry.roundNum === roundNum,
        );
        const winnerRole = String(round.winningTeamRole ?? "").toLowerCase();
        const winnerSide =
          winnerRole.includes("attack")
            ? "attack"
            : winnerRole.includes("def")
              ? "defense"
              : winningTeam
                ? determineRoundSide(winningTeam, roundNum)
                : undefined;

        return {
          roundNumber: roundNum + 1,
          winnerTeamId: winningTeam,
          winnerSide,
          teamAId,
          teamBId,
          teamAScore,
          teamBScore,
          teamALoadout: loadout?.teamAValue ?? 0,
          teamBLoadout: loadout?.teamBValue ?? 0,
          teamAKills,
          teamBKills,
          roundResult: round.roundResult,
          roundCeremony: round.roundCeremony,
          playerImpactScore: selectedRound
            ? selectedRound.playerScore +
              selectedRound.playerKills * 120 +
              selectedRound.playerAssists * 45
            : undefined,
        };
      },
    );

    return calculateMatchMomentum(rounds, { teamAId, teamBId });
  }, [
    currentMatch,
    matchAnalysis,
    roundTeamLoadoutTimeline,
    teamAId,
    teamBId,
    teamByPuuid,
  ]);

  const economyEfficiencyAnalysis = useMemo<EconomyEfficiencyAnalysis | null>(() => {
    if (!teamAId || !teamBId || roundTeamLoadoutTimeline.length === 0) return null;

    let teamAScore = 0;
    let teamBScore = 0;
    const rounds = roundTeamLoadoutTimeline.map((round) => {
      const beforeTeamAScore = teamAScore;
      const beforeTeamBScore = teamBScore;
      const winnerTeamId = round.teamAWon ? teamAId : round.teamBWon ? teamBId : "";
      if (round.teamAWon) teamAScore += 1;
      if (round.teamBWon) teamBScore += 1;

      return {
        roundNumber: round.roundNum + 1,
        teamALoadout: round.teamAValue,
        teamBLoadout: round.teamBValue,
        teamACredits: round.teamACredits > 0 ? round.teamACredits : undefined,
        teamBCredits: round.teamBCredits > 0 ? round.teamBCredits : undefined,
        teamAScore: beforeTeamAScore,
        teamBScore: beforeTeamBScore,
        winnerTeamId,
        teamAId,
        teamBId,
        teamASide: determineRoundSide(teamAId, round.roundNum),
        teamBSide: determineRoundSide(teamBId, round.roundNum),
      };
    });

    return analyzeEconomyEfficiency(rounds);
  }, [roundTeamLoadoutTimeline, teamAId, teamBId]);

  const teamEconomyDistributionData = useMemo(
    () =>
      (["eco", "semiEco", "fullBuy"] as const).map((key) => ({
        name: economyBuyLabels[key],
        teamA: teamEconomySummaries[0]?.buyTypes[key].rounds ?? 0,
        teamB: teamEconomySummaries[1]?.buyTypes[key].rounds ?? 0,
      })),
    [teamEconomySummaries],
  );

  const teamEconomyTimelineData = useMemo(
    () =>
      roundTeamLoadoutTimeline.map((round) => ({
        round: round.roundNum + 1,
        teamA: round.teamAValue,
        teamB: round.teamBValue,
      })),
    [roundTeamLoadoutTimeline],
  );

  const orderedPlayersByTeam = useMemo<Array<[string, RawPlayer[]]>>(
    () =>
      teamScoreboardGroups.map((group) => [
        group.teamId,
        group.rows.map((row) => row.player),
      ]),
    [teamScoreboardGroups],
  );

  const duelMatrix = useMemo(
    () => buildDuelMatrix(orderedPlayersByTeam, allRoundEvents),
    [orderedPlayersByTeam, allRoundEvents],
  );

  const filteredDuelMatrix = useMemo(() => {
    switch (duelMatrixFilter) {
      case "withKills":
        return duelMatrix.filter((cell) => cell.total > 0);
      case "teamA":
        return duelMatrix.filter((cell) => cell.leader === "teamA");
      case "teamB":
        return duelMatrix.filter((cell) => cell.leader === "teamB");
      case "ties":
        return duelMatrix.filter((cell) => cell.total > 0 && cell.leader === "tie");
      default:
        return duelMatrix;
    }
  }, [duelMatrix, duelMatrixFilter]);

  const activeDuel =
    duelMatrix.find((cell) => cell.key === selectedDuelKey) ??
    filteredDuelMatrix.find((cell) => cell.total > 0) ??
    filteredDuelMatrix[0] ??
    null;

  const selectedDuelDetailEvent = useMemo(() => {
    if (!activeDuel) return null;
    return (
      activeDuel.events.find((event) => event.id === selectedEventId) ??
      activeDuel.events[0] ??
      null
    );
  }, [activeDuel, selectedEventId]);

  const selectedDuelMapState = useMemo(
    () =>
      buildEventMapState({
        event: selectedDuelDetailEvent,
        mapTransform,
        playersByPuuid,
        playerTeam,
        selectedPlayerId,
        agentById,
      }),
    [
      selectedDuelDetailEvent,
      mapTransform,
      playersByPuuid,
      playerTeam,
      selectedPlayerId,
      agentById,
    ],
  );

  const duelSummary = useMemo(() => {
    const playedCells = duelMatrix.filter((cell) => cell.total > 0);
    return {
      teamAKills: duelMatrix.reduce((sum, cell) => sum + cell.teamAKillsOnB, 0),
      teamBKills: duelMatrix.reduce((sum, cell) => sum + cell.teamBKillsOnA, 0),
      teamAWon: playedCells.filter((cell) => cell.leader === "teamA").length,
      teamBWon: playedCells.filter((cell) => cell.leader === "teamB").length,
      ties: playedCells.filter((cell) => cell.leader === "tie").length,
    };
  }, [duelMatrix]);

  const duelHighlights = useMemo(() => {
    const played = duelMatrix.filter((cell) => cell.total > 0);
    return {
      top: [...played].sort((a, b) => b.total - a.total)[0] ?? null,
      teamA: [...played].sort(
        (a, b) =>
          b.teamAKillsOnB - b.teamBKillsOnA -
          (a.teamAKillsOnB - a.teamBKillsOnA),
      )[0] ?? null,
      teamB: [...played].sort(
        (a, b) =>
          b.teamBKillsOnA - b.teamAKillsOnB -
          (a.teamBKillsOnA - a.teamAKillsOnB),
      )[0] ?? null,
    };
  }, [duelMatrix]);

  const visibleDuelTeamAPlayers = useMemo(() => {
    const allowed = new Set(filteredDuelMatrix.map((cell) => cleanId(cell.teamAPlayer.puuid)));
    return (orderedPlayersByTeam[0]?.[1] ?? []).filter((player) =>
      allowed.has(cleanId(player.puuid)),
    );
  }, [filteredDuelMatrix, orderedPlayersByTeam]);

  const visibleDuelTeamBPlayers = useMemo(() => {
    const allowed = new Set(filteredDuelMatrix.map((cell) => cleanId(cell.teamBPlayer.puuid)));
    return (orderedPlayersByTeam[1]?.[1] ?? []).filter((player) =>
      allowed.has(cleanId(player.puuid)),
    );
  }, [filteredDuelMatrix, orderedPlayersByTeam]);

  const duelCellByKey = useMemo(() => {
    const map = new Map<string, PlayerDuelCell>();
    for (const cell of filteredDuelMatrix) {
      map.set(cell.key, cell);
    }
    return map;
  }, [filteredDuelMatrix]);

  const scoreState = useMemo(
    () => getTeamScoreState(currentMatch, playerTeam),
    [currentMatch, playerTeam],
  );
  const { resultState } = scoreState;

  const buyTypeSummary = useMemo(() => {
    const empty = { rounds: 0, wins: 0, winRate: 0 };
    if (!matchAnalysis) {
      return {
        eco: empty,
        semiEco: empty,
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
      eco: summarize((round) => round.buyType === "eco"),
      semiEco: summarize((round) => round.buyType === "semiEco"),
      fullBuy: summarize((round) => round.buyType === "fullBuy"),
    };
  }, [matchAnalysis]);

  const economyChartData = useMemo(() => {
    if (!matchAnalysis) return [];

    return (["eco", "semiEco", "fullBuy"] as const).map((key) => {
      const summary = buyTypeSummary[key];
      const rounds = matchAnalysis.rounds.filter((round) => round.buyType === key);
      return {
        key,
        name: economyBuyLabels[key],
        rounds: summary.rounds,
        wins: summary.wins,
        losses: Math.max(0, summary.rounds - summary.wins),
        winRate: summary.winRate,
        acs: safeDivide(
          rounds.reduce((sum, round) => sum + round.playerScore, 0),
          Math.max(rounds.length, 1),
        ),
        adr: safeDivide(
          rounds.reduce((sum, round) => sum + round.playerDamage, 0),
          Math.max(rounds.length, 1),
        ),
        color: economyBuyColors[key],
      };
    });
  }, [buyTypeSummary, matchAnalysis]);

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

  useEffect(() => {
    const panel = matchDetailPanelRef.current;
    if (!panel) return;

    const updateOverflowState = () => {
      const viewportHeight = window.innerHeight;
      const panelHeight = panel.scrollHeight;
      const verticalPadding = 32;
      setIsMatchDetailOverflowing(
        panelHeight + verticalPadding > viewportHeight,
      );
    };

    updateOverflowState();

    const resizeObserver = new ResizeObserver(updateOverflowState);
    resizeObserver.observe(panel);

    window.addEventListener("resize", updateOverflowState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverflowState);
    };
  }, [
    loading,
    matchAnalysis,
    activeSection,
    selectedPlayerId,
    selectedRoundNum,
    selectedEventId,
    playbackOpen,
  ]);

  if (!loading && !currentMatch) {
    return (
      <div
        className={`modal-overlay match-detail-modal-overlay ${
          isMatchDetailOverflowing ? "is-overflowing" : "is-centered"
        }`}
        onClick={onClose}
      >
        <div
          ref={matchDetailPanelRef}
          className="modal-panel modal-panel-lg match-detail-modal-panel"
          onClick={(event) => event.stopPropagation()}
        >
          <button className="content-detail-close modal-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
            <span className="content-detail-close-icon modal-close-icon" aria-hidden="true" />
          </button>
          <div className="empty-panel">No se pudo cargar la partida.</div>
        </div>
      </div>
    );
  }

  if (!loading && currentMatch && !playerInfo) {
    return (
      <div
        className={`modal-overlay match-detail-modal-overlay ${
          isMatchDetailOverflowing ? "is-overflowing" : "is-centered"
        }`}
        onClick={onClose}
      >
        <div
          ref={matchDetailPanelRef}
          className="modal-panel modal-panel-lg match-detail-modal-panel"
          onClick={(event) => event.stopPropagation()}
        >
          <button className="content-detail-close modal-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
            <span className="content-detail-close-icon modal-close-icon" aria-hidden="true" />
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
              <span>{event.site ? `Sitio ${event.site}` : "Objetivo"}</span>
            </>
          )}
        </span>
      </button>
    );
  };

  const formatSignedNumber = (value: number) =>
    value > 0 ? `+${formatNumber(value)}` : formatNumber(value);

  const getValueToneClass = (value: number) =>
    value > 0
      ? "match-scoreboard-value-positive"
      : value < 0
        ? "match-scoreboard-value-negative"
        : "";

  const getTeamMetaForStats = (stats: PlayerScoreboardStats) =>
    teamScoreboardGroups.find((group) => group.teamId === stats.teamId) ??
    teamScoreboardGroups[0];

  const renderScoreboardTable = (
    rows: PlayerScoreboardStats[],
    options: { showTeamBadge?: boolean } = {},
  ) => (
    <div className="match-scoreboard-table-wrap">
      <div className="match-scoreboard-table">
        <div className="match-scoreboard-table-head">
          <span>Jugador</span>
          <span>Match Rank</span>
          <span>ACS</span>
          <span>K</span>
          <span>D</span>
          <span>A</span>
          <span>+/-</span>
          <span>K/D</span>
          <span>DDÎ”</span>
          <span>ADR</span>
          <span>HS%</span>
          <span>KAST</span>
          <span>FK</span>
          <span>FD</span>
          <span>MK</span>
        </div>

        {rows.map((row) => {
          const teamMeta = getTeamMetaForStats(row);
          const teamTone = teamMeta?.tone ?? "team-a";
          const playerName = getPlayerShortDisplay(row.player);
          const playerTag = row.player.tagLine?.trim();
          const accountLevel = toNumber(row.player.accountLevel);
          const isSelected = row.puuid === selectedPlayerId;

          return (
            <button
              key={`scoreboard-row-${row.puuid}`}
              type="button"
              className={`match-scoreboard-row is-${teamTone} ${isSelected ? "is-selected" : ""}`}
              onClick={() => handlePlayerSelect(row.puuid)}
              aria-label={`Ver partida desde la perspectiva de ${playerName}`}
              title={`Score: ${formatNumber(row.score)}`}
            >
              <span className="match-scoreboard-cell-player">
                {row.agentIcon ? (
                  <img src={row.agentIcon} alt="" />
                ) : (
                  <i>{row.agentName.charAt(0).toUpperCase()}</i>
                )}
                <span className="match-scoreboard-player-copy">
                  <strong>
                    {playerName}
                    {playerTag ? <small>#{playerTag}</small> : null}
                  </strong>
                  <em>
                    {accountLevel > 0 ? `Nivel ${accountLevel}` : row.agentName}
                  </em>
                </span>
                {options.showTeamBadge && teamMeta && (
                  <span className={`match-scoreboard-team-badge is-${teamTone}`}>
                    {teamMeta.teamLabel}
                  </span>
                )}
              </span>

              <span className="match-scoreboard-rank" title={row.rankName}>
                {row.rankIcon ? (
                  <img src={row.rankIcon} alt={row.rankName} />
                ) : (
                  "-"
                )}
              </span>
              <span className="match-scoreboard-acs">{formatNumber(row.acs)}</span>
              <span>{formatNumber(row.kills)}</span>
              <span>{formatNumber(row.deaths)}</span>
              <span>{formatNumber(row.assists)}</span>
              <span className={getValueToneClass(row.plusMinus)}>
                {formatSignedNumber(row.plusMinus)}
              </span>
              <span
                className={
                  row.kd >= 1
                    ? "match-scoreboard-value-positive"
                    : "match-scoreboard-value-negative"
                }
              >
                {formatNumber(row.kd, 2)}
              </span>
              <span className={getValueToneClass(row.damageDelta)}>
                {row.damageDelta > 0
                  ? `+${formatNumber(row.damageDelta, 1)}`
                  : formatNumber(row.damageDelta, 1)}
              </span>
              <span>{formatNumber(row.adr, 1)}</span>
              <span>{formatPercent(row.hsPct, 1)}</span>
              <span
                className={
                  row.kastPct >= 70
                    ? "match-scoreboard-value-positive"
                    : row.kastPct < 55
                      ? "match-scoreboard-value-negative"
                      : ""
                }
              >
                {formatPercent(row.kastPct, 1)}
              </span>
              <span>{formatNumber(row.firstKills)}</span>
              <span>{formatNumber(row.firstDeaths)}</span>
              <span>{formatNumber(row.multikillRounds)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDuelPlayer = (player: RawPlayer) => {
    const agent = getAgentMeta(player, agentById, agentNameMap);
    return (
      <span className="match-duel-player">
        {agent.icon ? <img src={agent.icon} alt="" /> : <i>{agent.name.charAt(0)}</i>}
        <strong>{getPlayerShortDisplay(player)}</strong>
      </span>
    );
  };

  const renderDuelInlineDetail = (cell: PlayerDuelCell) => (
    <div className="match-duel-inline-detail">
      <button
        type="button"
        className="content-detail-close modal-close match-duel-inline-close"
        aria-label="Cerrar detalle"
        onClick={() => {
          setSelectedDuelKey(null);
          setSelectedEventId(null);
        }}
      >
        <span className="content-detail-close-icon modal-close-icon" aria-hidden="true" />
      </button>
      <div className="match-duel-inline-events">
        {cell.events.length === 0 ? (
          <div className="empty-chart">No hay kills entre estos jugadores.</div>
        ) : (
          cell.events.map((event) => (
            <button
              key={`duel-event-${event.id}`}
              type="button"
              className={`match-round-event-btn ${
                selectedDuelDetailEvent?.id === event.id ? "is-active" : ""
              }`}
              onClick={() => {
                setSelectedRoundNum(event.roundNum);
                setSelectedEventId(event.id);
              }}
            >
              <span className="match-round-event-time">
                {roundLabel(event.roundNum)} · {toSecondsLabel(event.timeMs)}
              </span>
              <span className="match-action-text">
                {event.kind === "kill"
                  ? `${event.killerName} eliminó a ${event.victimName}`
                  : getEventDescription(event)}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="match-duel-inline-map">
        <MatchEventMapCanvas
          mapName={mapName}
          mapImageUrl={mapImageUrl}
          selectedEvent={selectedDuelDetailEvent}
          eventMapState={selectedDuelMapState}
          mapTransform={mapTransform}
        />
      </div>
    </div>
  );

  const renderDuelHighlight = (
    title: string,
    cell: PlayerDuelCell | null,
    tone: "top" | "team-a" | "team-b",
  ) => {
    const openDuel = () => {
      if (cell) setSelectedDuelKey(cell.key);
    };

    return (
      <article
        className={`match-duel-highlight-card match-duel-highlight-card--${tone} ${
          cell?.key === selectedDuelKey ? "is-selected" : ""
        } ${cell ? "is-clickable" : ""}`}
        role={cell ? "button" : undefined}
        tabIndex={cell ? 0 : undefined}
        onClick={openDuel}
        onKeyDown={(event) => {
          if (!cell) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDuel();
          }
        }}
      >
        <span>{title}</span>
        {cell ? (
          <div className="match-duel-highlight-content">
            <span className="match-duel-highlight-player">
              {renderDuelPlayer(cell.teamAPlayer)}
            </span>
            <strong className="match-duel-highlight-score">
              {cell.teamAKillsOnB} - {cell.teamBKillsOnA}
            </strong>
            <span className="match-duel-highlight-player">
              {renderDuelPlayer(cell.teamBPlayer)}
            </span>
          </div>
        ) : (
          <p>Sin datos suficientes</p>
        )}
      </article>
    );
  };

  const matchDetailHero = matchAnalysis ? (
    <header className="match-detail-hero">
      <div className="match-detail-hero-copy">
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

        <div className="match-player-identity">
          <strong>{getPlayerDisplay(playerInfo)}</strong>
          <span>
            {playerRankIcon && (
              <img
                src={playerRankIcon}
                alt=""
                className="match-rank-icon-inline"
              />
            )}
            {playerRankName}
          </span>
        </div>

        <div className="match-detail-meta-row">
          <span className={`meta-pill match-pill-${resultState}`}>
            {resultState === "draw"
              ? "Empate"
              : resultState === "win"
                ? "Victoria"
                : "Derrota"}
          </span>
          <span className="meta-pill">{matchAnalysis.totalRounds} rondas</span>
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
            {scoreState.selectedTeamRounds} - {scoreState.opponentTeamRounds}
          </strong>
        </div>

        <div className="match-score-split">
          <div>
            <span>K / D / A</span>
            <strong>
              {matchAnalysis.kills}/{matchAnalysis.deaths}/{matchAnalysis.assists}
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
            <strong>{formatPercent(matchAnalysis.winRoundParticipationPct, 1)}</strong>
          </div>
        </div>

        <div className="match-rank-line">
          <span className="match-mvp-line">
            MVP:
            {mvpAgentIcon && (
              <img
                src={mvpAgentIcon}
                alt=""
                className="match-rank-icon-inline"
              />
            )}
            {getPlayerDisplay(mvp)}
          </span>
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
  ) : null;


  return (
    <div
      className={`modal-overlay match-detail-modal-overlay ${
        isMatchDetailOverflowing ? "is-overflowing" : "is-centered"
      }`}
      onClick={onClose}
    >
      <div
        ref={matchDetailPanelRef}
        className="modal-panel modal-panel-lg match-detail-modal-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="content-detail-close modal-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
          <span className="content-detail-close-icon modal-close-icon" aria-hidden="true" />
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
                  {matchDetailHero}

                  <MatchMomentumPanel
                    momentum={momentumAnalysis}
                    teamAId={teamAId}
                    teamBId={teamBId}
                    teamALabel={teamALabel}
                    teamBLabel={teamBLabel}
                  />

                  <MatchRoundResultTimeline
                    rounds={matchAnalysis.rounds}
                    playersByTeam={playersByTeam}
                    currentMatch={currentMatch}
                    bestRoundNum={matchAnalysis.bestRound?.roundNum}
                  />

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
                      <span>Lado más sólido</span>
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
                        ECO {matchAnalysis.ecoWins}/{matchAnalysis.ecoRounds} · SEMIECO{" "}
                        {buyTypeSummary.semiEco.wins}/{buyTypeSummary.semiEco.rounds} · FULL{" "}
                        {matchAnalysis.fullBuyWins}/{matchAnalysis.fullBuyRounds}
                      </strong>
                    </article>
                    <article>
                      <span>KAST</span>
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
                  const isKeyRound =
                    round.roundNum === matchAnalysis.bestRound?.roundNum;
                  return (
                    <button
                      key={`strip-${round.roundNum}`}
                      type="button"
                      className={`match-round-chip ${round.didWin ? "is-win" : "is-loss"} ${isOpen ? "is-open" : ""} ${isKeyRound ? "is-key-round" : ""}`}
                      onClick={() => handleRoundSelect(round)}
                      aria-label={`Abrir ronda ${round.roundNum + 1}, ${round.didWin ? "ganada" : "perdida"}, ${round.playerKills} kills`}
                      aria-current={isOpen ? "true" : undefined}
                      aria-pressed={isOpen}
                    >
                      <span className="match-round-chip-number">
                        {round.roundNum + 1}
                      </span>
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
                    <h3 className="panel-title">Matriz de duelos</h3>
                    <p className="panel-subtitle">
                      Balance directo entre jugadores de Team A y Team B.
                    </p>
                  </div>
                </div>

                <div className="match-duel-highlights">
                  {renderDuelHighlight("Top Rivalry", duelHighlights.top, "top")}
                  {renderDuelHighlight("Mismatch A", duelHighlights.teamA, "team-a")}
                  {renderDuelHighlight("Mismatch B", duelHighlights.teamB, "team-b")}
                </div>
                {[duelHighlights.top, duelHighlights.teamA, duelHighlights.teamB]
                  .find((cell) => cell?.key === selectedDuelKey) &&
                  renderDuelInlineDetail(
                    [duelHighlights.top, duelHighlights.teamA, duelHighlights.teamB].find(
                      (cell) => cell?.key === selectedDuelKey,
                    )!,
                  )}

                <div className="match-duel-summary-grid">
                  <article>
                    <span>Team A kills</span>
                    <strong>{duelSummary.teamAKills}</strong>
                  </article>
                  <article>
                    <span>Team B kills</span>
                    <strong>{duelSummary.teamBKills}</strong>
                  </article>
                  <article>
                    <span>Duelos Team A</span>
                    <strong>{duelSummary.teamAWon}</strong>
                  </article>
                  <article>
                    <span>Duelos Team B</span>
                    <strong>{duelSummary.teamBWon}</strong>
                  </article>
                  <article>
                    <span>Empates</span>
                    <strong>{duelSummary.ties}</strong>
                  </article>
                </div>

                <div className="match-duel-toolbar">
                  <div className="match-round-legend" aria-label="Leyenda de duelos">
                    <span className="match-round-legend-item">
                      <i className="match-round-legend-dot is-win" /> Gana Team A
                    </span>
                    <span className="match-round-legend-item">
                      <i className="match-round-legend-dot is-loss" /> Gana Team B
                    </span>
                    <span className="match-round-legend-item">
                      <b className="match-round-legend-symbol is-key">=</b> Empate
                    </span>
                    <span className="match-round-legend-item">
                      <b className="match-round-legend-symbol">—</b> Sin duelos
                    </span>
                  </div>

                  <div className="match-event-filters" aria-label="Filtros de matriz de duelos">
                    {[
                      ["all", "Todos"],
                      ["withKills", "Con kills"],
                      ["teamA", "Ventaja Team A"],
                      ["teamB", "Ventaja Team B"],
                      ["ties", "Empates"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={duelMatrixFilter === key ? "is-active" : ""}
                        onClick={() => setDuelMatrixFilter(key as DuelMatrixFilter)}
                        aria-pressed={duelMatrixFilter === key}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <section className="match-duel-matrix-panel">
                    <div className="match-duel-matrix-scroll">
                      <div
                        className="match-duel-matrix"
                        style={{
                          gridTemplateColumns: `minmax(92px, 0.85fr) repeat(${Math.max(
                            visibleDuelTeamBPlayers.length,
                            1,
                          )}, minmax(0, 1fr))`,
                        }}
                      >
                        <div className="match-duel-matrix-corner">Team A \ Team B</div>
                        {visibleDuelTeamBPlayers.map((player) => (
                          <button
                            key={`duel-col-${cleanId(player.puuid)}`}
                            type="button"
                            className="match-duel-column-header"
                            onClick={() => handlePlayerSelect(cleanId(player.puuid))}
                          >
                            {renderDuelPlayer(player)}
                          </button>
                        ))}

                        {visibleDuelTeamAPlayers.map((teamAPlayer) => {
                          const teamAId = cleanId(teamAPlayer.puuid);
                          return (
                            <Fragment key={`duel-row-${teamAId}`}>
                              <button
                                type="button"
                                className="match-duel-row-header"
                                onClick={() => handlePlayerSelect(teamAId)}
                              >
                                {renderDuelPlayer(teamAPlayer)}
                              </button>
                              {visibleDuelTeamBPlayers.map((teamBPlayer) => {
                                const key = `${teamAId}:${cleanId(teamBPlayer.puuid)}`;
                                const cell = duelCellByKey.get(key);
                                const leader = cell?.leader ?? "tie";
                                const isSelected = activeDuel?.key === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    className={`match-duel-cell ${
                                      !cell || cell.total === 0
                                        ? "is-empty"
                                        : leader === "teamA"
                                          ? "is-team-a"
                                          : leader === "teamB"
                                            ? "is-team-b"
                                            : "is-tie"
                                    } ${isSelected ? "is-selected" : ""}`}
                                    onClick={() => {
                                      setSelectedDuelKey(key);
                                      const firstEvent = cell?.events[0];
                                      if (firstEvent) {
                                        setSelectedRoundNum(firstEvent.roundNum);
                                        setSelectedEventId(firstEvent.id);
                                      }
                                    }}
                                    title={
                                      cell
                                        ? `${getPlayerShortDisplay(cell.teamAPlayer)} ${cell.teamAKillsOnB} - ${cell.teamBKillsOnA} ${getPlayerShortDisplay(cell.teamBPlayer)}`
                                        : "Sin duelos"
                                    }
                                  >
                                    {cell && cell.total > 0 ? (
                                      <span className="match-duel-score-pill">
                                        <strong>{cell.teamAKillsOnB}</strong>
                                        <em>{cell.teamBKillsOnA}</em>
                                      </span>
                                    ) : (
                                      <span className="match-duel-empty">—</span>
                                    )}
                                  </button>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                </section>
              </section>
            )}
            {activeSection === "classification" && (
            <section
              className="match-classification-section"
              role="region"
              aria-label={activeSectionLabel}
            >
            <div className="match-scoreboard-panel">
              <div className="panel-header match-scoreboard-panel-header">
                <div>
                  <h3 className="panel-title">Scoreboard</h3>
                  <p className="panel-subtitle">
                    Cambia la perspectiva pulsando cualquier jugador.
                  </p>
                </div>

                <div className="match-scoreboard-controls">
                <div
                  className="match-scoreboard-mode-toggle"
                  aria-label="Modo de visualización del scoreboard"
                >
                  <button
                    type="button"
                    className={teamScoreboardMode === "grouped" ? "is-active" : ""}
                    onClick={() => setTeamScoreboardMode("grouped")}
                    aria-pressed={teamScoreboardMode === "grouped"}
                  >
                    Separado por equipos
                  </button>
                  <button
                    type="button"
                    className={teamScoreboardMode === "combined" ? "is-active" : ""}
                    onClick={() => setTeamScoreboardMode("combined")}
                    aria-pressed={teamScoreboardMode === "combined"}
                  >
                    Vista global
                  </button>
                </div>
                <div
                  className="match-scoreboard-side-toggle"
                  aria-label="Filtro de lado del scoreboard"
                >
                  {[
                    ["all", "Ambos"],
                    ["attack", "Ataque"],
                    ["defense", "Defensa"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={scoreboardSideFilter === key ? "is-active" : ""}
                      onClick={() => setScoreboardSideFilter(key as ScoreboardSideFilter)}
                      aria-pressed={scoreboardSideFilter === key}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                </div>
              </div>

              <MatchLoadoutTimeline
                data={roundTeamLoadoutTimeline}
                teamALabel={teamScoreboardGroups[0]?.teamLabel ?? "Team A"}
                teamBLabel={teamScoreboardGroups[1]?.teamLabel ?? "Team B"}
              />

              <div className="match-scoreboard-teams">
                {teamScoreboardMode === "grouped" ? (
                  teamScoreboardGroups.map((group) => (
                    <div
                      key={`scoreboard-${group.teamId}`}
                      className={`match-scoreboard-team-block is-${group.tone}`}
                    >
                      <div
                        className={`match-scoreboard-team-header is-${group.tone}`}
                      >
                        <strong>{group.teamLabel}</strong>
                        <span>Avg. Rank</span>
                        <span
                          className="match-scoreboard-rank-summary"
                          title={group.averageRank.name}
                        >
                          {group.averageRank.icon ? (
                            <img
                              src={group.averageRank.icon}
                              alt={group.averageRank.name}
                            />
                          ) : null}
                          {group.averageRank.name}
                        </span>
                      </div>
                      {renderScoreboardTable(group.rows)}
                    </div>
                  ))
                ) : (
                  <div className="match-scoreboard-team-block is-combined">
                    <div className="match-scoreboard-combined-summary">
                      {teamScoreboardGroups.map((group) => (
                        <span key={`combined-rank-${group.teamId}`}>
                          <strong>{group.teamLabel} Avg. Rank:</strong>{" "}
                          {group.averageRank.icon ? (
                            <img
                              src={group.averageRank.icon}
                              alt={group.averageRank.name}
                            />
                          ) : null}
                          {group.averageRank.name}
                        </span>
                      ))}
                    </div>
                    {renderScoreboardTable(combinedScoreboardRows, {
                      showTeamBadge: true,
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="match-side-comparison-zone">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Ataque vs Defensa</h3>
                  <p className="panel-subtitle">
                    Ataque y defensa derivados por orden real de rondas.
                  </p>
                </div>
              </div>

              <div className="match-side-cards">
                {matchAnalysis.sideSummary.map((side) => (
                  <article key={side.key} className="match-side-card">
                    <header>
                      <h4>{side.label}</h4>
                      <strong>{formatPercent(side.winRate, 1)}</strong>
                    </header>

                    <div className="match-side-grid">
                      <span>Rondas ganadas / jugadas</span>
                      <strong>
                        {side.wins}/{side.rounds}
                      </strong>

                      <span>K / D / A</span>
                      <strong>
                        {side.kills}/{side.deaths}/{side.assists}
                      </strong>

                      <span>KD</span>
                      <strong>{formatNumber(side.kd, 2)}</strong>

                      <span>KPR</span>
                      <strong>{formatNumber(side.killsPerRound, 2)}</strong>

                      <span>ACS</span>
                      <strong>
                        {formatNumber(safeDivide(side.score, Math.max(side.rounds, 1)))}
                      </strong>

                      <span>ADR aprox.</span>
                      <strong>
                        {formatNumber(
                          safeDivide(
                            matchAnalysis.rounds
                              .filter((round) => round.side === side.key)
                              .reduce((sum, round) => sum + round.playerDamage, 0),
                            Math.max(side.rounds, 1),
                          ),
                          1,
                        )}
                      </strong>

                      <span>Score total</span>
                      <strong>{formatNumber(side.score)}</strong>

                      <span>Gasto medio</span>
                      <strong>{formatNumber(side.avgSpent)}</strong>
                    </div>
                  </article>
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

              <div className="match-team-economy-grid">
                {teamEconomySummaries.map((team) => (
                  <article key={team.key} className="match-team-economy-card">
                    <header>
                      <h4>{team.label}</h4>
                      <span className="match-team-economy-header-metric">
                        Loadout medio <strong>{formatNumber(team.avgLoadout)}</strong>
                      </span>
                    </header>
                    <div>
                      <span>Loadout total</span>
                      <strong>{formatNumber(team.totalLoadout)}</strong>
                    </div>
                    <div>
                      <span>Gasto total</span>
                      <strong>{formatNumber(team.totalSpent)}</strong>
                    </div>
                    <div className="match-team-economy-buy-row">
                      {(["eco", "semiEco", "fullBuy"] as const).map((key) => (
                        <span key={`${team.key}-${key}`}>
                          {economyBuyLabels[key]} {team.buyTypes[key].wins}/{team.buyTypes[key].rounds}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="match-buy-type-grid">
                <article>
                  <span>ECO</span>
                  <strong>
                    {buyTypeSummary.eco.wins}/{buyTypeSummary.eco.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.eco.winRate, 1)}</small>
                </article>
                <article>
                  <span>SEMIECO</span>
                  <strong>
                    {buyTypeSummary.semiEco.wins}/{buyTypeSummary.semiEco.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.semiEco.winRate, 1)}</small>
                </article>
                <article>
                  <span>FULL</span>
                  <strong>
                    {buyTypeSummary.fullBuy.wins}/{buyTypeSummary.fullBuy.rounds} ganadas
                  </strong>
                  <small>{formatPercent(buyTypeSummary.fullBuy.winRate, 1)}</small>
                </article>
              </div>

              <div className="match-economy-chart-grid">
                <article className="match-economy-chart-card">
                  <header>
                    <h4>Distribución por compra</h4>
                    <span>Comparativa por equipo</span>
                  </header>
                  <div className="match-economy-chart">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={teamEconomyDistributionData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="name" stroke="#9ea8b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ea8b8" tickLine={false} axisLine={false} allowDecimals={false} />
                        <ReTooltip
                          cursor={{ fill: "rgba(255,255,255,0.05)" }}
                          contentStyle={{
                            background: "#11151c",
                            border: "1px solid rgba(255,70,85,0.35)",
                            borderRadius: 10,
                            color: "#f4f7fb",
                          }}
                        />
                        <Bar dataKey="teamA" name={teamEconomySummaries[0]?.label ?? "Team A"} fill="#46c878" radius={[8, 8, 3, 3]} />
                        <Bar dataKey="teamB" name={teamEconomySummaries[1]?.label ?? "Team B"} fill="#ff4655" radius={[8, 8, 3, 3]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="match-economy-chart-card">
                  <header>
                    <h4>Rendimiento por compra</h4>
                    <span>Winrate y ACS aproximado</span>
                  </header>
                  <div className="match-economy-performance-list">
                    {economyChartData.map((entry) => (
                      <div key={`economy-performance-${entry.key}`} className="match-economy-performance-row">
                        <span>{entry.name}</span>
                        <div>
                          <i
                            style={{
                              width: `${Math.max(4, Math.min(100, entry.winRate))}%`,
                              background: entry.color,
                            }}
                          />
                        </div>
                        <strong>{formatPercent(entry.winRate, 1)}</strong>
                        <small>{formatNumber(entry.acs)} ACS</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="match-economy-chart-card match-economy-chart-card--wide">
                  <header>
                    <h4>Evolución económica</h4>
                    <span>Loadout de ambos equipos ronda a ronda</span>
                  </header>
                  <div className="match-economy-chart">
                    <ResponsiveContainer width="100%" height={230}>
                      <LineChart data={teamEconomyTimelineData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="round" stroke="#9ea8b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ea8b8" tickLine={false} axisLine={false} />
                        <ReTooltip
                          contentStyle={{
                            background: "#11151c",
                            border: "1px solid rgba(255,70,85,0.35)",
                            borderRadius: 10,
                            color: "#f4f7fb",
                          }}
                          labelFormatter={(label) => `Ronda ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="teamA"
                          name={teamEconomySummaries[0]?.label ?? "Team A"}
                          stroke="#46c878"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="teamB"
                          name={teamEconomySummaries[1]?.label ?? "Team B"}
                          stroke="#ff4655"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>

              <EconomyOptimalPanel
                analysis={economyEfficiencyAnalysis}
                momentum={momentumAnalysis}
                teamALabel={teamALabel}
                teamBLabel={teamBLabel}
              />
            </section>
            )}
            </div>

          </div>
        )}
      </div>
      {playbackOpen && createPortal(
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
              <button type="button" className="content-detail-close modal-close" aria-label="Cerrar reproducción" onClick={closePlayback}>
                <span className="content-detail-close-icon modal-close-icon" aria-hidden="true" />
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
      , document.body)}
    </div>
  );
}

