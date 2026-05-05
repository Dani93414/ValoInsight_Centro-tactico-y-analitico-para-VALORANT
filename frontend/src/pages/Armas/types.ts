import type { RegionWeaponStats } from "../../types/globalStats";
import type { Arma } from "../../types/weapons";

export type WeaponSortKey =
  | "name"
  | "cost"
  | "category"
  | "kills"
  | "headshot"
  | "rounds"
  | "fireRate";

export type WeaponStatsFilter =
  | "all"
  | "withStats"
  | "withoutStats"
  | "weapons"
  | "shields";

export type EnrichedWeapon = Arma & {
  globalStats?: RegionWeaponStats;
  normalizedCategory: string;
  profileTags: string[];
  sampleReliability: string;
};

export type WeaponOverviewStats = {
  totalWeapons: number;
  totalShields: number;
  categories: number;
  topKillsWeapon: string;
  bestHeadshotWeapon: string;
  totalKills: number;
};

export type WeaponInsightItem = {
  label: string;
  value: string;
  hint: string;
};

export type WeaponFilterSummary = {
  total: number;
  shown: number;
  activeLabels: string[];
};

export type WeaponRankingItem = {
  id: string;
  name: string;
  kills: number;
  rounds: number;
  headshotPct: number;
  image?: string | null;
};

