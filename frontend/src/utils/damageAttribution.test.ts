import { describe, expect, it } from "vitest";
import type { AgentContent } from "../types/agents";
import {
  resolveKillDamageSource,
  shouldSuppressKillConnectionLine,
} from "./damageAttribution";

const weapons = new Map([
  ["weapon-1", { id: "weapon-1", displayName: "Vandal", displayIcon: "/vandal.png" }],
]);

const agents = new Map<string, AgentContent>([
  [
    "sova",
    {
      uuid: "sova",
      displayName: "Sova",
      abilities: [
        {
          slot: "Ability1",
          displayName: "Shock Bolt",
          displayIcon: "/shock-bolt.png",
        },
      ],
    },
  ],
]);

describe("resolveKillDamageSource", () => {
  it("resuelve kills de arma", () => {
    const source = resolveKillDamageSource(
      { finishingDamage: { damageType: "Weapon", damageItem: "weapon-1" } },
      { characterId: "sova" },
      weapons,
      agents,
    );

    expect(source.type).toBe("weapon");
    expect(source.isAbility).toBe(false);
    expect(source.name).toBe("Vandal");
  });

  it("resuelve kills de habilidad con el agente killer", () => {
    const source = resolveKillDamageSource(
      { finishingDamage: { damageType: "Ability", damageItem: "Shock Bolt" } },
      { characterId: "sova" },
      weapons,
      agents,
    );

    expect(source.type).toBe("ability");
    expect(source.isAbility).toBe(true);
    expect(source.name).toBe("Shock Bolt");
    expect(source.icon).toBe("/shock-bolt.png");
  });

  it("resuelve todos los slots genericos dentro del agente killer", () => {
    const slotAgents = new Map<string, AgentContent>(
      ["agent-a", "agent-b"].map((agentId) => [
        agentId,
        {
          uuid: agentId,
          displayName: agentId,
          abilities: ["Ability1", "Ability2", "Grenade", "Ultimate"].map(
            (slot) => ({
              slot,
              displayName: `${agentId}-${slot}`,
            }),
          ),
        },
      ]),
    );

    const slots = [
      ["Ability1", "Ability1"],
      ["Ability2", "Ability2"],
      ["GrenadeAbility", "Grenade"],
      ["Ultimate", "Ultimate"],
    ] as const;

    for (const agentId of ["agent-a", "agent-b"]) {
      for (const [rawSlot, expectedSlot] of slots) {
        const source = resolveKillDamageSource(
          {
            finishingDamage: {
              damageType: "Ability",
              damageItem: rawSlot,
            },
          },
          { characterId: agentId },
          new Map(),
          slotAgents,
        );
        expect(source.name).toBe(`${agentId}-${expectedSlot}`);
      }
    }
  });

  it("no adivina un agente cuando solo recibe un slot generico", () => {
    const source = resolveKillDamageSource(
      { finishingDamage: { damageType: "Ability", damageItem: "Ultimate" } },
      undefined,
      new Map(),
      new Map([
        [
          "gekko",
          {
            uuid: "gekko",
            displayName: "Gekko",
            abilities: [{ slot: "Ultimate", displayName: "Thrash" }],
          },
        ],
      ]),
    );

    expect(source.name).toBe("Ultimate");
    expect(source.id).toBe("Ultimate");
  });

  it("mantiene fallback estable para fuentes desconocidas", () => {
    const source = resolveKillDamageSource(
      { finishingDamage: { damageType: "Weird", damageItem: "odd_source" } },
      undefined,
      weapons,
      agents,
    );

    expect(source.type).toBe("unknown");
    expect(source.id).toBe("odd_source");
    expect(source.name).toBe("Odd Source");
  });

  it("resuelve armas de habilidad de agente como habilidad local", () => {
    const chamberAgents = new Map([
      [
        "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
        {
          uuid: "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
          displayName: "Chamber",
          abilities: [
            {
              slot: "Ability1",
              displayName: "Cazador de cabezas",
              displayIcon:
                "/content/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/abilities/Cazador_de_cabezas/displayIcon.png",
            },
            {
              slot: "Ultimate",
              displayName: "Tour de force",
            },
          ],
        },
      ],
      [
        "bb2a4828-46eb-8cd1-e765-15848195d751",
        {
          uuid: "bb2a4828-46eb-8cd1-e765-15848195d751",
          displayName: "Neon",
          abilities: [{ slot: "Ultimate", displayName: "Sobrecarga" }],
        },
      ],
    ]);

    const cases = [
      ["856d9a7e-4b06-dc37-15dc-9d809c37cb90", "Cazador de cabezas"],
      ["39099fb5-4293-def4-1e09-2e9080ce7456", "Tour de force"],
      ["95336ae4-45d4-1032-cfaf-6bad01910607", "Sobrecarga"],
    ] as const;

    for (const [rawId, expectedName] of cases) {
      const source = resolveKillDamageSource(
        {
          finishingDamage: {
            damageType: "Weapon",
            damageItem: rawId,
          },
        },
        undefined,
        new Map(),
        chamberAgents,
      );

      expect(source.type).toBe("ability");
      expect(source.isAbility).toBe(true);
      expect(source.name).toBe(expectedName);
      expect(source.icon).toContain("/content/agents/");
    }
  });

  it("oculta la linea de union en habilidades de area listadas", () => {
    expect(
      shouldSuppressKillConnectionLine(
        {
          id: "sova:Ability1",
          name: "Flecha explosiva",
          type: "ability",
          isAbility: true,
        },
        { displayName: "Sova" },
      ),
    ).toBe(true);

    expect(
      shouldSuppressKillConnectionLine(
        {
          id: "chamber:Ability1",
          name: "Cazador de cabezas",
          type: "ability",
          isAbility: true,
        },
        { displayName: "Chamber" },
      ),
    ).toBe(false);
  });
});
