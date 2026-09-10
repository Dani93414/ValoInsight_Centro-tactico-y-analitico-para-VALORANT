import { describe, expect, it } from "vitest";
import type { MatchCard } from "../../types/dashboard";
import type { RawMatchDetail, RawRound } from "../../types/matches";
import { extractRoundHistoryEvents } from "./roundEventHistory";

const match = {
  id: "match-1",
  timestamp: 2,
  map: "Ascent",
  dateLabel: "Hoy",
} as MatchCard;

const players = [
  { puuid: "player", teamId: "Red", gameName: "Target" },
  ...Array.from({ length: 5 }, (_, index) => ({
    puuid: `enemy-${index}`,
    teamId: "Blue",
    gameName: `Enemy ${index}`,
  })),
];

function round(roundNum: number, killers: string[]): RawRound {
  return {
    roundNum,
    playerStats: killers.map((killer, index) => ({
      puuid: killer,
      kills: [{
        killer,
        victim: `enemy-${index}`,
        timeSinceRoundStartMillis: (index + 1) * 1000,
      }],
    })),
  };
}

describe("extractRoundHistoryEvents", () => {
  it("detecta ACE y mantiene las rondas en orden cronológico", () => {
    const detail: RawMatchDetail = {
      players,
      roundResults: [round(4, Array(5).fill("player")), round(1, Array(5).fill("player"))],
    };

    expect(extractRoundHistoryEvents(detail, match, "player", "ace", "all").map((event) => event.roundNum)).toEqual([1, 4]);
  });

  it("solo cuenta como primera sangre la primera baja válida", () => {
    const detail: RawMatchDetail = {
      players,
      roundResults: [
        round(0, ["player", "enemy-1"]),
        {
          roundNum: 1,
          playerStats: [
            {
              puuid: "enemy-1",
              kills: [{
                killer: "enemy-1",
                victim: "player",
                timeSinceRoundStartMillis: 1000,
              }],
            },
            {
              puuid: "player",
              kills: [{
                killer: "player",
                victim: "enemy-2",
                timeSinceRoundStartMillis: 2000,
              }],
            },
          ],
        },
      ],
    };

    const events = extractRoundHistoryEvents(detail, match, "player", "firstBlood", "all");
    expect(events).toHaveLength(1);
    expect(events[0].roundNum).toBe(0);
    expect(events[0].victimName).toBe("Enemy 0");
  });

  it("respeta el filtro de lado, incluido el cambio de mitad", () => {
    const detail: RawMatchDetail = {
      players,
      roundResults: [round(0, ["player"]), round(12, ["player"])],
    };

    expect(extractRoundHistoryEvents(detail, match, "player", "firstBlood", "attack").map((event) => event.roundNum)).toEqual([0]);
    expect(extractRoundHistoryEvents(detail, match, "player", "firstBlood", "defense").map((event) => event.roundNum)).toEqual([12]);
  });
});
