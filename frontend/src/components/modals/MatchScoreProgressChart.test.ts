import { describe, expect, it } from "vitest";
import type { RawMatchDetail } from "../../types/matches";
import {
  buildScoreProgression,
  type ScoreProgressPlayer,
} from "./scoreProgression";

const players: ScoreProgressPlayer[] = [
  { id: "p1", name: "P1", agentName: "A1", teamId: "Red", color: "red", dataKey: "p1" },
  { id: "p2", name: "P2", agentName: "A2", teamId: "Blue", color: "blue", dataKey: "p2" },
  { id: "p3", name: "P3", agentName: "A3", teamId: "Blue", color: "green", dataKey: "p3" },
];

describe("buildScoreProgression", () => {
  it("calcula ACS y posición acumulados en cada ronda", () => {
    const match: RawMatchDetail = {
      roundResults: [
        {
          roundNum: 0,
          playerStats: [
            { puuid: "p1", score: 100 },
            { puuid: "p2", score: 50 },
            { puuid: "p3", score: 0 },
          ],
        },
        {
          roundNum: 1,
          playerStats: [
            { puuid: "p1", score: 0 },
            { puuid: "p2", score: 100 },
            { puuid: "p3", score: 0 },
          ],
        },
        {
          roundNum: 2,
          playerStats: [
            { puuid: "p1", score: 0 },
            { puuid: "p2", score: 0 },
            { puuid: "p3", score: 300 },
          ],
        },
      ],
    };

    const result = buildScoreProgression(match, players);

    expect(result).toHaveLength(3);
    expect(result[0].values.p1).toEqual({ score: 100, acs: 100, position: 1 });
    expect(result[1].values.p2).toEqual({ score: 150, acs: 75, position: 1 });
    expect(result[1].values.p1.position).toBe(2);
    expect(result[2].values.p3).toEqual({ score: 300, acs: 100, position: 1 });
  });

  it("ordena rondas por roundNum antes de acumular", () => {
    const match: RawMatchDetail = {
      roundResults: [
        { roundNum: 1, playerStats: [{ puuid: "p1", score: 50 }] },
        { roundNum: 0, playerStats: [{ puuid: "p1", score: 100 }] },
      ],
    };

    const result = buildScoreProgression(match, players);

    expect(result[0].values.p1.score).toBe(100);
    expect(result[1].values.p1.score).toBe(150);
  });
});
