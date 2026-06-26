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
          ],
        },
      ],
    ]);

    const source = resolveKillDamageSource(
      {
        finishingDamage: {
          damageType: "Weapon",
          damageItem: "856d9a7e-4b06-dc37-15dc-9d809c37cb90",
        },
      },
      { characterId: "22697a3d-45bf-8dd7-4fec-84a9e28c69d7" },
      new Map(),
      chamberAgents,
    );

    expect(source.type).toBe("ability");
    expect(source.isAbility).toBe(true);
    expect(source.name).toBe("Cazador de cabezas");
    expect(source.icon).toContain("/content/agents/");
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
