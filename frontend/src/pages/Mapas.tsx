import { useMemo, useState } from "react";
import { useMapas, useRegions } from "../api/hooks";
import type { MapContent } from "../types/content";
import type { RegionMapStats } from "../types/globalStats";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
} from "./contentPageUtils";
import {
  formatCompactNumber,
  formatNumber,
  formatPercent,
  hideBrokenImage,
  normalizeText,
} from "./contentFormatters";
import "./ContentPages.css";

const MAP_GROUPS = [
  { key: "core", label: "Competitivos" },
  { key: "skirmish", label: "Escaramuza" },
  { key: "tdm", label: "Team deathmatch" },
  { key: "training", label: "Entrenamiento" },
] as const;

type MapEntry = MapContent & {
  groupKey: string;
  groupLabel: string;
};

function getStrongSide(stats?: RegionMapStats) {
  const attack = stats?.sides?.attack?.win_rate;
  const defense = stats?.sides?.defense?.win_rate;
  if (attack === undefined && defense === undefined) return "-";
  if ((attack ?? 0) >= (defense ?? 0)) return `Ataque ${formatPercent(attack)}`;
  return `Defensa ${formatPercent(defense)}`;
}

export default function Mapas() {
  const query = useMapas();
  const { data: regions } = useRegions();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [selected, setSelected] = useState<MapEntry | null>(null);

  const maps = useMemo<MapEntry[]>(() => {
    const data = query.data ?? {};
    return MAP_GROUPS.flatMap(({ key, label }) =>
      [...(data[key] ?? [])].map((item) => ({
        ...item,
        groupKey: key,
        groupLabel: label,
      })),
    ).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [query.data]);

  const filtered = maps.filter((map) => {
    const matchesGroup = group === "all" || map.groupKey === group;
    const matchesSearch = normalizeText(map.displayName).includes(
      normalizeText(search),
    );
    return matchesGroup && matchesSearch;
  });

  const regionMapStats = useMemo(() => regions?.[0]?.mapStats ?? {}, [regions]);
  const mapStatsByName = useMemo(() => {
    const statsMap = new Map<string, (typeof regionMapStats)[string]>();
    Object.values(regionMapStats).forEach((stats) => {
      if (stats.map_name) {
        statsMap.set(normalizeText(stats.map_name), stats);
      }
    });
    return statsMap;
  }, [regionMapStats]);

  const getMapGlobalStats = (map: MapEntry) =>
    regionMapStats[map.uuid ?? ""] ??
    mapStatsByName.get(normalizeText(map.displayName));
  const selectedStats = selected ? getMapGlobalStats(selected) : undefined;

  if (query.isLoading) {
    return <ContentLoading title="Cargando mapas" />;
  }

  return (
    <ContentShell
      title="Mapas"
      subtitle="Mapas clasificados por modo, con coordenadas, callouts y rendimiento global cuando existen."
    >
      {query.isError && (
        <ContentError
          message="No se pudieron cargar los mapas."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && maps.length === 0 && (
        <ContentEmpty message="No hay mapas disponibles." />
      )}

      {!query.isError && maps.length > 0 && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder="Buscar mapa..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="content-filter-row" aria-label="Filtrar mapas">
              <button
                className={`content-filter-btn ${
                  group === "all" ? "active" : ""
                }`}
                type="button"
                onClick={() => setGroup("all")}
              >
                Todos
              </button>
              {MAP_GROUPS.map((item) => (
                <button
                  key={item.key}
                  className={`content-filter-btn ${
                    group === item.key ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => setGroup(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <article className="content-detail">
              <button
                className="content-detail-close"
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                x
              </button>
              <div className="content-detail-grid">
                <div>
                  <h2 className="content-detail-title">
                    {selected.displayName}
                  </h2>
                  <div className="content-badge-row">
                    <span className="content-badge">{selected.groupLabel}</span>
                    {selected.coordinates && (
                      <span className="content-badge">
                        {selected.coordinates}
                      </span>
                    )}
                    {selectedStats?.matches ? (
                      <span className="content-badge">
                        {formatCompactNumber(selectedStats.matches)} partidas globales
                      </span>
                    ) : null}
                  </div>
                  {selectedStats && (
                    <div className="content-kv-grid content-kv-grid--compact">
                      <div className="content-kv">
                        <span>Rondas</span>
                        <strong>
                          {formatCompactNumber(selectedStats.total_rounds)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>Lado fuerte</span>
                        <strong>{getStrongSide(selectedStats)}</strong>
                      </div>
                      <div className="content-kv">
                        <span>KD global</span>
                        <strong>
                          {formatNumber(selectedStats.averages?.kd_ratio, 2)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>ACS global</span>
                        <strong>
                          {formatNumber(selectedStats.averages?.acs, 1)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>ADR global</span>
                        <strong>
                          {formatNumber(selectedStats.averages?.adr, 1)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>Ataque WR</span>
                        <strong>
                          {formatPercent(selectedStats.sides?.attack?.win_rate)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>Defensa WR</span>
                        <strong>
                          {formatPercent(selectedStats.sides?.defense?.win_rate)}
                        </strong>
                      </div>
                      <div className="content-kv">
                        <span>HS global</span>
                        <strong>
                          {formatPercent(selectedStats.averages?.headshot_pct)}
                        </strong>
                      </div>
                    </div>
                  )}
                  <p className="content-detail-text">
                    {selected.tacticalDescription ||
                      selected.narrativeDescription ||
                      "Sin descripcion tactica."}
                  </p>
                  {(selected.callouts?.length ?? 0) > 0 && (
                    <div className="content-callout-block">
                      <h3 className="content-panel-title">Callouts</h3>
                      <div className="content-callout-list">
                        {selected.callouts?.slice(0, 18).map((callout) => (
                          <span
                            key={`${callout.superRegionName}-${callout.regionName}`}
                          >
                            {callout.superRegionName
                              ? `${callout.superRegionName}: `
                              : ""}
                            {callout.regionName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="content-detail-media">
                  {(selected.splash || selected.displayIcon) && (
                    <img
                      className="content-detail-image"
                      src={selected.splash || selected.displayIcon || ""}
                      alt={selected.displayName}
                      onError={hideBrokenImage}
                    />
                  )}
                </div>
              </div>
            </article>
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay mapas con ese filtro." />
          ) : (
            <ContentSection title="Listado">
              <div className="content-grid">
                {filtered.map((map) => {
                  const active = selected?.displayName === map.displayName;
                  const stats = getMapGlobalStats(map);
                  return (
                    <button
                      key={`${map.groupKey}-${map.uuid ?? map.displayName}`}
                      className={`content-card ${active ? "active" : ""}`}
                      type="button"
                      onClick={() => setSelected(active ? null : map)}
                    >
                      {(map.displayIcon || map.splash) && (
                        <span className="content-card-image-wrap">
                          <img
                            className="content-card-image"
                            src={map.displayIcon || map.splash || ""}
                            alt={map.displayName}
                            loading="lazy"
                            onError={hideBrokenImage}
                          />
                        </span>
                      )}
                      <h2 className="content-card-title">{map.displayName}</h2>
                      <p className="content-card-meta">{map.groupLabel}</p>
                      {stats?.matches ? (
                        <p className="content-card-meta">
                          {formatCompactNumber(stats.matches)} partidas
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </ContentSection>
          )}
        </>
      )}
    </ContentShell>
  );
}
