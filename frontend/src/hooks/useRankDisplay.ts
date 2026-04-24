import { useMemo } from "react";
import type { MatchCard, RankInfo } from "../types/dashboard";
import { normalizeLabel } from "../utils/formatters";
import {
  getRankNameFromTier,
  normalizeCompetitiveTierIconPath,
} from "../utils/rankUtils";
import { ACT_FILTER_ALL, ACT_FILTER_CURRENT } from "../constants/dashboard";

export interface RankDisplayResult {
  displayedRankTier: number | null;
  displayedRankName: string;
  displayedRankVisual: string | null;
  highestRankTier: number | null;
  highestRankName: string;
  highestRankVisual: string | null;
  highestRankActId: string | null;
  highestRankActLabel: string;
}

export function useRankDisplay(
  allMatches: MatchCard[],
  actId: string,
  effectiveCurrentActId: string | null,
  rankNameIconMap: Map<string, string>,
  currentRank: RankInfo | undefined,
  actLabelById?: Map<string, string>,
): RankDisplayResult {
  const rankContextMatches = useMemo(() => {
    if (actId === ACT_FILTER_ALL) return allMatches;

    const actIdToUse =
      actId === ACT_FILTER_CURRENT ? effectiveCurrentActId : actId;
    if (!actIdToUse) return [];

    return allMatches.filter((match) => match.seasonId === actIdToUse);
  }, [allMatches, actId, effectiveCurrentActId]);

  const latestRankMatchForAct = useMemo(() => {
    const rankedMatches = [...rankContextMatches]
      .filter((match) => (match.competitiveTier ?? 0) >= 3)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return rankedMatches[0] ?? null;
  }, [rankContextMatches]);

  const latestRankForAct = useMemo(
    () => latestRankMatchForAct?.competitiveTier ?? null,
    [latestRankMatchForAct],
  );

  const latestGlobalRankTier = useMemo(() => {
    const rankedMatches = [...allMatches]
      .filter((match) => (match.competitiveTier ?? 0) >= 3)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return rankedMatches[0]?.competitiveTier ?? null;
  }, [allMatches]);

  const displayedRankTier = useMemo(() => {
    if (actId === ACT_FILTER_ALL) return latestGlobalRankTier;
    return latestRankForAct;
  }, [actId, latestGlobalRankTier, latestRankForAct]);

  const displayedRankName = useMemo(() => {
    if (displayedRankTier) return getRankNameFromTier(displayedRankTier);
    return currentRank?.name ?? getRankNameFromTier(null);
  }, [displayedRankTier, currentRank?.name]);

  const rankContextImageByTier = useMemo(() => {
    const imageMap = new Map<number, string>();
    [...rankContextMatches]
      .filter((m) => (m.competitiveTier ?? 0) >= 3 && m.competitiveTierImage)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .forEach((m) => {
        const icon = normalizeCompetitiveTierIconPath(
          m.competitiveTierImage as string,
        );
        if (m.competitiveTier && icon) {
          imageMap.set(m.competitiveTier, icon);
        }
      });
    return imageMap;
  }, [rankContextMatches]);

  const rankImageByTier = useMemo(() => {
    const imageMap = new Map<number, string>();
    [...allMatches]
      .filter((m) => (m.competitiveTier ?? 0) >= 3 && m.competitiveTierImage)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .forEach((m) => {
        const icon = normalizeCompetitiveTierIconPath(
          m.competitiveTierImage as string,
        );
        if (m.competitiveTier && icon && !imageMap.has(m.competitiveTier)) {
          imageMap.set(m.competitiveTier, icon);
        }
      });
    return imageMap;
  }, [allMatches]);

  const displayedRankVisual = useMemo(() => {
    if (actId === ACT_FILTER_ALL) {
      if (displayedRankTier) {
        const byTier = rankImageByTier.get(displayedRankTier);
        if (byTier) return normalizeCompetitiveTierIconPath(byTier);
      }

      const normalizedName = normalizeLabel(displayedRankName);
      const byName = rankNameIconMap.get(normalizedName);
      if (byName) return normalizeCompetitiveTierIconPath(byName);

      return normalizeCompetitiveTierIconPath(
        currentRank?.image || currentRank?.smallIcon || null,
      );
    }

    const byTier =
      latestRankMatchForAct?.competitiveTierImage ||
      rankContextImageByTier.get(displayedRankTier as number) ||
      null;
    if (byTier) return normalizeCompetitiveTierIconPath(byTier);

    const normalizedName = normalizeLabel(displayedRankName);
    const byName = rankNameIconMap.get(normalizedName);
    if (byName) return normalizeCompetitiveTierIconPath(byName);

    return null;
  }, [
    actId,
    displayedRankTier,
    latestRankMatchForAct,
    rankContextImageByTier,
    rankImageByTier,
    displayedRankName,
    rankNameIconMap,
    currentRank,
  ]);

  const highestRankMatch = useMemo(() => {
    const rankedMatches = allMatches.filter(
      (match) => (match.competitiveTier ?? 0) >= 3,
    );
    if (rankedMatches.length === 0) return null;

    return rankedMatches.reduce((best, current) => {
      const bestTier = best.competitiveTier ?? 0;
      const currentTier = current.competitiveTier ?? 0;
      if (currentTier !== bestTier)
        return currentTier > bestTier ? current : best;
      return (current.timestamp ?? 0) > (best.timestamp ?? 0) ? current : best;
    }, rankedMatches[0]);
  }, [allMatches]);

  const highestRankTier = useMemo(
    () => highestRankMatch?.competitiveTier ?? null,
    [highestRankMatch],
  );

  const highestRankActId = useMemo(() => {
    const seasonId = highestRankMatch?.seasonId;
    return seasonId ? String(seasonId) : null;
  }, [highestRankMatch]);

  const highestRankActLabel = useMemo(() => {
    if (!highestRankActId) return "Acto desconocido";
    return actLabelById?.get(highestRankActId) ?? highestRankActId;
  }, [actLabelById, highestRankActId]);

  const highestRankName = useMemo(
    () => getRankNameFromTier(highestRankTier),
    [highestRankTier],
  );

  const highestRankVisual = useMemo(() => {
    if (!highestRankTier) return null;
    if (highestRankMatch?.competitiveTierImage) {
      return normalizeCompetitiveTierIconPath(
        highestRankMatch.competitiveTierImage,
      );
    }
    const byTier = rankImageByTier.get(highestRankTier);
    if (byTier) return normalizeCompetitiveTierIconPath(byTier);
    const normalizedName = normalizeLabel(highestRankName);
    return normalizeCompetitiveTierIconPath(
      rankNameIconMap.get(normalizedName) ?? null,
    );
  }, [
    highestRankTier,
    highestRankMatch,
    rankImageByTier,
    highestRankName,
    rankNameIconMap,
  ]);

  return {
    displayedRankTier,
    displayedRankName,
    displayedRankVisual,
    highestRankTier,
    highestRankName,
    highestRankVisual,
    highestRankActId,
    highestRankActLabel,
  };
}
