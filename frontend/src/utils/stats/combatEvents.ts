import type {
  RawKillEvent,
  RawPlayer,
  RawRound,
  RawRoundDamage,
} from "../../types/matches";

export type TeamLookup = ReadonlyMap<string, string>;

const id = (value: unknown) => String(value ?? "").trim();

export function buildTeamLookup(players: RawPlayer[] | undefined): Map<string, string> {
  const teams = new Map<string, string>();
  for (const player of players ?? []) {
    const puuid = id(player.puuid);
    const teamId = id(player.teamId);
    if (puuid && teamId) teams.set(puuid, teamId);
  }
  return teams;
}

export function isValidKill(
  kill: RawKillEvent | null | undefined,
  teams?: TeamLookup,
  fallbackKiller?: string,
): boolean {
  const killer = id(kill?.killer) || id(fallbackKiller);
  const victim = id(kill?.victim);
  if (!killer || !victim || killer === victim) return false;
  const killerTeam = teams?.get(killer);
  const victimTeam = teams?.get(victim);
  return !(killerTeam && victimTeam && killerTeam === victimTeam);
}

export function isEnemyDamage(
  attacker: unknown,
  damage: RawRoundDamage,
  teams?: TeamLookup,
): boolean {
  const attackerId = id(attacker);
  const receiverId = id(damage.receiver);
  if (!attackerId || !receiverId || attackerId === receiverId) return false;
  const attackerTeam = teams?.get(attackerId);
  const receiverTeam = teams?.get(receiverId);
  return !(attackerTeam && receiverTeam && attackerTeam === receiverTeam);
}

export function validAssistants(
  kill: RawKillEvent,
  teams?: TeamLookup,
  fallbackKiller?: string,
): string[] {
  if (!isValidKill(kill, teams, fallbackKiller)) return [];
  const killer = id(kill.killer) || id(fallbackKiller);
  const victim = id(kill.victim);
  const killerTeam = teams?.get(killer);
  const raw = Array.isArray(kill.assistants)
    ? kill.assistants
    : typeof kill.assistants === "string"
      ? [kill.assistants]
      : [];
  return [...new Set(raw.map(id))].filter((assistant) => {
    if (!assistant || assistant === killer || assistant === victim) return false;
    const assistantTeam = teams?.get(assistant);
    return !(killerTeam && assistantTeam && killerTeam !== assistantTeam);
  });
}

export type CollectedRoundKill = {
  kill: RawKillEvent;
  ownerPuuid: string;
};

export function collectRoundKills(round: RawRound): CollectedRoundKill[] {
  const seen = new Set<string>();
  const kills: CollectedRoundKill[] = [];
  for (const stat of round.playerStats ?? []) {
    const ownerPuuid = id(stat.puuid);
    for (const kill of stat.kills ?? []) {
      const key = [
        kill.timeSinceRoundStartMillis ?? "",
        id(kill.killer) || ownerPuuid,
        id(kill.victim),
        validRawAssistants(kill).sort().join(","),
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      kills.push({ kill, ownerPuuid });
    }
  }
  return kills.sort(
    (a, b) =>
      Number(a.kill.timeSinceRoundStartMillis ?? 0) -
      Number(b.kill.timeSinceRoundStartMillis ?? 0),
  );
}

function validRawAssistants(kill: RawKillEvent): string[] {
  if (Array.isArray(kill.assistants)) return kill.assistants.map(id).filter(Boolean);
  return typeof kill.assistants === "string" && id(kill.assistants)
    ? [id(kill.assistants)]
    : [];
}
