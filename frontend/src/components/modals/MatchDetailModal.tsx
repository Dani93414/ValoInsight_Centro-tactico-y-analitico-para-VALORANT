import { useMemo, useState } from "react";
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
  headshotPct: number;
  survivalRounds: number;
  survivalPct: number;
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
  team: "ally" | "enemy" | "neutral";
  kind: "player" | "victim" | "objective";
  isTarget: boolean;
};

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

  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(
    () => new Set(),
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
    return playersByPuuid.get(playerId) ?? null;
  }, [playersByPuuid, playerId]);

  const playerTeam = cleanId(playerInfo?.teamId);
  const teamInfo =
    (currentMatch?.teams ?? []).find((team) => team.teamId === playerTeam) ??
    null;

  const playerAgentId = cleanId(playerInfo?.characterId);
  const playerAgent = playerAgentId ? agentById.get(playerAgentId) : undefined;
  const playerAgentName =
    playerAgent?.displayName ??
    agentNameMap[playerAgentId] ??
    "Agente desconocido";
  const playerAgentIcon =
    playerAgent?.displayIconSmall ?? playerAgent?.displayIcon ?? null;

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
        (stat) => cleanId(stat.puuid) === playerId,
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

        if (victimId === playerId) {
          playerDeaths += 1;
        }

        const assistants = parseAssistants(kill.assistants);
        if (killerId !== playerId && assistants.includes(playerId)) {
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

        const isPlayerKill = killerId === playerId;
        const isPlayerDeath = victimId === playerId;
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
      headshotPct,
      survivalRounds,
      survivalPct,
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
    playerId,
    playersByPuuid,
    teamByPuuid,
    agentById,
    weaponById,
  ]);

  const allRoundEvents = useMemo(
    () => matchAnalysis?.rounds.flatMap((round) => round.events) ?? [],
    [matchAnalysis],
  );

  const selectedEvent = useMemo(
    () => allRoundEvents.find((event) => event.id === selectedEventId) ?? null,
    [allRoundEvents, selectedEventId],
  );

  const eventMapState = useMemo(() => {
    if (!selectedEvent) {
      return {
        markers: [] as EventMapMarker[],
        hasSnapshot: false,
      };
    }

    const markers: EventMapMarker[] = [];
    const usedIds = new Set<string>();

    const pushMarker = (marker: EventMapMarker) => {
      if (usedIds.has(marker.id)) return;
      usedIds.add(marker.id);
      markers.push(marker);
    };

    const addSnapshotMarker = (entry: RawPlayerLocation, index: number) => {
      const position = transformLocation(entry.location, mapTransform);
      if (!position) return;

      const puuid = cleanId(entry.puuid);
      const player = puuid ? playersByPuuid.get(puuid) : undefined;
      const agent = cleanId(player?.characterId)
        ? agentById.get(cleanId(player?.characterId))
        : undefined;

      const markerId = `snapshot-${selectedEvent.id}-${puuid || index}`;
      const teamId = puuid ? cleanId(player?.teamId) : "";

      pushMarker({
        id: markerId,
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
        isTarget: puuid === playerId,
      });
    };

    selectedEvent.playerLocations.forEach(addSnapshotMarker);

    if (selectedEvent.kind === "kill") {
      const victimPos = transformLocation(
        selectedEvent.victimLocation,
        mapTransform,
      );
      if (victimPos) {
        const victim = cleanId(selectedEvent.victim)
          ? playersByPuuid.get(cleanId(selectedEvent.victim))
          : undefined;
        const victimTeamId = cleanId(victim?.teamId);
        const victimAgent = cleanId(victim?.characterId)
          ? agentById.get(cleanId(victim?.characterId))
          : undefined;

        pushMarker({
          id: `victim-${selectedEvent.id}`,
          x: victimPos.x,
          y: victimPos.y,
          label: `Posición de ${selectedEvent.victimName}`,
          icon:
            victimAgent?.displayIconSmall ??
            victimAgent?.displayIcon ??
            undefined,
          team:
            !victimTeamId || !playerTeam
              ? "neutral"
              : victimTeamId === playerTeam
                ? "ally"
                : "enemy",
          kind: "victim",
          isTarget: cleanId(selectedEvent.victim) === playerId,
        });
      }
    }

    if (selectedEvent.kind === "plant" || selectedEvent.kind === "defuse") {
      const objectivePos = transformLocation(
        selectedEvent.location,
        mapTransform,
      );
      if (objectivePos) {
        pushMarker({
          id: `${selectedEvent.kind}-${selectedEvent.id}-objective`,
          x: objectivePos.x,
          y: objectivePos.y,
          label:
            selectedEvent.kind === "plant"
              ? `Plant${selectedEvent.site ? ` en ${selectedEvent.site}` : ""}`
              : "Defuse",
          team: "neutral",
          kind: "objective",
          isTarget: false,
        });
      }
    }

    return {
      markers,
      hasSnapshot: selectedEvent.playerLocations.length > 0,
    };
  }, [
    selectedEvent,
    mapTransform,
    playersByPuuid,
    playerTeam,
    playerId,
    agentById,
  ]);

  const secondaryLine = useMemo(() => {
    const start = formatDateTime(currentMatch?.matchInfo?.gameStartMillis);
    const mode = cleanId(currentMatch?.matchInfo?.gameMode) || "-";
    const queue = cleanId(currentMatch?.matchInfo?.queueId) || "-";
    const duration = toGameDurationLabel(
      currentMatch?.matchInfo?.gameLengthMillis,
    );
    return [start, mode, queue, duration].filter(Boolean).join(" · ");
  }, [currentMatch]);

  const sideBest = useMemo(() => {
    if (!matchAnalysis) return null;
    return [...matchAnalysis.sideSummary]
      .filter((side) => side.rounds > 0)
      .sort((a, b) => b.winRate - a.winRate || b.kda - a.kda)[0];
  }, [matchAnalysis]);

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

  const handleRoundToggle = (roundNum: number, firstEventId?: string) => {
    setExpandedRounds((previous) => {
      const next = new Set(previous);
      if (next.has(roundNum)) {
        next.delete(roundNum);
      } else {
        next.add(roundNum);
      }
      return next;
    });

    if (!selectedEventId && firstEventId) {
      setSelectedEventId(firstEventId);
    }
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
          <div className="loading-card">
            <div className="loading-spinner" />
            <h2>Cargando partida</h2>
          </div>
        ) : (
          <div className="match-detail-shell">
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

                <p className="stats-subtitle">{secondaryLine}</p>

                <div className="match-detail-meta-row">
                  <span
                    className={`meta-pill ${teamInfo?.won ? "match-pill-win" : "match-pill-loss"}`}
                  >
                    {teamInfo?.won ? "Victoria" : "Derrota"}
                  </span>
                  <span className="meta-pill">
                    {matchAnalysis.totalRounds} rondas
                  </span>
                  <span className="meta-pill">{playerAgentName}</span>
                </div>
              </div>

              <div className="match-detail-scoreboard">
                <div className="match-score-main">
                  <span className="match-score-label">Resultado</span>
                  <strong className="match-score-value">
                    {teamInfo?.roundsWon ?? 0} - {teamInfo?.roundsLost ?? 0}
                  </strong>
                </div>

                <div className="match-score-split">
                  <div>
                    <span>Tu KDA</span>
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
                    <span>Score</span>
                    <strong>{formatNumber(matchAnalysis.score)}</strong>
                  </div>
                  <div>
                    <span>MVP</span>
                    <strong>{getPlayerDisplay(mvp)}</strong>
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
                </div>
              </div>
            </header>

            <section className="match-round-strip">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Timeline de rondas</h3>
                  <p className="panel-subtitle">
                    Secuencia de rondas con victoria/derrota y rounds con kill.
                  </p>
                </div>
              </div>

              <div className="match-round-strip-track">
                {matchAnalysis.rounds.map((round) => {
                  const isOpen = expandedRounds.has(round.roundNum);
                  return (
                    <button
                      key={`strip-${round.roundNum}`}
                      type="button"
                      className={`match-round-chip ${round.didWin ? "is-win" : "is-loss"} ${isOpen ? "is-open" : ""}`}
                      onClick={() =>
                        handleRoundToggle(round.roundNum, round.events[0]?.id)
                      }
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
            </section>

            <section className="match-impact-layout">
              <article className="match-impact-main">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Impacto personal</h3>
                    <p className="panel-subtitle">
                      Rendimiento real del jugador en esta partida.
                    </p>
                  </div>
                </div>

                <div className="match-impact-metrics">
                  <div className="match-impact-metric">
                    <span>Kills / ronda</span>
                    <strong>
                      {formatNumber(matchAnalysis.killsPerRound, 2)}
                    </strong>
                  </div>
                  <div className="match-impact-metric">
                    <span>Headshot %</span>
                    <strong>
                      {formatPercent(matchAnalysis.headshotPct, 1)}
                    </strong>
                  </div>
                  <div className="match-impact-metric">
                    <span>Supervivencia</span>
                    <strong>
                      {formatPercent(matchAnalysis.survivalPct, 1)}
                    </strong>
                  </div>
                  <div className="match-impact-metric">
                    <span>Participación en rondas ganadas</span>
                    <strong>
                      {formatPercent(matchAnalysis.winRoundParticipationPct, 1)}
                    </strong>
                  </div>
                </div>

                <div className="match-impact-bars">
                  <div className="impact-bar-row">
                    <span>
                      Rondas con kill ({matchAnalysis.roundsWithKills}/
                      {matchAnalysis.totalRounds})
                    </span>
                    <div className="impact-bar-track">
                      <div
                        className="impact-bar-fill"
                        style={{
                          width: `${safeDivide(matchAnalysis.roundsWithKills, Math.max(matchAnalysis.totalRounds, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="impact-bar-row">
                    <span>
                      Rondas ganadas con impacto (
                      {matchAnalysis.roundsWonWithImpact}/
                      {matchAnalysis.roundsWon})
                    </span>
                    <div className="impact-bar-track">
                      <div
                        className="impact-bar-fill"
                        style={{
                          width: `${matchAnalysis.winRoundParticipationPct}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>

              <aside className="match-impact-aside">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Momentos clave</h3>
                    <p className="panel-subtitle">
                      Insights derivados de eventos reales del match.
                    </p>
                  </div>
                </div>

                <div className="match-insights-list">
                  {matchAnalysis.insights.length === 0 ? (
                    <div className="empty-chart">Sin insights suficientes.</div>
                  ) : (
                    matchAnalysis.insights.map((insight, index) => (
                      <div
                        key={`insight-${index}`}
                        className="match-insight-item"
                      >
                        {insight}
                      </div>
                    ))
                  )}
                </div>

                <div className="match-weapon-summary">
                  <h4>Armas por kills</h4>
                  {matchAnalysis.topWeapons.length === 0 ? (
                    <div className="empty-chart">Sin kills por arma.</div>
                  ) : (
                    matchAnalysis.topWeapons.map((weapon) => (
                      <div key={weapon.id} className="match-weapon-item">
                        <div className="match-weapon-ident">
                          {weapon.icon ? (
                            <img src={weapon.icon} alt={weapon.name} />
                          ) : (
                            <span className="match-weapon-fallback">
                              {weapon.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span>{weapon.name}</span>
                        </div>
                        <strong>{weapon.kills} K</strong>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </section>

            <section className="match-side-comparison-zone">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Comparativa por bandos</h3>
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

              <div className="match-economy-ribbon">
                <span>
                  Gasto total:{" "}
                  <strong>{formatNumber(matchAnalysis.totalSpent)}</strong>
                </span>
                <span>
                  Gasto medio/ronda:{" "}
                  <strong>{formatNumber(matchAnalysis.avgSpent)}</strong>
                </span>
                <span>
                  Loadout medio:{" "}
                  <strong>{formatNumber(matchAnalysis.avgLoadout)}</strong>
                </span>
                <span>
                  Eco rounds ganadas:{" "}
                  <strong>
                    {matchAnalysis.ecoWins}/{matchAnalysis.ecoRounds}
                  </strong>
                </span>
                <span>
                  Full buy ganadas:{" "}
                  <strong>
                    {matchAnalysis.fullBuyWins}/{matchAnalysis.fullBuyRounds}
                  </strong>
                </span>
              </div>
            </section>

            <section className="match-rounds-map-layout">
              <article className="match-rounds-zone">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Rondas (colapsadas)</h3>
                    <p className="panel-subtitle">
                      Abre cada ronda para ver resultado, eventos y tu impacto.
                    </p>
                  </div>
                </div>

                <div className="match-round-accordion-list">
                  {matchAnalysis.rounds.map((round) => {
                    const isOpen = expandedRounds.has(round.roundNum);
                    return (
                      <article
                        key={`round-card-${round.roundNum}`}
                        className={`match-round-accordion ${isOpen ? "is-open" : ""}`}
                      >
                        <button
                          type="button"
                          className="match-round-accordion-trigger"
                          onClick={() =>
                            handleRoundToggle(
                              round.roundNum,
                              round.events[0]?.id,
                            )
                          }
                          aria-expanded={isOpen}
                        >
                          <div className="round-trigger-main">
                            <strong>{roundLabel(round.roundNum)}</strong>
                            <small>
                              {round.side === "attack" ? "Ataque" : "Defensa"} ·{" "}
                              {round.roundResult}
                            </small>
                          </div>

                          <div className="round-trigger-summary">
                            <span
                              className={
                                round.didWin ? "text-positive" : "text-negative"
                              }
                            >
                              {round.didWin ? "Ganada" : "Perdida"}
                            </span>
                            <span>{round.playerKills}K</span>
                            <span>{round.playerDeaths}D</span>
                            <span>{round.playerAssists}A</span>
                            {round.hadPlant && <em>Plant</em>}
                            {round.hadDefuse && <em>Defuse</em>}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="match-round-accordion-body">
                            <div className="match-round-player-row">
                              <span>
                                Score{" "}
                                <strong>
                                  {formatNumber(round.playerScore)}
                                </strong>
                              </span>
                              <span>
                                Daño{" "}
                                <strong>
                                  {formatNumber(round.playerDamage)}
                                </strong>
                              </span>
                              <span>
                                Gasto{" "}
                                <strong>
                                  {formatNumber(round.playerSpent)}
                                </strong>
                              </span>
                              <span>
                                Loadout{" "}
                                <strong>
                                  {formatNumber(round.playerLoadout)}
                                </strong>
                              </span>
                            </div>

                            <div className="match-round-events">
                              {round.events.length === 0 ? (
                                <div className="empty-chart">
                                  Sin eventos relevantes en esta ronda.
                                </div>
                              ) : (
                                round.events.map((event) => {
                                  const isActive = selectedEventId === event.id;

                                  if (event.kind === "kill") {
                                    return (
                                      <button
                                        key={event.id}
                                        type="button"
                                        className={`match-round-event-btn ${isActive ? "is-active" : ""}`}
                                        onClick={() =>
                                          setSelectedEventId(event.id)
                                        }
                                      >
                                        <div className="match-round-event-top">
                                          <span className="match-round-event-time">
                                            {toSecondsLabel(event.timeMs)}
                                          </span>
                                          <strong>
                                            {event.killerName} elimino a{" "}
                                            {event.victimName}
                                          </strong>
                                        </div>

                                        <div className="match-round-event-meta">
                                          {event.weaponIcon && (
                                            <img
                                              src={event.weaponIcon}
                                              alt={event.weaponName}
                                            />
                                          )}
                                          <span>{event.weaponName}</span>
                                          {event.isPlayerKill && (
                                            <span className="meta-pill">
                                              Tu kill
                                            </span>
                                          )}
                                          {event.isPlayerDeath && (
                                            <span className="meta-pill">
                                              Tu muerte
                                            </span>
                                          )}
                                          {event.isOpening && (
                                            <span className="meta-pill">
                                              Opening
                                            </span>
                                          )}
                                          {event.isTrade && (
                                            <span className="meta-pill">
                                              Trade
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  }

                                  return (
                                    <button
                                      key={event.id}
                                      type="button"
                                      className={`match-round-event-btn match-round-event-btn-objective ${isActive ? "is-active" : ""}`}
                                      onClick={() =>
                                        setSelectedEventId(event.id)
                                      }
                                    >
                                      <div className="match-round-event-top">
                                        <span className="match-round-event-time">
                                          {toSecondsLabel(event.timeMs)}
                                        </span>
                                        <strong>
                                          {event.kind === "plant"
                                            ? "Plant"
                                            : "Defuse"}{" "}
                                          · {event.actorName}
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
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </article>

              <aside className="match-event-map-zone">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Evento en mapa</h3>
                    <p className="panel-subtitle">
                      Click en un evento para ver posiciones instantaneas.
                    </p>
                  </div>
                </div>

                {!selectedEvent ? (
                  <div className="empty-panel">
                    Selecciona un evento de cualquier ronda para ver el mapa.
                  </div>
                ) : (
                  <>
                    <div className="match-event-map-header">
                      <strong>
                        {roundLabel(selectedEvent.roundNum)} ·{" "}
                        {toSecondsLabel(selectedEvent.timeMs)}
                      </strong>
                      <span>
                        {selectedEvent.kind === "kill"
                          ? `${selectedEvent.killerName} → ${selectedEvent.victimName}`
                          : `${selectedEvent.kind === "plant" ? "Plant" : "Defuse"} de ${selectedEvent.actorName}`}
                      </span>
                    </div>

                    {mapImageUrl ? (
                      <div className="match-event-map-stage">
                        <img src={mapImageUrl} alt={mapName} />
                        <div className="match-event-map-overlay">
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
                                <span>
                                  {selectedEvent.kind === "defuse" ? "D" : "P"}
                                </span>
                              ) : marker.icon ? (
                                <img src={marker.icon} alt={marker.label} />
                              ) : (
                                <span>
                                  {marker.label.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-chart">
                        No hay imagen de mapa disponible.
                      </div>
                    )}

                    {!mapTransform && (
                      <p className="match-event-map-note">
                        Este mapa no tiene transformacion de coordenadas
                        disponible.
                      </p>
                    )}

                    {mapTransform && eventMapState.markers.length === 0 && (
                      <p className="match-event-map-note">
                        No hay posiciones validas para este evento en el
                        dataset.
                      </p>
                    )}

                    {mapTransform &&
                      eventMapState.markers.length > 0 &&
                      !eventMapState.hasSnapshot && (
                        <p className="match-event-map-note">
                          Se muestra solo la posicion del evento porque no hay
                          snapshot completo de jugadores.
                        </p>
                      )}

                    <div className="match-event-map-legend">
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
                        <i className="dot target" /> Tu posicion
                      </span>
                    </div>
                  </>
                )}
              </aside>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
