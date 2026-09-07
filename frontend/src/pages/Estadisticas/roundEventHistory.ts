import type { MatchCard, SideFilter } from "../../types/dashboard";
import type { RawMatchDetail } from "../../types/matches";
import {
  buildTeamLookup,
  collectRoundKills,
  isValidKill,
} from "../../utils/stats/combatEvents";

export type RoundEventKind = "ace" | "firstBlood";

export type RoundHistoryEvent = {
  id: string;
  kind: RoundEventKind;
  match: MatchCard;
  roundNum: number;
  kills: number;
  side: Exclude<SideFilter, "all">;
  victimName?: string;
};

const cleanId = (value: unknown) => String(value ?? "").trim();

function roundSide(teamId: string, roundNum: number): Exclude<SideFilter, "all"> {
  const isRed = teamId.toLowerCase() === "red";
  if (roundNum < 12) return isRed ? "attack" : "defense";
  if (roundNum < 24) return isRed ? "defense" : "attack";
  const redAttacks = Math.floor((roundNum - 24) / 2) % 2 === 0;
  return redAttacks === isRed ? "attack" : "defense";
}

export function extractRoundHistoryEvents(
  detail: RawMatchDetail | null,
  match: MatchCard,
  playerId: string,
  kind: RoundEventKind,
  side: SideFilter,
): RoundHistoryEvent[] {
  if (!detail) return [];
  const targetId = cleanId(playerId);
  const player = detail.players?.find(
    (candidate) => cleanId(candidate.puuid) === targetId,
  );
  if (!player) return [];

  const teams = buildTeamLookup(detail.players);
  const playerNames = new Map(
    (detail.players ?? []).map((candidate) => [
      cleanId(candidate.puuid),
      [candidate.gameName, candidate.tagLine].filter(Boolean).join("#") ||
        "Jugador desconocido",
    ]),
  );

  return (detail.roundResults ?? [])
    .map((round, index) => ({
      round,
      roundNum: Number.isFinite(round.roundNum) ? Number(round.roundNum) : index,
    }))
    .sort((a, b) => a.roundNum - b.roundNum)
    .flatMap<RoundHistoryEvent>(({ round, roundNum }) => {
      const eventSide = roundSide(cleanId(player.teamId), roundNum);
      if (side !== "all" && eventSide !== side) {
        return [];
      }

      const kills = collectRoundKills(round).filter(({ kill, ownerPuuid }) =>
        isValidKill(kill, teams, ownerPuuid),
      );
      const playerKills = kills.filter(
        ({ kill, ownerPuuid }) =>
          (cleanId(kill.killer) || cleanId(ownerPuuid)) === targetId,
      );

      if (kind === "ace") {
        if (playerKills.length < 5) return [];
        return [{
          id: `${match.id}-ace-${roundNum}`,
          kind,
          match,
          roundNum,
          kills: playerKills.length,
          side: eventSide,
        }];
      }

      const openingKill = kills[0];
      if (
        !openingKill ||
        (cleanId(openingKill.kill.killer) || cleanId(openingKill.ownerPuuid)) !==
          targetId
      ) {
        return [];
      }

      return [{
        id: `${match.id}-first-blood-${roundNum}`,
        kind,
        match,
        roundNum,
        kills: 1,
        side: eventSide,
        victimName: playerNames.get(cleanId(openingKill.kill.victim)),
      }];
    });
}
