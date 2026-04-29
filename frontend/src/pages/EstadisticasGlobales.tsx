import { useMemo, useState } from "react";
import { useArmas, useRegions } from "../api/hooks";
import type {
  RegionAgentStats,
  RegionEconomyStats,
  RegionMapStats,
  RegionStats,
  RegionWeaponStats,
} from "../types/globalStats";
import type { Arma } from "../types/weapons";
import { formatNumber, formatPercent } from "../utils/formatters";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
} from "./contentPageUtils";
import { normalizeText } from "./contentFormatters";
import "./ContentPages.css";
import "./GlobalStats.css";

type TabKey = "resumen" | "agentes" | "mapas" | "armas" | "economia";

type RankedAgent = RegionAgentStats & { id: string };
type RankedMap = RegionMapStats & { id: string };
type RankedWeapon = RegionWeaponStats & { id: string; category?: string };
type RankedEconomy = RegionEconomyStats & { id: string; label: string };

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "resumen", label: "Resumen" },
  { key: "agentes", label: "Agentes" },
  { key: "mapas", label: "Mapas" },
  { key: "armas", label: "Armas" },
  { key: "economia", label: "Economía" },
];

const ECONOMY_LABELS: Record<string, string> = {
  eco: "Eco",
  low_buy: "Low buy",
  full_buy: "Full buy",
};

function metric(value: number | undefined, decimals = 1) {
  return formatNumber(value, decimals);
}

function metricPct(value: number | undefined, decimals = 1) {
  return formatPercent(value, decimals);
}

function normalizeWeaponCategory(category?: string | null) {
  const raw = String(category ?? "").trim();
  if (!raw || raw === "—" || raw === "-") return "Sin categoría";
  if (raw.includes("::")) return raw.split("::").pop() || raw;
  return raw;
}

function getBestSide(map: RankedMap) {
  const attack = map.sides?.attack?.win_rate ?? 0;
  const defense = map.sides?.defense?.win_rate ?? 0;
  if (!attack && !defense) return "-";
  return attack >= defense
    ? `Ataque ${metricPct(attack)}`
    : `Defensa ${metricPct(defense)}`;
}

function getRegionLabel(region: RegionStats | undefined) {
  if (!region) return "Sin región";
  return region.region || "Global";
}

export default function EstadisticasGlobales() {
  const regionsQuery = useRegions();
  const weaponsQuery = useArmas();
  const [selectedRegion, setSelectedRegion] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("resumen");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [mapFilter, setMapFilter] = useState("all");
  const [weaponCategoryFilter, setWeaponCategoryFilter] = useState("all");
  const [minSample, setMinSample] = useState(0);

  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const effectiveSelectedRegion = selectedRegion || regions[0]?.region || "";

  const region =
    regions.find((entry) => entry.region === effectiveSelectedRegion) ??
    regions[0];

  const weaponsByName = useMemo(() => {
    const map = new Map<string, Arma>();
    ((weaponsQuery.data as Arma[] | undefined) ?? []).forEach((weapon) => {
      map.set(normalizeText(weapon.displayName), weapon);
    });
    return map;
  }, [weaponsQuery.data]);

  const agents = useMemo<RankedAgent[]>(
    () =>
      Object.entries(region?.agentStats ?? {})
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => (b.picks ?? 0) - (a.picks ?? 0)),
    [region?.agentStats],
  );

  const maps = useMemo<RankedMap[]>(
    () =>
      Object.entries(region?.mapStats ?? {})
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0)),
    [region?.mapStats],
  );

  const weapons = useMemo<RankedWeapon[]>(
    () =>
      Object.entries(region?.weaponStats ?? {})
        .map(([id, stats]) => {
          const catalog = weaponsByName.get(normalizeText(stats.weapon_name));
          return {
            id,
            ...stats,
            category: normalizeWeaponCategory(catalog?.category),
          };
        })
        .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0)),
    [region?.weaponStats, weaponsByName],
  );

  const economyRows = useMemo<RankedEconomy[]>(
    () =>
      Object.entries(region?.economy ?? {}).map(([id, stats]) => ({
        id,
        label: ECONOMY_LABELS[id] ?? id,
        ...stats,
      })),
    [region?.economy],
  );

  const roles = useMemo(
    () =>
      Array.from(
        new Set(
          agents
            .map((agent) => agent.role)
            .filter((role): role is string => Boolean(role)),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "es")),
    [agents],
  );

  const mapOptions = useMemo(
    () =>
      maps
        .map((map) => map.map_name)
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, "es")),
    [maps],
  );

  const weaponCategories = useMemo(
    () =>
      Array.from(
        new Set(
          weapons
            .map((weapon) => weapon.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "es")),
    [weapons],
  );

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = normalizeText(
      `${agent.agent_name ?? ""} ${agent.role ?? ""}`,
    ).includes(normalizeText(search));
    const matchesRole = roleFilter === "all" || agent.role === roleFilter;
    const matchesSample = (agent.picks ?? 0) >= minSample;
    return matchesSearch && matchesRole && matchesSample;
  });

  const filteredMaps = maps.filter((map) => {
    const matchesSearch = normalizeText(map.map_name ?? "").includes(
      normalizeText(search),
    );
    const matchesMap = mapFilter === "all" || map.map_name === mapFilter;
    const matchesSample = (map.matches ?? 0) >= minSample;
    return matchesSearch && matchesMap && matchesSample;
  });

  const filteredWeapons = weapons.filter((weapon) => {
    const matchesSearch = normalizeText(
      `${weapon.weapon_name ?? ""} ${weapon.category ?? ""}`,
    ).includes(normalizeText(search));
    const matchesCategory =
      weaponCategoryFilter === "all" ||
      weapon.category === weaponCategoryFilter;
    const matchesSample = (weapon.rounds_equipped ?? 0) >= minSample;
    return matchesSearch && matchesCategory && matchesSample;
  });

  if (regionsQuery.isLoading) {
    return <ContentLoading title="Cargando estadísticas globales" />;
  }

  return (
    <ContentShell
      title="Estadísticas globales"
      subtitle="Resumen competitivo agregado por región usando partidas, jugadores y analíticas embebidas."
    >
      {regionsQuery.isError && (
        <ContentError
          message="No se pudieron cargar las estadísticas globales."
          onRetry={() => regionsQuery.refetch()}
        />
      )}

      {!regionsQuery.isError && regions.length === 0 && (
        <ContentEmpty message="No hay estadísticas globales disponibles." />
      )}

      {!regionsQuery.isError && region && (
        <>
          <div className="global-toolbar">
            <label className="global-filter">
              <span>Región</span>
              <select
                value={region.region}
                onChange={(event) => setSelectedRegion(event.target.value)}
              >
                {regions.map((item) => (
                  <option key={item.region} value={item.region}>
                    {getRegionLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="global-filter global-filter--wide">
              <span>Búsqueda</span>
              <input
                type="search"
                placeholder="Buscar agente, mapa o arma..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="global-filter">
              <span>Mínimo</span>
              <input
                type="number"
                min={0}
                value={minSample}
                onChange={(event) =>
                  setMinSample(Math.max(0, Number(event.target.value) || 0))
                }
              />
            </label>
          </div>

          <div className="global-toolbar global-toolbar--secondary">
            <label className="global-filter">
              <span>Rol</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="global-filter">
              <span>Mapa</span>
              <select
                value={mapFilter}
                onChange={(event) => setMapFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                {mapOptions.map((mapName) => (
                  <option key={mapName} value={mapName}>
                    {mapName}
                  </option>
                ))}
              </select>
            </label>

            <label className="global-filter">
              <span>Categoría</span>
              <select
                value={weaponCategoryFilter}
                onChange={(event) =>
                  setWeaponCategoryFilter(event.target.value)
                }
              >
                <option value="all">Todas</option>
                {weaponCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="global-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`global-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "resumen" && (
            <>
              <div className="global-kpi-grid">
                <article className="global-kpi-card">
                  <span>Partidas</span>
                  <strong>{formatNumber(region.totalMatches)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>Jugadores</span>
                  <strong>{formatNumber(region.uniquePlayers)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>Rondas</span>
                  <strong>{formatNumber(region.totalRounds)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>KD</span>
                  <strong>{metric(region.averages?.kd_ratio, 2)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>ACS</span>
                  <strong>{metric(region.averages?.acs, 1)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>ADR</span>
                  <strong>{metric(region.averages?.adr, 1)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>HS%</span>
                  <strong>{metricPct(region.averages?.headshot_pct)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>KAST</span>
                  <strong>{metricPct(region.averages?.kast_pct)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>Supervivencia</span>
                  <strong>{metricPct(region.averages?.survival_rate)}</strong>
                </article>
                <article className="global-kpi-card">
                  <span>Clutch</span>
                  <strong>{metricPct(region.averages?.clutch_win_rate)}</strong>
                </article>
              </div>

              <ContentSection title="Lados">
                <div className="global-side-grid">
                  {(["attack", "defense"] as const).map((side) => {
                    const stats = region.sides?.[side];
                    return (
                      <article key={side} className="global-panel">
                        <h3>{side === "attack" ? "Ataque" : "Defensa"}</h3>
                        <div className="global-mini-grid">
                          <span>WR</span>
                          <strong>{metricPct(stats?.win_rate)}</strong>
                          <span>Rondas</span>
                          <strong>{formatNumber(stats?.rounds)}</strong>
                          <span>ADR</span>
                          <strong>{metric(stats?.adr)}</strong>
                          <span>KPR</span>
                          <strong>{metric(stats?.kills_per_round, 2)}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </ContentSection>
            </>
          )}

          {activeTab === "agentes" && (
            <ContentSection title="Ranking de agentes">
              {filteredAgents.length === 0 ? (
                <ContentEmpty message="No hay agentes con esos filtros." />
              ) : (
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Rol</th>
                      <th>Picks</th>
                      <th>Pick %</th>
                      <th>WR</th>
                      <th>KD</th>
                      <th>ACS</th>
                      <th>ADR</th>
                      <th>HS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.id}>
                        <td>{agent.agent_name ?? "Unknown"}</td>
                        <td>{agent.role ?? "-"}</td>
                        <td>{formatNumber(agent.picks)}</td>
                        <td>{metricPct(agent.pick_rate)}</td>
                        <td>{metricPct(agent.win_rate)}</td>
                        <td>{metric(agent.avg_kd, 2)}</td>
                        <td>{metric(agent.avg_acs)}</td>
                        <td>{metric(agent.avg_adr)}</td>
                        <td>{metricPct(agent.avg_headshot_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ContentSection>
          )}

          {activeTab === "mapas" && (
            <ContentSection title="Ranking de mapas">
              {filteredMaps.length === 0 ? (
                <ContentEmpty message="No hay mapas con esos filtros." />
              ) : (
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Mapa</th>
                      <th>Partidas</th>
                      <th>Rondas</th>
                      <th>Lado fuerte</th>
                      <th>KD</th>
                      <th>ACS</th>
                      <th>ADR</th>
                      <th>HS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaps.map((map) => (
                      <tr key={map.id}>
                        <td>{map.map_name ?? "Unknown"}</td>
                        <td>{formatNumber(map.matches)}</td>
                        <td>{formatNumber(map.total_rounds)}</td>
                        <td>{getBestSide(map)}</td>
                        <td>{metric(map.averages?.kd_ratio, 2)}</td>
                        <td>{metric(map.averages?.acs)}</td>
                        <td>{metric(map.averages?.adr)}</td>
                        <td>{metricPct(map.averages?.headshot_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ContentSection>
          )}

          {activeTab === "armas" && (
            <ContentSection title="Ranking de armas">
              {filteredWeapons.length === 0 ? (
                <ContentEmpty message="No hay armas con esos filtros." />
              ) : (
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Arma</th>
                      <th>Categoría</th>
                      <th>Kills</th>
                      <th>Rondas equipada</th>
                      <th>Deaths</th>
                      <th>HS</th>
                      <th>Daño</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWeapons.map((weapon) => (
                      <tr key={weapon.id}>
                        <td>{weapon.weapon_name ?? "Unknown"}</td>
                        <td>{weapon.category ?? "-"}</td>
                        <td>{formatNumber(weapon.kills)}</td>
                        <td>{formatNumber(weapon.rounds_equipped)}</td>
                        <td>{formatNumber(weapon.deaths)}</td>
                        <td>{metricPct(weapon.headshot_pct)}</td>
                        <td>{formatNumber(weapon.damage_dealt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ContentSection>
          )}

          {activeTab === "economia" && (
            <ContentSection title="Economía">
              {economyRows.length === 0 ? (
                <ContentEmpty message="No hay datos de economía." />
              ) : (
                <div className="global-side-grid">
                  {economyRows.map((row) => (
                    <article key={row.id} className="global-panel">
                      <h3>{row.label}</h3>
                      <div className="global-mini-grid">
                        <span>Rondas</span>
                        <strong>{formatNumber(row.rounds)}</strong>
                        <span>Victorias</span>
                        <strong>{formatNumber(row.wins)}</strong>
                        <span>WR</span>
                        <strong>{metricPct(row.win_rate)}</strong>
                        <span>KD</span>
                        <strong>{metric(row.kd_ratio, 2)}</strong>
                        <span>ADR</span>
                        <strong>{metric(row.adr)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </ContentSection>
          )}
        </>
      )}
    </ContentShell>
  );
}
