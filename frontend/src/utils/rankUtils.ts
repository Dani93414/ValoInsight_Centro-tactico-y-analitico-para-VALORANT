const MIN_RANK_TIER = 3;
const MAX_RANK_TIER = 27;
const COMPETITIVE_TIER_ICON_PATH_RE =
  /(\/content\/competitive_tiers\/[^/]+\/tiers\/)([^/]+)(\/[^?#]*)/i;

const RANK_NAMES: Record<number, string> = {
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

export function normalizeCompetitiveTierIconPath(
  value?: string | null,
): string | null {
  if (!value) return null;

  return value.replace(
    COMPETITIVE_TIER_ICON_PATH_RE,
    (_full, prefix, tierFolder, suffix) => {
      const normalizedTierFolder = tierFolder
        .replace(/%20/gi, " ")
        .replace(/\s+/g, "_");
      return `${prefix}${normalizedTierFolder}${suffix}`;
    },
  );
}

export function getRankNameFromTier(tier?: number | null): string {
  if (!tier || tier < MIN_RANK_TIER) return "Sin rango";
  return RANK_NAMES[tier] ?? `Tier ${tier}`;
}

export function roundRankTier(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(MIN_RANK_TIER, Math.min(MAX_RANK_TIER, Math.round(value)));
}
