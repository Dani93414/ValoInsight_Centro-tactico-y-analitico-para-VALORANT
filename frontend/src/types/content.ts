export type ContentImage = string | null | undefined;

export type NamedContentItem = {
  uuid?: string | null;
  displayName: string;
  displayIcon?: ContentImage;
};

export type ContentSummary = {
  total_agentes?: number;
  total_mapas?: number;
  total_armas?: number;
  total_actos?: number;
  counts?: Record<string, number>;
  version?: Record<string, string | number | boolean | null>;
};

export type MapCallout = {
  regionName?: string | null;
  superRegionName?: string | null;
  location?: {
    x?: number | null;
    y?: number | null;
  } | null;
};

export type MapContent = NamedContentItem & {
  coordinates?: string | null;
  narrativeDescription?: string | null;
  tacticalDescription?: string | null;
  callouts?: MapCallout[];
  splash?: ContentImage;
  listViewIcon?: ContentImage;
  listViewIconTall?: ContentImage;
  stylizedBackgroundImage?: ContentImage;
  premierBackgroundImage?: ContentImage;
};

export type MapGroups = {
  core?: MapContent[];
  skirmish?: MapContent[];
  tdm?: MapContent[];
  training?: MapContent[];
};

export type ActContent = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  isActive?: boolean;
};

export type LeaderboardPlayer = {
  gameName?: string | null;
  tagLine?: string | null;
  leaderboardRank?: number | null;
  rankedRating?: number | null;
  numberOfWins?: number | null;
};

export type LeaderboardContent = {
  act_id: string;
  act_name: string;
  total_players: number;
  returned_players: number;
  players: LeaderboardPlayer[];
};

export type EventContent = NamedContentItem & {
  shortDisplayName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  assetPath?: string | null;
};

export type GameModeContent = NamedContentItem & {
  description?: string | null;
  duration?: string | null;
  roundsPerHalf?: number | null;
  economyType?: string | null;
  orbCount?: number | null;
  teamRoles?: string[];
  isTeamVoiceAllowed?: boolean | null;
  isMinimapHidden?: boolean | null;
  allowsMatchTimeouts?: boolean | null;
  allowsCustomGameReplays?: boolean | null;
  listViewIconTall?: ContentImage;
};

export type GearContent = NamedContentItem & {
  description?: string | null;
  descriptions?: unknown[];
  details?: Record<string, unknown>;
  cost?: number | string | null;
  category?: string | null;
  shopImage?: ContentImage;
};

export type SkinVariantContent = NamedContentItem & {
  fullRender?: ContentImage;
  streamedVideo?: string | null;
  assetPath?: string | null;
};

export type SkinChromaContent = SkinVariantContent & {
  swatch?: ContentImage;
};

export type SkinLevelContent = SkinVariantContent;

export type SkinContent = NamedContentItem & {
  weaponUuid?: string | null;
  weaponName?: string | null;
  weaponImage?: ContentImage;
  contentTierUuid?: string | null;
  themeUuid?: string | null;
  themeName?: string | null;
  wallpaper?: ContentImage;
  cardImage?: ContentImage;
  detailImage?: ContentImage;
  chromasCount?: number;
  levelsCount?: number;
  collectionUuid?: string | null;
  collectionName?: string | null;
  collectionSource?: "bundle" | "theme" | "none" | string | null;
  collectionPromoImage?: ContentImage;
  chromas?: SkinChromaContent[];
  levels?: SkinLevelContent[];
};

export type BundleContent = NamedContentItem & {
  displayIcon2?: ContentImage;
  verticalPromoImage?: ContentImage;
  assetPath?: string | null;
};

export type ThemeContent = NamedContentItem & {
  storeFeaturedImage?: ContentImage;
  assetPath?: string | null;
};

export type BuddyContent = NamedContentItem & {
  themeUuid?: string | null;
  isHiddenIfNotOwned?: boolean | null;
  levelsCount?: number;
};

export type FlexContent = NamedContentItem & {
  displayNameAllCaps?: string | null;
};

export type LevelBorderContent = NamedContentItem & {
  startingLevel?: number | null;
  levelNumber?: number | null;
  levelNumberAppearance?: ContentImage;
  smallPlayerCardAppearance?: ContentImage;
};

export type PlayerTitleContent = NamedContentItem & {
  titleText?: string | null;
  isHiddenIfNotOwned?: boolean | null;
};

export type PlayerCardContent = NamedContentItem & {
  themeUuid?: string | null;
  isHiddenIfNotOwned?: boolean | null;
  smallArt?: ContentImage;
  wideArt?: ContentImage;
  largeArt?: ContentImage;
};

export type SprayContent = NamedContentItem & {
  category?: string | null;
  themeUuid?: string | null;
  fullIcon?: ContentImage;
  fullTransparentIcon?: ContentImage;
  hideIfNotOwned?: boolean | null;
  isNullSpray?: boolean | null;
  isAnimated?: boolean;
  levelsCount?: number;
};

export type VersionInfo = {
  main?: Record<string, string | number | boolean | null>;
  extra?: Record<string, unknown>;
};

export type CompetitiveTierContent = {
  tier?: number | null;
  tierName?: string | null;
  divisionName?: string | null;
  smallIcon?: ContentImage;
  largeIcon?: ContentImage;
  rankTriangleUpIcon?: ContentImage;
  rankTriangleDownIcon?: ContentImage;
};

export type ContentTierContent = NamedContentItem & {
  rank?: number | null;
  highlightColor?: string | null;
};

export type CurrencyContent = NamedContentItem & {
  largeIcon?: ContentImage;
  rewardPreviewIcon?: ContentImage;
  assetPath?: string | null;
};

export type CeremonyContent = NamedContentItem & {
  assetPath?: string | null;
};

export type ContractLevel = {
  level?: number;
  xp?: number | null;
  vpCost?: number | null;
  doughCost?: number | null;
};

export type ContractChapter = {
  chapter?: number;
  levels?: ContractLevel[];
};

export type ContractContent = NamedContentItem & {
  chapters?: ContractChapter[];
};
