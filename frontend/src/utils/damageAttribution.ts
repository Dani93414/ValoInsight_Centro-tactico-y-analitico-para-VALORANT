import type { AgentContent } from "../types/agents";
import type { RawKillEvent, RawPlayer } from "../types/matches";

export type DamageSourceType =
  | "weapon"
  | "ability"
  | "melee"
  | "fall"
  | "bomb"
  | "unknown";

export type WeaponCatalogEntry = {
  id: string;
  displayName: string;
  displayIcon?: string | null;
};

export type DamageSourceResolution = {
  id: string;
  name: string;
  icon?: string | null;
  type: DamageSourceType;
  isAbility: boolean;
};

type ResolvedAbility = {
  id: string;
  name: string;
  icon?: string | null;
};

const CONNECTIONLESS_ABILITY_NAMES_BY_AGENT: Record<string, Set<string>> = {
  breach: new Set(["replica"]),
  brimstone: new Set(["incendiaria", "incendiario", "ataqueorbital", "golpeorbital"]),
  cypher: new Set(["cabletrampa"]),
  gekko: new Set(["pogobrutal", "mosh"]),
  killjoy: new Set(["nanoplaga", "nanoenjambre", "torreta"]),
  kayo: new Set(["fragmentacion", "fragmento", "frag"]),
  phoenix: new Set(["manitascalientes", "combustion", "muroabrasador", "llamarada"]),
  raze: new Set(["paqueteexclusivo", "fardoexplosivo", "carcasasdepinturas", "balasdepintura", "bumbot", "botexplosivo"]),
  skye: new Set(["forjacaminos", "precursor"]),
  sova: new Set(["proyectilelectrico", "flechaexplosiva"]),
  tejo: new Set(["entregaespecial", "envioespecial", "misilescrucero", "descargaguiada", "armagedon"]),
  viper: new Set(["mordedura", "venenodeserpiente"]),
  vyse: new Set(["enredaderafilosa", "zarzallacerante"]),
};

const ABILITY_SLOT_ALIASES: Record<string, string> = {
  grenadeability: "grenade",
  grenade: "grenade",
  ability1: "ability1",
  ability2: "ability2",
  ultimate: "ultimate",
};

const ABILITY_WEAPON_SLOT_ALIASES = new Map<string, string>([
  [
    "22697a3d-45bf-8dd7-4fec-84a9e28c69d7:856d9a7e-4b06-dc37-15dc-9d809c37cb90",
    "ability1",
  ],
  [
    "22697a3d-45bf-8dd7-4fec-84a9e28c69d7:39099fb5-4293-def4-1e09-2e9080ce7456",
    "ultimate",
  ],
  [
    "bb2a4828-46eb-8cd1-e765-15848195d751:95336ae4-45d4-1032-cfaf-6bad01910607",
    "ultimate",
  ],
]);

function cleanId(value?: string | null): string {
  return String(value ?? "").trim();
}

function normalizeLookup(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function abilityIconPath(agentId: string, abilityName: string): string | null {
  if (!agentId || !abilityName) return null;
  const sanitized = abilityName
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return sanitized
    ? `/content/agents/${agentId}/abilities/${sanitized}/displayIcon.png`
    : null;
}

function readableFallback(value: string, fallback: string): string {
  if (!value) return fallback;
  const text = value.replace(/[_-]+/g, " ").trim();
  return text
    ? text
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : fallback;
}

function findAbility(
  value: string,
  agentsById: Map<string, AgentContent>,
  agentId?: string,
): ResolvedAbility | null {
  let normalized = normalizeLookup(value);
  const agentKey = cleanId(agentId);
  const weaponSlotAlias = ABILITY_WEAPON_SLOT_ALIASES.get(
    `${agentKey}:${cleanId(value).toLowerCase()}`,
  );
  const slotAlias = ABILITY_SLOT_ALIASES[normalized];
  if (weaponSlotAlias) {
    normalized = weaponSlotAlias;
  } else if (slotAlias) {
    normalized = slotAlias;
  }
  const agents = agentId
    ? [agentsById.get(agentId), ...[...agentsById.values()].filter((agent) => cleanId(agent.uuid ?? agent.id) !== agentId)]
    : [...agentsById.values()];

  for (const agent of agents) {
    if (!agent) continue;
    const currentAgentId = cleanId(agent.uuid ?? agent.id);
    for (const ability of agent.abilities ?? []) {
      const abilityId = cleanId(ability.uuid ?? ability.id);
      const slot = cleanId(ability.slot);
      const name = cleanId(ability.displayName);
      const assetPath = cleanId(ability.assetPath);
      const rawName = cleanId(ability.rawName);
      const keys = [
        abilityId,
        slot,
        name,
        rawName,
        assetPath,
        normalizeLookup(slot),
        currentAgentId && slot ? `${currentAgentId}:${slot}` : "",
        currentAgentId && name ? `${currentAgentId}:${normalizeLookup(name)}` : "",
        currentAgentId && slot ? `${currentAgentId}:${normalizeLookup(slot)}` : "",
      ];
      const matchesDirectly = keys.some(
        (key) => key && normalizeLookup(key) === normalized,
      );
      const matchesAgentSlot =
        currentAgentId === agentKey && normalizeLookup(slot) === normalized;
      if (matchesDirectly || matchesAgentSlot) {
        return {
          id:
            abilityId ||
            assetPath ||
            (currentAgentId && slot
              ? `${currentAgentId}:${slot}`
              : `${currentAgentId}:${normalizeLookup(name)}`),
          name: name || readableFallback(value, "Habilidad desconocida"),
          icon: ability.displayIcon ?? abilityIconPath(currentAgentId, name) ?? null,
        };
      }
    }
  }

  return null;
}

export function resolveKillDamageSource(
  kill: RawKillEvent,
  killer: RawPlayer | undefined,
  weaponsById: Map<string, WeaponCatalogEntry>,
  agentsById: Map<string, AgentContent>,
): DamageSourceResolution {
  const damageType = cleanId(kill.finishingDamage?.damageType);
  const typeLower = damageType.toLowerCase();
  const damageItem = cleanId(
    kill.finishingDamage?.damageItem ?? kill.finishingDamage?.item,
  );
  const killerAgentId = cleanId(killer?.characterId);
  const weapon = damageItem ? weaponsById.get(damageItem) : undefined;
  const ability = damageItem
    ? findAbility(damageItem, agentsById, killerAgentId)
    : null;

  if (typeLower === "melee") {
    return { id: damageItem || "MELEE", name: "Melee", icon: null, type: "melee", isAbility: false };
  }
  if (typeLower === "fall" || typeLower === "falling") {
    return { id: "FALL", name: "Caida", icon: null, type: "fall", isAbility: false };
  }
  if (typeLower === "bomb" || typeLower === "spike") {
    return { id: "BOMB", name: "Spike", icon: null, type: "bomb", isAbility: false };
  }
  if (weapon) {
    return {
      id: damageItem || "UNKNOWN",
      name: weapon?.displayName ?? readableFallback(damageItem, "Arma desconocida"),
      icon: weapon?.displayIcon ?? null,
      type: "weapon",
      isAbility: false,
    };
  }

  if (typeLower === "ability" || ability) {
    return {
      id: ability?.id ?? damageItem ?? "ABILITY_UNKNOWN",
      name: ability?.name ?? readableFallback(damageItem, "Habilidad desconocida"),
      icon: ability?.icon ?? null,
      type: "ability",
      isAbility: true,
    };
  }

  if (typeLower === "weapon") {
    return {
      id: damageItem || "UNKNOWN",
      name: readableFallback(damageItem, "Arma desconocida"),
      icon: null,
      type: "weapon",
      isAbility: false,
    };
  }

  return {
    id: damageItem || "UNKNOWN",
    name: readableFallback(damageItem, damageType || "Unknown"),
    icon: null,
    type: "unknown",
    isAbility: false,
  };
}

export function shouldSuppressKillConnectionLine(
  source: DamageSourceResolution,
  killerAgent?: AgentContent | null,
): boolean {
  if (!source.isAbility && source.type !== "ability") return false;
  const agentName = normalizeLookup(killerAgent?.displayName ?? killerAgent?.name);
  const abilityName = normalizeLookup(source.name);
  if (!agentName || !abilityName) return false;
  return CONNECTIONLESS_ABILITY_NAMES_BY_AGENT[agentName]?.has(abilityName) ?? false;
}
