import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getPlayerDashboard } from "../api/stats";
import { getCompetitiveTiers } from "../api/content";
import MatchDetailModal from "./MatchDetailModal";
import AgentDetailModal from "./AgentDetailModal";
import "./Estadisticas.scss";

type PlayerStats = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  region?: string;
  accountLevel?: number;
  totalMatches?: number;
  totalWins?: number;
  totalKills?: number;
  totalDeaths?: number;
  totalAssists?: number;
  totalScore?: number;
  totalPlaytimeMillis?: number;
  totalRoundsPlayed?: number;
  totalHeadshots?: number;
  totalBodyshots?: number;
  totalLegshots?: number;
  mostPlayedAgents?: Array<{
    agentId: string;
    matches: number;
  }>;
};

type WeaponStat = {
  weaponId: string;
  weaponName: string;
  kills: number;
  deaths: number;
  kdRatio: number;
};

type AnalyticsMatch = {
  id: string;
  match_id?: string;
  won_match?: boolean;
  map_name?: string;
  game_start_millis?: number;
  agent_id?: string;
  agent_name?: string;
  role?: string;
  overview?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    acs?: number;
    adr?: number;
    headshot_pct?: number;
    rounds?: number;
    wins?: number;
    headshots?: number;
    bodyshots?: number;
    legshots?: number;
    weapon_stats?: Array<Record<string, unknown>>;
  };
  player_totals_from_match?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    score?: number;
    rounds_played?: number;
  };
};

type MatchCard = {
  id: string;
  seasonId: string;
  dateLabel: string;
  timestamp: number;
  map: string;
  agent: string;
  agentId?: string;
  role: string;
  queue: string;
  mode: string;
  result: "Victoria" | "Derrota";
  ranked: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  playtimeMillis?: number;
  score: number;
  acs: number;
  adr: number;
  hs: number;
  kd: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  competitiveTier?: number;
  competitiveTierImage?: string;
  accountLevel?: number;
  weaponStats: WeaponStat[];
};

type ActSummary = {
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kda: number;
  acs: number;
  killsPerMatch: number;
  hsAvg: number;
};

type RankInfo = {
  tier?: number;
  name: string;
  image?: string;
  smallIcon?: string;
};

type HeaderVisualCard = {
  title: string;
  subtitle: string;
  image?: string | null;
};

type DashboardMetric = {
  label: string;
  value: number;
  percent: number;
  helper: string;
};

type DashboardPayload = {
  player: PlayerStats;
  agentNameMap: Record<string, string>;
  agentMediaMap: Record<string, { name?: string; image?: string | null }>;
  mapMediaMap?: Record<string, string>;
  analyticsList: AnalyticsMatch[];
  currentActId?: string | null;
  currentRank: RankInfo;
  headerShowcase: HeaderVisualCard[];
  mostPlayedAgents: Array<{
    id: string;
    name: string;
    matches: number;
    image?: string | null;
  }>;
  metrics: {
    globalWinRate: number;
    globalKd: number;
    globalAcs: number;
    globalHeadshotPct: number;
    kdaOverall: number;
    avgDeathsPerMatch: number;
    avgAssistsPerMatch: number;
    avgRoundsPerMatch: number;
    killsPerRound: number;
    killsPerMatch: number;
  };
  shotChart: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  performanceMetrics: DashboardMetric[];
  insights: {
    primary?: string;
    mostPlayedAgent?: {
      id: string;
      name: string;
      matches: number;
    } | null;
    bestMap?: {
      map: string;
      matches: number;
      winRate: number;
    } | null;
    bestWeapon?: {
      name: string;
      matches: number;
      kills?: number;
      winRate: number;
    } | null;
  };
  actOptions: Array<{ id: string; label: string }>;
  actSections: Record<
    string,
    {
      summary: ActSummary;
      matches: MatchCard[];
    }
  >;
};

type HeaderCardKind = "agent" | "map" | "weapon" | "default";

type HeaderAgentImageAdjustment = {
  offsetX: number;
  offsetY: number;
  widthDelta: number;
  heightDelta: number;
  fadeStartPct: number;
  fadeMidPct: number;
  fadeEndPct: number;
  transform?: string;
};

type DashboardFilters = {
  actId: string;
  agentId: string;
  map: string;
};

const ACT_FILTER_ALL = "__all_acts__";
const ACT_FILTER_CURRENT = "__current_act__";
const AGENT_FILTER_ALL = "__all_agents__";
const MAP_FILTER_ALL = "__all_maps__";

const DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT: HeaderAgentImageAdjustment = {
  offsetX: 0,
  offsetY: 0,
  widthDelta: 0,
  heightDelta: 0,
  fadeStartPct: 80,
  fadeMidPct: 88,
  fadeEndPct: 95,
};

// Adjustments for the top "Agente mas jugado" image (in pixels).
// Keys are matched by displayName in lowercase.
// fadeStartPct/fadeMidPct/fadeEndPct control how the bottom fade behaves.
const HEADER_AGENT_IMAGE_ADJUSTMENTS_BY_DISPLAY_NAME: Record<
  string,
  Partial<HeaderAgentImageAdjustment>
> = {
  jett: {
    offsetX: -109,
    offsetY: 21,
    widthDelta: 40,
    heightDelta: 6,
    fadeStartPct: 74,
    fadeMidPct: 77,
    fadeEndPct: 89,
  },
  waylay: {
    offsetX: -18,
    offsetY: 14,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 83,
    fadeMidPct: 87,
    fadeEndPct: 92,
  },
  sage: {
    offsetX: -28,
    offsetY: 22,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 72,
    fadeMidPct: 77,
    fadeEndPct: 91,
  },
  killjoy: {
    offsetX: -13,
    offsetY: 15,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 74,
    fadeMidPct: 77,
    fadeEndPct: 89,
  },
  gekko: {
    offsetX: -55,
    offsetY: 47,
    widthDelta: 3,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 75,
    fadeEndPct: 87,
    transform: "scaleX(-1)",
  },
  reyna: {
    offsetX: -60,
    offsetY: 29,
    widthDelta: -10,
    heightDelta: 0,
    fadeStartPct: 74,
    fadeMidPct: 77,
    fadeEndPct: 89,
    transform: "scaleX(-1)",
  },
  raze: {
    offsetX: -45,
    offsetY: 47,
    widthDelta: -10,
    heightDelta: 0,
    fadeStartPct: 74,
    fadeMidPct: 77,
    fadeEndPct: 85,
  },
  "kay/o": {
    offsetX: -25,
    offsetY: 50,
    widthDelta: -80,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 78,
    fadeEndPct: 85,
  },
  tejo: {
    offsetX: -39,
    offsetY: 18,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 79,
    fadeEndPct: 89,
  },
  veto: {
    offsetX: -39,
    offsetY: 72,
    widthDelta: -56,
    heightDelta: 0,
    fadeStartPct: 70,
    fadeMidPct: 74,
    fadeEndPct: 81,
  },
  deadlock: {
    offsetX: -24,
    offsetY: 14,
    widthDelta: -10,
    heightDelta: 0,
    fadeStartPct: 74,
    fadeMidPct: 77,
    fadeEndPct: 89,
  },
  vyse: {
    offsetX: 14,
    offsetY: 68,
    widthDelta: -86,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 75,
    fadeEndPct: 83,
  },
  cypher: {
    offsetX: -11,
    offsetY: 7,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 79,
    fadeEndPct: 95,
  },
  phoenix: {
    offsetX: -49,
    offsetY: 28,
    widthDelta: -17,
    heightDelta: 0,
    fadeStartPct: 84,
    fadeMidPct: 82,
    fadeEndPct: 89,
  },
  harbor: {
    offsetX: -22,
    offsetY: 19,
    widthDelta: -8,
    heightDelta: 0,
    fadeStartPct: 84,
    fadeMidPct: 82,
    fadeEndPct: 89,
  },
  skye: {
    offsetX: -42,
    offsetY: 13,
    widthDelta: -8,
    heightDelta: 0,
    fadeStartPct: 84,
    fadeMidPct: 82,
    fadeEndPct: 89,
    transform: "scaleX(-1)",
  },
  fade: {
    offsetX: 5,
    offsetY: 16,
    widthDelta: -5,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 77,
    fadeEndPct: 86,
  },
  brimstone: {
    offsetX: -6,
    offsetY: 62,
    widthDelta: -81,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 77,
    fadeEndPct: 82,
  },
  astra: {
    offsetX: 49,
    offsetY: 83,
    widthDelta: -81,
    heightDelta: 0,
    fadeStartPct: 71,
    fadeMidPct: 74,
    fadeEndPct: 80,
  },
  chamber: {
    offsetX: -98,
    offsetY: 7,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 82,
    fadeMidPct: 84,
    fadeEndPct: 92,
  },
  yoru: {
    offsetX: -88,
    offsetY: 17,
    widthDelta: -25,
    heightDelta: 0,
    fadeStartPct: 78,
    fadeMidPct: 81,
    fadeEndPct: 88,
    transform: "scaleX(-1)",
  },
  neon: {
    offsetX: -35,
    offsetY: 57,
    widthDelta: -52,
    heightDelta: 0,
    fadeStartPct: 70,
    fadeMidPct: 75,
    fadeEndPct: 84,
  },
  viper: {
    offsetX: -84,
    offsetY: 6,
    widthDelta: -26,
    heightDelta: 0,
    fadeStartPct: 79,
    fadeMidPct: 88,
    fadeEndPct: 92,
  },
  iso: {
    offsetX: -20,
    offsetY: 46,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 78,
    fadeEndPct: 84,
  },
  clove: {
    offsetX: -81,
    offsetY: 9,
    widthDelta: 0,
    heightDelta: 0,
    fadeStartPct: 75,
    fadeMidPct: 79,
    fadeEndPct: 89,
  },
  breach: {
    offsetX: -48,
    offsetY: 17,
    widthDelta: -20,
    heightDelta: 0,
    fadeStartPct: 76,
    fadeMidPct: 79,
    fadeEndPct: 88,
  },
  omen: {
    offsetX: -30,
    offsetY: 8,
    widthDelta: -10,
    heightDelta: 0,
    fadeStartPct: 77,
    fadeMidPct: 79,
    fadeEndPct: 88,
  },
};

function normalizeDisplayName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getHeaderAgentImageAdjustmentByDisplayName(
  displayName?: string | null,
): HeaderAgentImageAdjustment {
  const key = normalizeDisplayName(displayName);
  const customAdjustment = key
    ? HEADER_AGENT_IMAGE_ADJUSTMENTS_BY_DISPLAY_NAME[key]
    : undefined;

  return {
    offsetX:
      customAdjustment?.offsetX ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.offsetX,
    offsetY:
      customAdjustment?.offsetY ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.offsetY,
    widthDelta:
      customAdjustment?.widthDelta ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.widthDelta,
    heightDelta:
      customAdjustment?.heightDelta ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.heightDelta,
    fadeStartPct:
      customAdjustment?.fadeStartPct ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.fadeStartPct,
    fadeMidPct:
      customAdjustment?.fadeMidPct ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.fadeMidPct,
    fadeEndPct:
      customAdjustment?.fadeEndPct ??
      DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT.fadeEndPct,
    transform:
      customAdjustment?.transform ??
      (DEFAULT_HEADER_AGENT_IMAGE_ADJUSTMENT as any).transform ??
      undefined,
  };
}

function formatNumber(value?: number, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value?: number, decimals = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, decimals)}%`;
}

function formatHours(ms?: number) {
  if (!ms) return "-";
  return `${formatNumber(ms / 1000 / 60 / 60, 1)} h`;
}

function getRankNameFromTier(tier?: number | null) {
  if (!tier || tier < 3) return "Sin rango";

  const names: Record<number, string> = {
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

  return names[tier] ?? `Tier ${tier}`;
}

function roundRankTier(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(3, Math.min(27, Math.round(value)));
}

function buildSvgPlaceholder(
  title: string,
  subtitle: string,
  accent = "#ff4655",
) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const safeSubtitle = subtitle.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#21252d"/>
          <stop offset="100%" stop-color="#11141a"/>
        </linearGradient>
        <radialGradient id="g2" cx="80%" cy="20%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#g1)"/>
      <rect width="640" height="360" rx="24" fill="url(#g2)"/>
      <rect x="20" y="20" width="600" height="320" rx="18" fill="none" stroke="rgba(255,255,255,0.10)"/>
      <text x="40" y="70" fill="#8d94a1" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">${safeSubtitle}</text>
      <text x="40" y="130" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900">${safeTitle}</text>
      <circle cx="535" cy="105" r="54" fill="${accent}" opacity="0.14"/>
      <circle cx="535" cy="105" r="34" fill="${accent}" opacity="0.24"/>
      <rect x="40" y="250" width="180" height="12" rx="6" fill="rgba(255,255,255,0.10)"/>
      <rect x="40" y="276" width="260" height="12" rx="6" fill="rgba(255,255,255,0.06)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveMapImage(
  mapName?: string,
  mapMediaMap?: Record<string, string>,
) {
  const normalizedMapName = _normalizeRankLabelFrontend(mapName);
  if (normalizedMapName && mapMediaMap?.[normalizedMapName]) {
    return mapMediaMap[normalizedMapName];
  }

  return buildSvgPlaceholder(
    mapName || "Mapa desconocido",
    "Mapa destacado",
    "#ff7a85",
  );
}

function resolveWeaponImage(weaponName?: string) {
  return buildSvgPlaceholder(
    weaponName || "Arma desconocida",
    "Arma con mas kills",
    "#ff4655",
  );
}

function getHeaderCardKind(subtitle: string): HeaderCardKind {
  const normalized = subtitle.toLowerCase();

  if (normalized.includes("arma")) return "weapon";
  if (normalized.includes("mapa")) return "map";
  if (normalized.includes("agente")) return "agent";

  return "default";
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function HeaderShowcaseCard(props: HeaderVisualCard) {
  const { title, subtitle, image } = props;
  const kind = getHeaderCardKind(subtitle);
  const resolvedImage = image || buildSvgPlaceholder(title, subtitle);

  if (kind === "agent") {
    const headerImageAdjustment =
      getHeaderAgentImageAdjustmentByDisplayName(title);
    const figureStyle: React.CSSProperties = {
      ["--agent-figure-offset-x" as string]: `${headerImageAdjustment.offsetX}px`,
      ["--agent-figure-offset-y" as string]: `${headerImageAdjustment.offsetY}px`,
      ["--agent-figure-width-delta" as string]: `${headerImageAdjustment.widthDelta}px`,
      ["--agent-figure-height-delta" as string]: `${headerImageAdjustment.heightDelta}px`,
      ["--agent-figure-fade-start" as string]: `${headerImageAdjustment.fadeStartPct}%`,
      ["--agent-figure-fade-mid" as string]: `${headerImageAdjustment.fadeMidPct}%`,
      ["--agent-figure-fade-end" as string]: `${headerImageAdjustment.fadeEndPct}%`,
      // Apply optional transform (e.g. "scaleX(-1)") for specific agents like Gekko
      ...(headerImageAdjustment.transform
        ? { transform: headerImageAdjustment.transform }
        : {}),
    };

    return (
      <article className="header-showcase-agent-stage" data-kind={kind}>
        <div className="header-showcase-agent-media">
          <img
            src={resolvedImage}
            alt={title}
            className="header-showcase-agent-figure"
            style={figureStyle}
          />
        </div>
      </article>
    );
  }

  const cardClassName = [
    "header-showcase-card",
    "header-showcase-card-vertical",
    kind === "map" ? "header-showcase-card-map" : "",
    kind === "weapon" ? "header-showcase-card-weapon" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const imageClassName = [
    "header-showcase-image",
    kind === "weapon" ? "header-showcase-image-weapon" : "",
    kind === "map" ? "header-showcase-image-map" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClassName = [
    "header-showcase-overlay",
    kind === "map" ? "header-showcase-overlay-map" : "",
    kind === "weapon" ? "header-showcase-overlay-weapon" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Render map cards via <img> to avoid background-image refresh issues.
  if (kind === "map") {
    return (
      <article className={cardClassName} data-kind={kind}>
        <div className="header-showcase-media">
          <img src={resolvedImage} alt={title} className={imageClassName} />
          <div className={overlayClassName} />
        </div>

        <div className="header-showcase-copy">
          <span className="header-showcase-subtitle">{subtitle}</span>
          <strong className="header-showcase-title">{title}</strong>
        </div>
      </article>
    );
  }

  return (
    <article className={cardClassName} data-kind={kind}>
      <div className="header-showcase-media">
        <img src={resolvedImage} alt={title} className={imageClassName} />
        <div className={overlayClassName} />
      </div>

      <div className="header-showcase-copy">
        <span className="header-showcase-subtitle">{subtitle}</span>
        <strong className="header-showcase-title">{title}</strong>
      </div>
    </article>
  );
}

export default function Estadisticas() {
  const MATCHES_PER_PAGE = 8;
  const DASHBOARD_MATCH_LIMIT = 300;
  const { playerId } = useParams();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    actId: ACT_FILTER_CURRENT,
    agentId: AGENT_FILTER_ALL,
    map: MAP_FILTER_ALL,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [rankNameIconMap, setRankNameIconMap] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      setDashboard(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await getPlayerDashboard(
          playerId,
          DASHBOARD_MATCH_LIMIT,
        );
        if (cancelled) return;
        setDashboard((result as DashboardPayload) ?? null);
      } catch {
        if (!cancelled) setDashboard(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tiers = await getCompetitiveTiers();
        if (!mounted || !Array.isArray(tiers)) return;
        const m = new Map<string, string>();
        for (const t of tiers) {
          const tier = Number(t?.tier);
          const icon =
            t?.smallIcon ||
            t?.largeIcon ||
            t?.rankTriangleUpIcon ||
            t?.rankTriangleDownIcon;
          const tierName = _normalizeRankLabelFrontend(t?.tierName);
          const divisionName = _normalizeRankLabelFrontend(t?.divisionName);

          if (tierName && icon && !m.has(tierName)) m.set(tierName, icon);

          if (divisionName && icon && Number.isFinite(tier) && tier >= 3) {
            const divisionLevel = ((tier - 3) % 3) + 1;
            const divisionKey = `${divisionName} ${divisionLevel}`;
            if (!m.has(divisionKey)) m.set(divisionKey, icon);
          }

          if (Number.isFinite(tier)) {
            const english = _normalizeRankLabelFrontend(
              getRankNameFromTier(tier),
            );
            if (english && icon && !m.has(english)) m.set(english, icon);
          }
        }
        setRankNameIconMap(m);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const player = dashboard?.player;
  const actOptions = dashboard?.actOptions ?? [];
  const currentActId = dashboard?.currentActId ?? actOptions[0]?.id ?? null;

  const actFilterOptions = useMemo(() => {
    return [
      { id: ACT_FILTER_CURRENT, label: "Acto actual" },
      { id: ACT_FILTER_ALL, label: "Todos los actos" },
      ...actOptions,
    ];
  }, [actOptions]);

  const allMatches = useMemo(() => {
    if (!dashboard) return [];
    return Object.values(dashboard.actSections).flatMap(
      (section) => section.matches ?? [],
    );
  }, [dashboard]);

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();

    allMatches.forEach((match) => {
      if (match.agentId && match.agent) {
        map.set(match.agentId, match.agent);
      }
    });

    return [
      { id: AGENT_FILTER_ALL, label: "Todos los agentes" },
      ...Array.from(map.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    ];
  }, [allMatches]);

  const mapOptions = useMemo(() => {
    const maps = Array.from(
      new Set(allMatches.map((match) => match.map).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "es"));

    return [
      { id: MAP_FILTER_ALL, label: "Todos los mapas" },
      ...maps.map((map) => ({ id: map, label: map })),
    ];
  }, [allMatches]);

  const effectiveActId = useMemo(() => {
    if (filters.actId === ACT_FILTER_ALL) return null;
    if (filters.actId === ACT_FILTER_CURRENT) return currentActId;
    return filters.actId;
  }, [filters.actId, currentActId]);

  const filteredMatches = useMemo(() => {
    return allMatches.filter((match) => {
      const matchesAct = effectiveActId
        ? match.seasonId === effectiveActId
        : true;

      const matchesAgent =
        filters.agentId === AGENT_FILTER_ALL
          ? true
          : match.agentId === filters.agentId;
      const matchesMap =
        filters.map === MAP_FILTER_ALL ? true : match.map === filters.map;

      return matchesAct && matchesAgent && matchesMap;
    });
  }, [allMatches, effectiveActId, filters.agentId, filters.map]);

  const rankContextMatches = useMemo(() => {
    if (filters.actId === ACT_FILTER_ALL) {
      return allMatches;
    }

    const actIdToUse =
      filters.actId === ACT_FILTER_CURRENT ? currentActId : filters.actId;

    if (!actIdToUse) return [];

    return allMatches.filter((match) => match.seasonId === actIdToUse);
  }, [allMatches, filters.actId, currentActId]);

  const latestRankMatchForAct = useMemo(() => {
    const rankedMatches = [...rankContextMatches]
      .filter((match) => (match.competitiveTier ?? 0) >= 3)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    return rankedMatches[0] ?? null;
  }, [rankContextMatches]);

  const latestRankForAct = useMemo(() => {
    return latestRankMatchForAct?.competitiveTier ?? null;
  }, [latestRankMatchForAct]);

  const averageGlobalRankTier = useMemo(() => {
    const rankedTiers = allMatches
      .map((match) => match.competitiveTier)
      .filter((tier): tier is number => typeof tier === "number" && tier >= 3);

    if (rankedTiers.length === 0) return null;

    const avg =
      rankedTiers.reduce((sum, tier) => sum + tier, 0) / rankedTiers.length;
    return roundRankTier(avg);
  }, [allMatches]);

  const displayedRankTier = useMemo(() => {
    if (filters.actId === ACT_FILTER_ALL) {
      return averageGlobalRankTier;
    }

    return latestRankForAct;
  }, [filters.actId, averageGlobalRankTier, latestRankForAct]);

  const displayedRankName = useMemo(() => {
    if (displayedRankTier) return getRankNameFromTier(displayedRankTier);
    return dashboard?.currentRank?.name ?? getRankNameFromTier(null);
  }, [displayedRankTier, dashboard?.currentRank?.name]);

  const rankContextImageByTier = useMemo(() => {
    const imageMap = new Map<number, string>();
    [...rankContextMatches]
      .filter((m) => (m.competitiveTier ?? 0) >= 3 && m.competitiveTierImage)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .forEach((m) => {
        if (m.competitiveTier)
          imageMap.set(m.competitiveTier, m.competitiveTierImage as string);
      });
    return imageMap;
  }, [rankContextMatches]);

  const rankImageByTier = useMemo(() => {
    const imageMap = new Map<number, string>();
    [...allMatches]
      .filter((m) => (m.competitiveTier ?? 0) >= 3 && m.competitiveTierImage)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .forEach((m) => {
        if (m.competitiveTier && !imageMap.has(m.competitiveTier)) {
          imageMap.set(m.competitiveTier, m.competitiveTierImage as string);
        }
      });
    return imageMap;
  }, [allMatches]);

  const displayedRankVisual = useMemo(() => {
    if (filters.actId === ACT_FILTER_ALL) {
      if (displayedRankTier) {
        const byTier = rankImageByTier.get(displayedRankTier);
        if (byTier) return byTier;
      }

      const normalizedName = _normalizeRankLabelFrontend(displayedRankName);
      const byName = rankNameIconMap.get(normalizedName);
      if (byName) return byName;

      return (
        dashboard?.currentRank?.image ||
        dashboard?.currentRank?.smallIcon ||
        null
      );
    }

    const byTier =
      latestRankMatchForAct?.competitiveTierImage ||
      rankContextImageByTier.get(displayedRankTier as number) ||
      null;
    if (byTier) return byTier;

    const normalizedName = _normalizeRankLabelFrontend(displayedRankName);
    const byName = rankNameIconMap.get(normalizedName);
    if (byName) return byName;

    return null;
  }, [
    filters.actId,
    displayedRankTier,
    latestRankMatchForAct,
    rankContextImageByTier,
    rankImageByTier,
    displayedRankName,
    rankNameIconMap,
    dashboard?.currentRank,
  ]);

  useEffect(() => {
    // Debug logs to investigate image selection when filters change
    // Remove or comment out in production
    // eslint-disable-next-line no-console
    console.log(
      "[Rank Debug] act filter:",
      filters.actId,
      "displayedRankName:",
      displayedRankName,
    );
    // eslint-disable-next-line no-console
    console.log("[Rank Debug] latestRankMatchForAct:", latestRankMatchForAct);
    // eslint-disable-next-line no-console
    console.log(
      "[Rank Debug] rankContextImageByTier:",
      Object.fromEntries(rankContextImageByTier),
    );
    // eslint-disable-next-line no-console
    console.log(
      "[Rank Debug] rankImageByTier:",
      Object.fromEntries(rankImageByTier),
    );
    // eslint-disable-next-line no-console
    console.log("[Rank Debug] dashboard.currentRank:", dashboard?.currentRank);
    // eslint-disable-next-line no-console
    console.log("[Rank Debug] displayedRankVisual:", displayedRankVisual);
  }, [
    filters.actId,
    displayedRankName,
    latestRankMatchForAct,
    rankContextImageByTier,
    rankImageByTier,
    dashboard,
    displayedRankVisual,
  ]);

  const derivedSummary = useMemo(() => {
    const matches = filteredMatches.length;
    const wins = filteredMatches.filter((m) => m.result === "Victoria").length;
    const kills = filteredMatches.reduce((sum, m) => sum + (m.kills ?? 0), 0);
    const deaths = filteredMatches.reduce((sum, m) => sum + (m.deaths ?? 0), 0);
    const assists = filteredMatches.reduce(
      (sum, m) => sum + (m.assists ?? 0),
      0,
    );
    const rounds = filteredMatches.reduce((sum, m) => sum + (m.rounds ?? 0), 0);
    const score = filteredMatches.reduce((sum, m) => sum + (m.score ?? 0), 0);
    const hsTotal = filteredMatches.reduce((sum, m) => sum + (m.hs ?? 0), 0);

    const headshots = filteredMatches.reduce(
      (sum, m) => sum + (m.headshots ?? 0),
      0,
    );
    const bodyshots = filteredMatches.reduce(
      (sum, m) => sum + (m.bodyshots ?? 0),
      0,
    );
    const legshots = filteredMatches.reduce(
      (sum, m) => sum + (m.legshots ?? 0),
      0,
    );

    const winRate = matches ? (wins / matches) * 100 : 0;
    const kd = deaths ? kills / deaths : kills;
    const kda = deaths ? (kills + assists) / deaths : kills + assists;
    const acs = rounds ? score / rounds : 0;
    const killsPerMatch = matches ? kills / matches : 0;
    const avgDeathsPerMatch = matches ? deaths / matches : 0;
    const avgAssistsPerMatch = matches ? assists / matches : 0;
    const avgRoundsPerMatch = matches ? rounds / matches : 0;
    const killsPerRound = rounds ? kills / rounds : 0;
    const globalHeadshotPct = matches ? hsTotal / matches : 0;

    return {
      matches,
      wins,
      kills,
      deaths,
      assists,
      rounds,
      score,
      hsTotal,
      headshots,
      bodyshots,
      legshots,
      winRate,
      kd,
      kda,
      acs,
      killsPerMatch,
      avgDeathsPerMatch,
      avgAssistsPerMatch,
      avgRoundsPerMatch,
      killsPerRound,
      globalHeadshotPct,
    };
  }, [filteredMatches]);

  const filteredPlaytimeMillis = useMemo(() => {
    return filteredMatches.reduce(
      (sum, match) => sum + (match.playtimeMillis ?? 0),
      0,
    );
  }, [filteredMatches]);

  const latestFilteredAccountLevel = useMemo(() => {
    if (!filteredMatches.length) {
      return player?.accountLevel ?? 0;
    }

    const latestMatch = filteredMatches.reduce((latest, current) => {
      if ((current.timestamp ?? 0) > (latest.timestamp ?? 0)) {
        return current;
      }
      return latest;
    }, filteredMatches[0]);

    return latestMatch.accountLevel ?? player?.accountLevel ?? 0;
  }, [filteredMatches, player?.accountLevel]);

  const metrics = useMemo(
    () => ({
      globalWinRate: derivedSummary.winRate,
      globalKd: derivedSummary.kd,
      globalAcs: derivedSummary.acs,
      globalHeadshotPct: derivedSummary.globalHeadshotPct,
      kdaOverall: derivedSummary.kda,
      avgDeathsPerMatch: derivedSummary.avgDeathsPerMatch,
      avgAssistsPerMatch: derivedSummary.avgAssistsPerMatch,
      avgRoundsPerMatch: derivedSummary.avgRoundsPerMatch,
      killsPerRound: derivedSummary.killsPerRound,
      killsPerMatch: derivedSummary.killsPerMatch,
    }),
    [derivedSummary],
  );

  const actSummary = useMemo<ActSummary>(
    () => ({
      matches: derivedSummary.matches,
      wins: derivedSummary.wins,
      winRate: derivedSummary.winRate,
      kd: derivedSummary.kd,
      kda: derivedSummary.kda,
      acs: derivedSummary.acs,
      killsPerMatch: derivedSummary.killsPerMatch,
      hsAvg: derivedSummary.globalHeadshotPct,
    }),
    [derivedSummary],
  );

  const filteredShotChart = useMemo(() => {
    const totalShots =
      derivedSummary.headshots +
      derivedSummary.bodyshots +
      derivedSummary.legshots;

    if (!totalShots) return [];

    return [
      {
        name: "Headshots",
        value: derivedSummary.headshots,
        percentage: (derivedSummary.headshots / totalShots) * 100,
        color: "#ff4655",
      },
      {
        name: "Bodyshots",
        value: derivedSummary.bodyshots,
        percentage: (derivedSummary.bodyshots / totalShots) * 100,
        color: "#ff7a85",
      },
      {
        name: "Legshots",
        value: derivedSummary.legshots,
        percentage: (derivedSummary.legshots / totalShots) * 100,
        color: "#7f2c33",
      },
    ].filter((item) => item.value > 0);
  }, [derivedSummary]);

  const mostPlayedAgents = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; name: string; matches: number; image?: string | null }
    >();

    filteredMatches.forEach((match) => {
      if (!match.agentId) return;

      const current = grouped.get(match.agentId);
      const media = dashboard?.agentMediaMap?.[match.agentId];

      if (current) {
        current.matches += 1;
      } else {
        grouped.set(match.agentId, {
          id: match.agentId,
          name: match.agent || media?.name || "Agente",
          matches: 1,
          image: media?.image ?? null,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.matches - a.matches);
  }, [filteredMatches, dashboard]);

  const bestMapWinrateInsight = useMemo(() => {
    const grouped = new Map<
      string,
      { map: string; matches: number; wins: number }
    >();

    filteredMatches.forEach((match) => {
      if (!match.map || match.map === "-") return;

      const current = grouped.get(match.map) ?? {
        map: match.map,
        matches: 0,
        wins: 0,
      };

      current.matches += 1;
      if (match.result === "Victoria") current.wins += 1;
      grouped.set(match.map, current);
    });

    const sorted = Array.from(grouped.values())
      .filter((item) => item.matches > 0)
      .map((item) => ({
        map: item.map,
        matches: item.matches,
        winRate: (item.wins / item.matches) * 100,
      }))
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.matches - a.matches;
      });

    return sorted[0] ?? null;
  }, [filteredMatches]);

  const bestWeaponInsight = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; matches: number; wins: number; kills: number }
    >();

    filteredMatches.forEach((match) => {
      (match.weaponStats ?? []).forEach((weapon) => {
        const hasUsage =
          (weapon.kills ?? 0) > 0 ||
          (weapon.deaths ?? 0) > 0 ||
          (weapon.kdRatio ?? 0) > 0;

        if (!hasUsage) return;

        const key = weapon.weaponId || weapon.weaponName || "unknown";
        const current = grouped.get(key) ?? {
          name: weapon.weaponName || "Arma desconocida",
          matches: 0,
          wins: 0,
          kills: 0,
        };

        current.matches += 1;
        current.kills += weapon.kills ?? 0;
        if (match.result === "Victoria") current.wins += 1;
        grouped.set(key, current);
      });
    });

    const sorted = Array.from(grouped.values())
      .map((item) => ({
        name: item.name,
        matches: item.matches,
        kills: item.kills,
        winRate: item.matches ? (item.wins / item.matches) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.matches - a.matches;
      });

    return sorted[0] ?? null;
  }, [filteredMatches]);

  const primaryInsight = useMemo(() => {
    if (metrics.globalHeadshotPct >= 25) return "Precision alta";
    if (metrics.globalKd >= 1.1) return "Buen impacto ofensivo";
    if (metrics.globalWinRate >= 50) return "Rendimiento competitivo";
    return "Progresion constante";
  }, [metrics]);

  const mostPlayedAgentInsight = mostPlayedAgents[0] ?? null;

  const performanceMetrics = useMemo<DashboardMetric[]>(() => {
    return [
      {
        label: "KD",
        value: metrics.globalKd,
        percent: Math.min(metrics.globalKd * 50, 100),
        helper: "1.00 es equilibrio",
      },
      {
        label: "Win Rate",
        value: metrics.globalWinRate,
        percent: Math.min(metrics.globalWinRate, 100),
        helper: "porcentaje de victorias",
      },
      {
        label: "Headshot %",
        value: metrics.globalHeadshotPct,
        percent: Math.min(metrics.globalHeadshotPct, 100),
        helper: "precision a la cabeza",
      },
      {
        label: "ACS",
        value: metrics.globalAcs,
        percent: Math.min((metrics.globalAcs / 300) * 100, 100),
        helper: "impacto medio por ronda",
      },
      {
        label: "Kills / partida",
        value: metrics.killsPerMatch,
        percent: Math.min(metrics.killsPerMatch * 4, 100),
        helper: "media filtrada",
      },
      {
        label: "KDA",
        value: metrics.kdaOverall,
        percent: Math.min(metrics.kdaOverall * 33.33, 100),
        helper: "kills + assists / deaths",
      },
    ];
  }, [metrics]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMatches.length / MATCHES_PER_PAGE)),
    [filteredMatches.length],
  );

  const pagedMatches = useMemo(() => {
    const start = (currentPage - 1) * MATCHES_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [filteredMatches, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando estadisticas</h2>
          <p>Preparando el dashboard del jugador...</p>
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <span className="stats-eyebrow">Valorant</span>
          <h1 className="stats-title">Estadisticas</h1>
          <p className="stats-subtitle">
            Usa el buscador de la pagina principal para abrir el perfil de un
            jugador.
          </p>
          <div className="stats-divider" />
        </div>

        <div className="empty-panel">No hay un jugador seleccionado.</div>
      </div>
    );
  }

  if (!dashboard || !player) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <span className="stats-eyebrow">Valorant</span>
          <h1 className="stats-title">Estadisticas</h1>
          <p className="stats-subtitle">
            No se encontraron datos del jugador seleccionado.
          </p>
          <div className="stats-divider" />
        </div>

        <div className="empty-panel">
          No se pudieron cargar estadisticas para este jugador.
        </div>
      </div>
    );
  }

  const currentRank = dashboard.currentRank;
  const rankVisual =
    displayedRankVisual ?? currentRank.image ?? currentRank.smallIcon ?? null;

  const totalMatches = derivedSummary.matches;
  const totalWins = derivedSummary.wins;
  const totalKills = derivedSummary.kills;
  const totalDeaths = derivedSummary.deaths;
  const totalRounds = derivedSummary.rounds;
  const totalHeadshots = derivedSummary.headshots;

  const headerShowcase: HeaderVisualCard[] = [
    {
      title: mostPlayedAgentInsight?.name ?? "Agente",
      subtitle: "Agente mas jugado",
      image: mostPlayedAgentInsight?.id
        ? (dashboard.agentMediaMap?.[mostPlayedAgentInsight.id]?.image ?? null)
        : null,
    },
    {
      title: bestMapWinrateInsight?.map ?? "Mapa destacado",
      subtitle: "Mapa con mejor winrate",
      image: bestMapWinrateInsight?.map
        ? resolveMapImage(bestMapWinrateInsight.map, dashboard.mapMediaMap)
        : (dashboard?.headerShowcase?.[1]?.image ?? null),
    },
    {
      title: bestWeaponInsight?.name ?? "Arma destacada",
      subtitle: "Arma con mas kills",
      image: bestWeaponInsight?.name
        ? (dashboard?.headerShowcase?.[2]?.image ??
          resolveWeaponImage(bestWeaponInsight.name))
        : null,
    },
  ].map((card) => {
    const kind = getHeaderCardKind(card.subtitle);

    if (kind === "map" && !card.image) {
      return {
        ...card,
        image: resolveMapImage(card.title, dashboard.mapMediaMap),
      };
    }

    if (kind === "weapon" && !card.image) {
      return { ...card, image: resolveWeaponImage(card.title) };
    }

    return card;
  });

  return (
    <div className="stats-container">
      <div className="stats-header">
        <span className="stats-eyebrow">Valorant</span>

        <div className="stats-header-grid">
          <div className="player-header-main">
            <div>
              <h1 className="stats-title player-title-main">
                <span className="player-name-line">
                  {player.gameName || "Jugador"}
                </span>
                {player.tagLine ? (
                  <span className="player-tag">#{player.tagLine}</span>
                ) : null}
              </h1>

              <div className="player-rank-block">
                {rankVisual ? (
                  <img
                    src={rankVisual}
                    alt={displayedRankName}
                    className="player-rank-image"
                  />
                ) : (
                  <div
                    className="player-rank-image player-rank-image-fallback"
                    aria-label="Icono de rango no disponible"
                  >
                    N/A
                  </div>
                )}

                <div className="player-rank-text">
                  <span className="player-rank-label">
                    {filters.actId === ACT_FILTER_ALL
                      ? "Rango medio global"
                      : "Rango del acto"}
                  </span>
                  <strong>{displayedRankName}</strong>
                </div>
              </div>
            </div>

            <div className="stats-divider" />

            <div className="player-hero player-hero-spacing">
              <div className="player-identity player-identity-main">
                <div className="player-meta">
                  <span className="meta-pill">
                    Region: {player.region ?? "-"}
                  </span>
                  <span className="meta-pill">
                    Nivel: {formatNumber(latestFilteredAccountLevel)}
                  </span>
                  <span className="meta-pill">
                    Partidas: {formatNumber(totalMatches)}
                  </span>
                  <span className="meta-pill">
                    H Jugadas: {formatHours(filteredPlaytimeMillis)}
                  </span>
                </div>

                <div className="player-highlight-grid">
                  <div className="highlight-box">
                    <span>Win Rate</span>
                    <strong>{formatPercent(metrics.globalWinRate, 1)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>KD</span>
                    <strong>{formatNumber(metrics.globalKd, 2)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>ACS</span>
                    <strong>{formatNumber(metrics.globalAcs, 1)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>Headshot %</span>
                    <strong>
                      {formatPercent(metrics.globalHeadshotPct, 1)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="header-showcase-grid header-showcase-grid-vertical">
            {headerShowcase.map((card) => (
              <HeaderShowcaseCard
                key={`${card.subtitle}-${card.title}`}
                title={card.title}
                subtitle={card.subtitle}
                image={card.image}
              />
            ))}
          </div>
        </div>
      </div>

      <section className="hero-metrics">
        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">Win Rate</span>
          <strong className="hero-metric-value">
            {formatPercent(metrics.globalWinRate, 1)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalWins)} victorias de {formatNumber(totalMatches)}{" "}
            partidas
          </small>
        </div>

        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">KD Global</span>
          <strong className="hero-metric-value">
            {formatNumber(metrics.globalKd, 2)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalKills)} K / {formatNumber(totalDeaths)} D
          </small>
        </div>

        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">ACS</span>
          <strong className="hero-metric-value">
            {formatNumber(metrics.globalAcs, 1)}
          </strong>
          <small className="hero-metric-hint">impacto medio por ronda</small>
        </div>

        <div className="hero-metric hero-metric-secondary">
          <span className="hero-metric-label">Headshot %</span>
          <strong className="hero-metric-value">
            {formatPercent(metrics.globalHeadshotPct, 1)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalHeadshots)} headshots totales
          </small>
        </div>
      </section>

      <section className="stats-kpis stats-kpis-secondary">
        <KpiCard
          label="Kills / partida"
          value={formatNumber(metrics.killsPerMatch, 2)}
          hint={`${formatNumber(totalKills)} kills totales`}
        />
        <KpiCard
          label="Deaths / partida"
          value={formatNumber(metrics.avgDeathsPerMatch, 2)}
          hint={`${formatNumber(totalDeaths)} muertes totales`}
        />
        <KpiCard
          label="Assists / partida"
          value={formatNumber(metrics.avgAssistsPerMatch, 2)}
          hint={`${formatNumber(derivedSummary.assists)} asistencias totales`}
        />
        <KpiCard
          label="KDA global"
          value={formatNumber(metrics.kdaOverall, 2)}
          hint="(kills + assists) / deaths"
        />
        <KpiCard
          label="Rondas / partida"
          value={formatNumber(metrics.avgRoundsPerMatch, 1)}
          hint={`${formatNumber(totalRounds)} rondas jugadas`}
        />
        <KpiCard
          label="Kills / ronda"
          value={formatNumber(metrics.killsPerRound, 2)}
          hint="ritmo ofensivo"
        />
      </section>

      <section className="insight-strip">
        <div className="insight-card">
          <span className="insight-label">Fortaleza principal</span>
          <strong className="insight-value">{primaryInsight}</strong>
          <small className="insight-hint">
            HS {formatPercent(metrics.globalHeadshotPct, 1)} · ACS{" "}
            {formatNumber(metrics.globalAcs, 1)}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Ritmo de juego</span>
          <strong className="insight-value">
            {formatNumber(metrics.killsPerMatch, 2)} kills/partida
          </strong>
          <small className="insight-hint">
            {formatNumber(metrics.killsPerRound, 2)} kills por ronda
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Consistencia</span>
          <strong className="insight-value">
            {formatNumber(metrics.avgRoundsPerMatch, 1)} rondas/partida
          </strong>
          <small className="insight-hint">
            KDA {formatNumber(metrics.kdaOverall, 2)}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Agente mas jugado</span>
          <strong className="insight-value">
            {mostPlayedAgentInsight?.name ?? "Sin datos"}
          </strong>
          <small className="insight-hint">
            {mostPlayedAgentInsight
              ? `${formatNumber(mostPlayedAgentInsight.matches)} partidas`
              : "No hay partidas suficientes"}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Mapa con mejor win rate</span>
          <strong className="insight-value">
            {bestMapWinrateInsight?.map ?? "Sin datos de mapas"}
          </strong>
          <small className="insight-hint">
            {bestMapWinrateInsight
              ? `${formatPercent(bestMapWinrateInsight.winRate, 1)} · ${formatNumber(bestMapWinrateInsight.matches)} partidas`
              : "No hay suficientes datos"}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Arma con mas kills</span>
          <strong className="insight-value">
            {bestWeaponInsight?.name ?? "Sin datos de armas"}
          </strong>
          <small className="insight-hint">
            {bestWeaponInsight
              ? `${formatNumber(bestWeaponInsight.kills ?? 0)} kills · ${formatNumber(bestWeaponInsight.matches)} partidas`
              : "No hay weapon_stats disponibles"}
          </small>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stats-panel panel-large">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Introduccion general</h3>
              <p className="panel-subtitle">
                Resumen calculado a partir de las partidas filtradas.
              </p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span>Rondas jugadas</span>
              <strong>{formatNumber(totalRounds)}</strong>
            </div>
            <div className="summary-item">
              <span>Rondas por partida</span>
              <strong>{formatNumber(metrics.avgRoundsPerMatch, 1)}</strong>
            </div>
            <div className="summary-item">
              <span>Kills por ronda</span>
              <strong>{formatNumber(metrics.killsPerRound, 2)}</strong>
            </div>
            <div className="summary-item">
              <span>Headshots totales</span>
              <strong>{formatNumber(derivedSummary.headshots)}</strong>
            </div>
            <div className="summary-item">
              <span>Bodyshots totales</span>
              <strong>{formatNumber(derivedSummary.bodyshots)}</strong>
            </div>
            <div className="summary-item">
              <span>Legshots totales</span>
              <strong>{formatNumber(derivedSummary.legshots)}</strong>
            </div>
          </div>
        </div>

        <div className="stats-panel stats-panel-precision">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Precision de disparos</h3>
              <p className="panel-subtitle">
                Distribucion calculada sobre las partidas filtradas.
              </p>
            </div>
          </div>

          <div className="shot-panel-layout">
            <div className="chart-box shot-chart-box">
              {filteredShotChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart
                    margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  >
                    <Pie
                      data={filteredShotChart}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {filteredShotChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => {
                        const entry = item?.payload as
                          | { percentage?: number }
                          | undefined;

                        return [
                          `${formatNumber(Number(value))} impactos (${formatPercent(entry?.percentage, 1)})`,
                          "Impactos",
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">Sin datos de precision.</div>
              )}
            </div>

            <div className="shot-legend">
              {filteredShotChart.map((item) => (
                <div key={item.name} className="shot-legend-item">
                  <div className="shot-legend-left">
                    <span
                      className="legend-dot"
                      style={{ background: item.color }}
                    />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatNumber(item.value)} impactos</small>
                    </div>
                  </div>
                  <span className="shot-legend-value">
                    {formatPercent(item.percentage, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stats-panel stats-panel-performance">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Perfil de rendimiento</h3>
              <p className="panel-subtitle">
                Metricas explicadas con barras, mas legibles que el radar.
              </p>
            </div>
          </div>

          <div className="performance-list">
            {performanceMetrics.map((metric) => (
              <div key={metric.label} className="performance-item">
                <div className="performance-top">
                  <span>{metric.label}</span>
                  <strong>
                    {metric.label.toLowerCase().includes("rate") ||
                    metric.label.includes("%")
                      ? formatPercent(metric.value, 1)
                      : formatNumber(
                          metric.value,
                          metric.label === "ACS" ? 1 : 2,
                        )}
                  </strong>
                </div>
                <div className="performance-bar">
                  <div
                    className="performance-bar-fill"
                    style={{ width: `${metric.percent}%` }}
                  />
                </div>
                <small>{metric.helper}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-panel panel-large stats-panel-agents">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Agentes mas jugados</h3>
              <p className="panel-subtitle">
                Pulsa sobre un agente para abrir su ficha.
              </p>
            </div>
          </div>

          <div className="agent-played-list">
            {mostPlayedAgents.length > 0 ? (
              <>
                {mostPlayedAgents[0] && (
                  <button
                    type="button"
                    className="agent-featured-card"
                    onClick={() => setSelectedAgentId(mostPlayedAgents[0].id)}
                  >
                    <div className="agent-featured-content">
                      <div className="agent-featured-copy">
                        <span className="agent-featured-label">
                          Agente mas jugado
                        </span>
                        <h4>{mostPlayedAgents[0].name}</h4>
                        <strong>{mostPlayedAgents[0].matches} partidas</strong>
                      </div>

                      {mostPlayedAgents[0].image ? (
                        <img
                          src={mostPlayedAgents[0].image || undefined}
                          alt={mostPlayedAgents[0].name}
                          className="agent-featured-image"
                        />
                      ) : null}
                    </div>
                  </button>
                )}

                {mostPlayedAgents.slice(1).map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className="agent-played-item agent-played-button"
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="agent-played-row">
                      {agent.image ? (
                        <img
                          src={agent.image || undefined}
                          alt={agent.name}
                          className="agent-played-thumb"
                        />
                      ) : null}

                      <div>
                        <span className="agent-played-name">{agent.name}</span>
                        <small>{agent.matches} partidas</small>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="empty-chart">
                Sin datos de agentes mas jugados.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="stats-section-history">
        <div className="stats-section-header history-header">
          <div>
            <span className="stats-eyebrow">Historial</span>
            <h2 className="stats-title history-title">Partidas filtradas</h2>
            <p className="stats-subtitle history-subtitle">
              Filtra por acto, agente y mapa para recalcular todo el dashboard.
            </p>
          </div>
        </div>

        <div className="stats-kpis act-kpis">
          <KpiCard label="Partidas" value={formatNumber(actSummary.matches)} />
          <KpiCard
            label="Victorias"
            value={formatNumber(actSummary.wins)}
            hint={formatPercent(actSummary.winRate, 1)}
          />
          <KpiCard label="KD" value={formatNumber(actSummary.kd, 2)} />
          <KpiCard label="KDA" value={formatNumber(actSummary.kda, 2)} />
          <KpiCard label="ACS medio" value={formatNumber(actSummary.acs, 1)} />
          <KpiCard
            label="Kills / partida"
            value={formatNumber(actSummary.killsPerMatch, 2)}
          />
        </div>

        <div className="matches-list">
          {filteredMatches.length === 0 ? (
            <div className="empty-panel">
              No hay partidas disponibles para la combinacion de filtros
              seleccionada.
            </div>
          ) : (
            pagedMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                className="match-card match-card-button"
                onClick={() => setSelectedMatchId(match.id)}
              >
                <div className="match-card-top">
                  <div>
                    <div className="match-card-mapline">
                      <h3 className="match-map">{match.map}</h3>
                      <span
                        className={`match-mode-badge ${match.ranked ? "ranked" : ""}`}
                      >
                        {match.ranked ? "Ranked" : "Normal"}
                      </span>
                    </div>
                    <p className="match-date">{match.dateLabel}</p>
                  </div>

                  <div
                    className={`match-result ${match.result === "Victoria" ? "win" : "loss"}`}
                  >
                    {match.result}
                  </div>
                </div>

                <div className="match-meta">
                  <span className="match-meta-accent">{match.agent}</span>
                  <span>{match.role}</span>
                  <span>{match.mode}</span>
                  <span>{match.queue}</span>
                </div>

                <div className="match-stats-grid">
                  <div className="match-stat">
                    <span>K / D / A</span>
                    <strong>
                      {match.kills} / {match.deaths} / {match.assists}
                    </strong>
                  </div>
                  <div className="match-stat">
                    <span>KD</span>
                    <strong>{formatNumber(match.kd, 2)}</strong>
                  </div>
                  <div className="match-stat">
                    <span>ACS</span>
                    <strong>{formatNumber(match.acs, 1)}</strong>
                  </div>
                  <div className="match-stat">
                    <span>ADR</span>
                    <strong>{formatNumber(match.adr, 1)}</strong>
                  </div>
                  <div className="match-stat">
                    <span>HS%</span>
                    <strong>{formatPercent(match.hs, 1)}</strong>
                  </div>
                  <div className="match-stat">
                    <span>Rondas</span>
                    <strong>{formatNumber(match.rounds)}</strong>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {filteredMatches.length > 0 && (
          <div className="history-pagination">
            <button
              type="button"
              className="history-page-btn"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>

            <span className="history-page-info">
              Pagina {currentPage} de {totalPages} · {filteredMatches.length}{" "}
              partidas
            </span>

            <button
              type="button"
              className="history-page-btn"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      <div className="floating-filters">
        {filtersOpen && (
          <div className="floating-filters-panel">
            <div className="floating-filters-header">
              <strong>Filtros</strong>
              <button
                type="button"
                className="floating-filters-close"
                onClick={() => setFiltersOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="history-filter-group">
              <div className="history-filter">
                <label htmlFor="act-filter">Acto</label>
                <select
                  id="act-filter"
                  value={filters.actId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, actId: e.target.value }))
                  }
                  className="history-select"
                >
                  {actFilterOptions.map((actOption) => (
                    <option key={actOption.id} value={actOption.id}>
                      {actOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-filter">
                <label htmlFor="agent-filter">Agente</label>
                <select
                  id="agent-filter"
                  value={filters.agentId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, agentId: e.target.value }))
                  }
                  className="history-select"
                >
                  {agentOptions.map((agentOption) => (
                    <option key={agentOption.id} value={agentOption.id}>
                      {agentOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-filter">
                <label htmlFor="map-filter">Mapa</label>
                <select
                  id="map-filter"
                  value={filters.map}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, map: e.target.value }))
                  }
                  className="history-select"
                >
                  {mapOptions.map((mapOption) => (
                    <option key={mapOption.id} value={mapOption.id}>
                      {mapOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="floating-filters-button"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          Filtros
        </button>
      </div>

      {selectedMatchId && (
        <MatchDetailModal
          matchId={selectedMatchId}
          playerId={playerId ?? ""}
          agentNameMap={dashboard.agentNameMap}
          onClose={() => setSelectedMatchId(null)}
        />
      )}

      {selectedAgentId && (
        <AgentDetailModal
          agentId={selectedAgentId}
          player={player}
          analyticsList={dashboard.analyticsList}
          agentNameMap={dashboard.agentNameMap}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  );
}

function _normalizeRankLabelFrontend(value?: any) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return "";
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/\s+/g, " ").trim();
}
