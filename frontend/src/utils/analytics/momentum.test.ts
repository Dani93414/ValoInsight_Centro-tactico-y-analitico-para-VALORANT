import { describe, expect, it } from "vitest";
import {
  analyzeAdvancedMomentum,
  detectExtremeDefuseEvents,
  detectInferredClutchEvents,
  detectSideSwitchDominance,
  type AdvancedMomentumInput,
  type AdvancedMomentumPlayer,
  type AdvancedMomentumRound,
} from "./advancedMomentum";
import {
  calculateMatchMomentum,
  type MomentumInputRound,
} from "./momentum";

const teams = { teamAId: "A", teamBId: "B" };

function baseRound(
  roundNumber: number,
  winnerTeamId: string,
  teamAScore: number,
  teamBScore: number,
  extra: Partial<MomentumInputRound> = {},
): MomentumInputRound {
  return {
    roundNumber,
    winnerTeamId,
    teamAScore,
    teamBScore,
    ...teams,
    ...extra,
  };
}

const players: AdvancedMomentumPlayer[] = [
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `a${index + 1}`,
    teamId: "A",
    playerName: `A${index + 1}`,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `b${index + 1}`,
    teamId: "B",
    playerName: `B${index + 1}`,
  })),
];

function advancedRound(
  roundNumber: number,
  winnerTeamId: string,
  extra: Partial<AdvancedMomentumRound> = {},
): AdvancedMomentumRound {
  return {
    roundNumber,
    winnerTeamId,
    ...teams,
    teamAScore: 0,
    teamBScore: 0,
    scoreBefore: { A: 0, B: 0 },
    scoreAfter: { A: 0, B: 0 },
    teamALoadout: 20_000,
    teamBLoadout: 20_000,
    kills: [],
    playerRounds: players.map((player) => ({
      playerId: player.id,
      kills: 0,
      assists: 0,
      deaths: 0,
      score: 0,
      firstKill: false,
      firstDeath: false,
    })),
    ...extra,
  };
}

function advancedInput(
  rounds: AdvancedMomentumRound[],
  existingMomentum = calculateMatchMomentum(
    rounds.map((round) =>
      baseRound(
        round.roundNumber,
        round.winnerTeamId,
        round.teamAScore,
        round.teamBScore,
      ),
    ),
    teams,
  ),
): AdvancedMomentumInput {
  return {
    existingMomentum,
    rounds,
    players,
    ...teams,
  };
}

describe("calculateMatchMomentum", () => {
  it("calcula una ronda simple y cuadra sus contribuciones", () => {
    const result = calculateMatchMomentum([baseRound(1, "A", 1, 0)], teams);
    const round = result.rounds[0];

    expect(round.momentumDiff).toBe(1);
    expect(round.contributions.reduce((sum, item) => sum + item.value, 0))
      .toBeCloseTo(round.momentumDiff, 2);
  });

  it("modera FULL contra ECO y premia ECO contra FULL", () => {
    const expected = calculateMatchMomentum([
      baseRound(1, "A", 1, 0, { teamALoadout: 20_000, teamBLoadout: 5_000 }),
    ], teams).rounds[0];
    const upset = calculateMatchMomentum([
      baseRound(1, "B", 0, 1, { teamALoadout: 20_000, teamBLoadout: 5_000 }),
    ], teams).rounds[0];

    expect(expected.roundImpact).toBe(0.7);
    expect(upset.roundImpact).toBe(-1.6);
  });

  it("no degrada el momentum cuando una ronda no tiene ganador", () => {
    const result = calculateMatchMomentum([
      baseRound(1, "A", 1, 0),
      baseRound(2, "equipo-desconocido", 1, 0),
    ], teams);

    expect(result.rounds[1].momentumDiff).toBe(result.rounds[0].momentumDiff);
    expect(result.rounds[1].winnerTeamId).toBe("");
  });

  it("distingue una ronda igualada 11-11 de un 11-2", () => {
    const close = calculateMatchMomentum([
      baseRound(23, "A", 12, 11),
    ], teams).rounds[0];
    const stomp = calculateMatchMomentum([
      baseRound(14, "A", 12, 2),
    ], teams).rounds[0];

    expect(close.contributions.some((item) => item.id === "critical-round")).toBe(true);
    expect(stomp.contributions.some((item) => item.id === "critical-round")).toBe(false);
  });

  it("registra pérdida y adquisición de dominio sin contar el inicial", () => {
    const winners = ["A", "A", "A", "B", "B", "B"];
    let a = 0;
    let b = 0;
    const rounds = winners.map((winner, index) => {
      if (winner === "A") a += 1;
      else b += 1;
      return baseRound(index + 1, winner, a, b);
    });
    const result = calculateMatchMomentum(rounds, teams);

    expect(result.domainChanges[0]).toMatchObject({ fromTeamId: "A", toTeamId: null });
    expect(result.domainChanges.at(-1)).toMatchObject({ fromTeamId: null, toTeamId: "B" });
  });

  it("no declara dominio global con una ventaja de control mínima", () => {
    const result = calculateMatchMomentum([
      baseRound(1, "A", 1, 0),
      baseRound(2, "B", 1, 1),
      baseRound(3, "B", 1, 2),
      baseRound(4, "A", 2, 2),
    ], teams);

    expect(result.globalDominantTeamId).toBeNull();
  });

  it("no inventa clutch con killer muerto o tracking incompleto", () => {
    const playerTeams = Object.fromEntries(players.map((player) => [player.id, player.teamId]));
    const kills = [
      { killerId: "b1", victimId: "a1", timeMs: 1 },
      { killerId: "a1", victimId: "b1", timeMs: 2 },
      { killerId: "a1", victimId: "b2", timeMs: 3 },
    ];
    const round = calculateMatchMomentum([
      baseRound(1, "A", 1, 0, { playerTeams, kills }),
    ], teams).rounds[0];

    expect(round.contributions.some((item) => item.id === "clutch")).toBe(false);
    expect(round.contributions.some((item) => item.id === "opening-converted")).toBe(false);
    expect(round.contributions.some((item) => item.id === "flawless")).toBe(false);
  });
});

describe("advanced momentum", () => {
  it("mantiene un ace perdido como highlight sin convertirlo en turning point", () => {
    const rounds = Array.from({ length: 6 }, (_, index) =>
      advancedRound(index + 1, "B", index === 0
        ? {
            kills: ["b1", "b2", "b3", "b4", "b5"].map((victimId, killIndex) => ({
              killerId: "a1",
              victimId,
              timeMs: killIndex + 1,
            })),
            playerRounds: players.map((player) => ({
              playerId: player.id,
              kills: player.id === "a1" ? 5 : 0,
              assists: 0,
              deaths: 0,
              score: 0,
              firstKill: player.id === "a1",
              firstDeath: player.id === "b1",
            })),
          }
        : {}),
    );
    const ace = analyzeAdvancedMomentum(advancedInput(rounds)).events.find(
      (event) => event.type === "ACE",
    );

    expect(ace?.isHighlight).toBe(true);
    expect(ace?.postEventMomentumDelta).toBeLessThan(0);
    expect(ace?.isTurningPoint).toBe(false);
  });

  it("rechaza clutches con secuencia de vivos corrupta", () => {
    const round = advancedRound(1, "A", {
      kills: [
        { killerId: "b1", victimId: "a1", timeMs: 1 },
        { killerId: "a1", victimId: "b1", timeMs: 2 },
        { killerId: "a1", victimId: "b2", timeMs: 3 },
      ],
    });

    expect(detectInferredClutchEvents(advancedInput([round]))).toHaveLength(0);
  });

  it("solo detecta defuse extremo con tiempos plausibles y ganador coherente", () => {
    const valid = advancedRound(1, "A", {
      bombPlanter: "b1",
      bombDefuser: "a1",
      plantRoundTime: 10_000,
      defuseRoundTime: 54_800,
    });
    const invalid = advancedRound(2, "B", {
      bombPlanter: "b1",
      bombDefuser: "a1",
      plantRoundTime: 10_000,
      defuseRoundTime: 54_800,
    });

    expect(detectExtremeDefuseEvents(advancedInput([valid]))).toHaveLength(1);
    expect(detectExtremeDefuseEvents(advancedInput([invalid]))).toHaveLength(0);
  });

  it("detecta mejora estructural tras cambio de lado comparando tasas", () => {
    const before = Array.from({ length: 12 }, (_, index) =>
      advancedRound(index + 1, index % 2 === 0 ? "A" : "B"),
    );
    const after = Array.from({ length: 8 }, (_, index) =>
      advancedRound(index + 13, index < 6 ? "A" : "B"),
    );

    expect(
      detectSideSwitchDominance(advancedInput([...before, ...after]))
        .some((event) => event.teamId === "A"),
    ).toBe(true);
  });

  it("degrada la confianza cuando la cobertura es parcial", () => {
    const rounds = [
      advancedRound(1, "A", {
        teamALoadout: 0,
        teamBLoadout: 0,
        kills: [],
      }),
      advancedRound(2, "B", {
        teamALoadout: 0,
        teamBLoadout: 0,
        kills: [],
      }),
    ];

    expect(analyzeAdvancedMomentum(advancedInput(rounds)).dataQuality.overallConfidence)
      .toBe("low");
  });

  it("no contabiliza dos veces el contexto de una ruptura de racha", () => {
    const rounds = [
      advancedRound(1, "B"),
      advancedRound(2, "B"),
      advancedRound(3, "B"),
      advancedRound(4, "A"),
    ];
    const event = analyzeAdvancedMomentum(advancedInput(rounds)).events.find(
      (candidate) => candidate.type === "STREAK_BREAKER",
    );

    expect(event?.contextScore).toBe(0.4);
  });
});
