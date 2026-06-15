import { describe, expect, it } from "vitest";
import {
  collectRoundKills,
  isEnemyDamage,
  isValidKill,
  validAssistants,
} from "./combatEvents";

const teams = new Map([
  ["p1", "A"],
  ["p2", "A"],
  ["e1", "B"],
]);

describe("combatEvents", () => {
  it("solo acepta kills entre jugadores distintos y equipos rivales", () => {
    expect(isValidKill({ killer: "p1", victim: "e1" }, teams)).toBe(true);
    expect(isValidKill({ killer: "p1", victim: "p1" }, teams)).toBe(false);
    expect(isValidKill({ killer: "p1", victim: "p2" }, teams)).toBe(false);
    expect(isValidKill({ victim: "e1" }, teams)).toBe(false);
  });

  it("descarta daño propio y aliado", () => {
    expect(isEnemyDamage("p1", { receiver: "e1", damage: 100 }, teams)).toBe(
      true,
    );
    expect(isEnemyDamage("p1", { receiver: "p1", damage: 40 }, teams)).toBe(
      false,
    );
    expect(isEnemyDamage("p1", { receiver: "p2", damage: 40 }, teams)).toBe(
      false,
    );
  });

  it("solo conserva asistentes válidos de una kill competitiva", () => {
    expect(
      validAssistants(
        {
          killer: "p1",
          victim: "e1",
          assistants: ["p2", "p2", "e1"],
        },
        teams,
      ),
    ).toEqual(["p2"]);
    expect(
      validAssistants(
        { killer: "p1", victim: "p1", assistants: ["p2"] },
        teams,
      ),
    ).toEqual([]);
  });

  it("deduplica la misma kill repetida en playerStats", () => {
    const kill = {
      killer: "p1",
      victim: "e1",
      timeSinceRoundStartMillis: 1000,
    };
    expect(
      collectRoundKills({
        playerStats: [
          { puuid: "p1", kills: [kill] },
          { puuid: "p2", kills: [kill] },
        ],
      }),
    ).toHaveLength(1);
  });
});
