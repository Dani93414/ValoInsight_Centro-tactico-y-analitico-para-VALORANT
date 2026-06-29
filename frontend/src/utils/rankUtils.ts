const MIN_RANK_TIER = 3;
const MAX_RANK_TIER = 27;
const COMPETITIVE_TIER_ICON_PATH_RE =
  /(\/content\/competitive_tiers\/[^/]+\/tiers\/)([^/]+)(\/[^?#]*)/i;

export const UNRANKED_RANK_ICON_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 4 54 14v16c0 14-9 24-22 30C19 54 10 44 10 30V14L32 4Z' fill='%23343b4a' stroke='%239aa4b5' stroke-width='4'/%3E%3Cpath d='M21 32h22' stroke='%23d6dbe5' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E";

export type CompetitiveTierIconSource = {
  tier?: number | string | null;
  tierName?: string | null;
  divisionName?: string | null;
  smallIcon?: string | null;
  largeIcon?: string | null;
  rankTriangleUpIcon?: string | null;
  rankTriangleDownIcon?: string | null;
};

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

function tierIcon(source?: CompetitiveTierIconSource | null): string | null {
  return normalizeCompetitiveTierIconPath(
    source?.smallIcon ?? source?.largeIcon ??
      source?.rankTriangleUpIcon ?? source?.rankTriangleDownIcon ?? null,
  );
}

export function resolveCompetitiveTierIcon(
  tier: number | null | undefined,
  observedIcon: string | null | undefined,
  tiers: CompetitiveTierIconSource[] = [],
): string {
  const observed = normalizeCompetitiveTierIconPath(observedIcon);
  if (observed) return observed;

  const numericTier = Number(tier);
  if (Number.isFinite(numericTier)) {
    const exact = tiers.find((item) => Number(item.tier) === numericTier);
    const exactIcon = tierIcon(exact);
    if (exactIcon) return exactIcon;
  }

  const unranked = tiers.find((item) => {
    const itemTier = Number(item.tier);
    const label = `${item.tierName ?? ""} ${item.divisionName ?? ""}`.toLowerCase();
    return (Number.isFinite(itemTier) && itemTier < MIN_RANK_TIER) ||
      label.includes("unranked") || label.includes("sin rango");
  });
  return tierIcon(unranked) ?? UNRANKED_RANK_ICON_FALLBACK;
}

export function applyUnrankedRankIconFallback(image: HTMLImageElement): void {
  if (image.src === UNRANKED_RANK_ICON_FALLBACK) return;
  image.src = UNRANKED_RANK_ICON_FALLBACK;
  image.alt = "Sin rango";
}

export function isRankedTier(tier?: number | null): boolean {
  return Number.isFinite(tier) && Number(tier) >= MIN_RANK_TIER;
}

export function isUnrankedTier(tier?: number | null): boolean {
  return !isRankedTier(tier);
}

export function getUnrankedRankName(): string {
  return "Sin rango";
}

export function roundRankTier(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(MIN_RANK_TIER, Math.min(MAX_RANK_TIER, Math.round(value)));
}
