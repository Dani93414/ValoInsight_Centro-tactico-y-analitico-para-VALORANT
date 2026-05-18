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
  activeFilters: Array<{
    key: "search" | "category" | "cost" | "stats" | "sort";
    label: string;
  }>;
};

export type WeaponRankingItem = {
  id: string;
  name: string;
  kills: number;
  rounds: number;
  headshotPct: number;
  image?: string | null;
  hasSufficientHeadshotSample: boolean;
};

export type PersonalWeaponStats = {
  matchesUsed: number;
  wins: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageReceived: number;
  survivalRounds: number;
  loadoutValueTotal: number;
  headshotPct: number;
  winRate: number;
  survivalRate: number;
  kd: number;
  killsPerRound: number;
  damagePerRound: number;
  damageReceivedPerRound: number;
  averageLoadoutValue: number;
  pickRatePerRound: number;
  sampleReliability: string;
};

export type WeaponComparisonTone = "positive" | "neutral" | "improve";

export type WeaponComparisonMetric = {
  key:
    | "rounds"
    | "kills"
    | "killsPerRound"
    | "kd"
    | "damagePerRound"
    | "headshot"
    | "winRate"
    | "deaths"
    | "survivalRate"
    | "damageReceivedPerRound"
    | "averageLoadoutValue"
    | "pickRatePerRound";
  label: string;
  globalLabel: string;
  personalLabel: string;
  diffLabel: string;
  globalNormalizedLabel?: string;
  personalNormalizedLabel?: string;
  normalizedDiffLabel?: string;
  diff?: number;
  normalizedDiff?: number;
  tone: WeaponComparisonTone;
  feedback: string;
};

export type WeaponPersonalComparison = {
  hasSession: boolean;
  isLoading: boolean;
  isError: boolean;
  hasPersonalUsage: boolean;
  hasGlobalReference: boolean;
  sampleReliability: string;
  summary: string;
  metrics: WeaponComparisonMetric[];
};

export type WeaponCompareMetric = {
  key: string;
  label: string;
  firstLabel: string;
  secondLabel: string;
  firstValue?: number;
  secondValue?: number;
};
