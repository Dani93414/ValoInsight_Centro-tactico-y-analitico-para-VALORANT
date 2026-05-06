import type { AgentFilterSummary, AgentSelectOption, AgentSortKey } from "../types";

type Props = {
  actFilter: string;
  actOptions: AgentSelectOption[];
  activeRole: string;
  mapFilter: string;
  mapOptions: AgentSelectOption[];
  rankFilter: string;
  rankOptions: AgentSelectOption[];
  regionOptions: AgentSelectOption[];
  roleOptions: AgentSelectOption[];
  search: string;
  selectedRegion: string;
  sortKey: AgentSortKey;
  summary: AgentFilterSummary;
  onActFilterChange: (value: string) => void;
  onMapFilterChange: (value: string) => void;
  onRankFilterChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: AgentSortKey) => void;
  onResetFilters: () => void;
};

const sortOptions: Array<{ value: AgentSortKey; label: string }> = [
  { value: "score", label: "Score" },
  { value: "name", label: "Nombre" },
  { value: "picks", label: "Pick rate" },
  { value: "winRate", label: "Win rate" },
  { value: "role", label: "Rol" },
];

function isDisabledOnly(options: AgentSelectOption[]) {
  return options.length === 0 || options.every((option) => option.disabled);
}

export function AgentFilters({
  actFilter,
  actOptions,
  activeRole,
  mapFilter,
  mapOptions,
  rankFilter,
  rankOptions,
  regionOptions,
  roleOptions,
  search,
  selectedRegion,
  sortKey,
  summary,
  onActFilterChange,
  onMapFilterChange,
  onRankFilterChange,
  onRegionChange,
  onRoleChange,
  onSearchChange,
  onSortChange,
  onResetFilters,
}: Props) {
  const hasActiveFilters = summary.activeLabels.length > 0;

  return (
    <section className="agents-filters" aria-label="Filtros de agentes">
      <div className="agents-filters-header">
        <div>
          <span className="agents-section-eyebrow">Filtros</span>
          <strong>
            Mostrando {summary.shown} de {summary.total} agentes
          </strong>
        </div>
      </div>

      <div className="agent-filter-tools">
        <div className="agent-filter-row agent-filter-row--primary">
          <label className="agents-filter-field agents-filter-field--search">
            <span>Agente</span>
            <input
              type="text"
              className="agents-search"
              placeholder="Buscar agente..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Buscar agente por nombre"
            />
          </label>

          <label className="agents-filter-field">
            <span>Region</span>
            <select
              className="agents-select"
              value={selectedRegion}
              disabled={regionOptions.length === 0}
              onChange={(event) => onRegionChange(event.target.value)}
              aria-label="Seleccionar region"
            >
              {regionOptions.length === 0 ? (
                <option value="">Sin regiones</option>
              ) : (
                regionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="agents-filter-field">
            <span>Rol</span>
            <select
              className="agents-select"
              value={activeRole}
              onChange={(event) => onRoleChange(event.target.value)}
              aria-label="Filtrar por rol"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="agents-filter-field agents-filter-field--sort">
            <span>Ordenar por</span>
            <select
              className="agents-select agents-sort-select"
              value={sortKey}
              onChange={(event) => onSortChange(event.target.value as AgentSortKey)}
              aria-label="Ordenar agentes"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="agent-filter-row agent-filter-row--secondary">
          <label className="agents-filter-field">
            <span>Mapa</span>
            <select
              className="agents-select"
              value={mapFilter}
              disabled={isDisabledOnly(mapOptions)}
              onChange={(event) => onMapFilterChange(event.target.value)}
              aria-label="Filtrar por mapa"
            >
              {mapOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="agents-filter-field">
            <span>Rango</span>
            <select
              className="agents-select"
              value={rankFilter}
              disabled={isDisabledOnly(rankOptions)}
              onChange={(event) => onRankFilterChange(event.target.value)}
              aria-label="Filtrar por rango"
            >
              {rankOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="agents-filter-field">
            <span>Acto</span>
            <select
              className="agents-select"
              value={actFilter}
              disabled={isDisabledOnly(actOptions)}
              onChange={(event) => onActFilterChange(event.target.value)}
              aria-label="Filtrar por acto"
            >
              {actOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="agents-filter-field agents-filter-field--clear">
            <span aria-hidden="true">Accion</span>
            <button
              type="button"
              className="agents-clear-filters"
              onClick={onResetFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="agents-active-filters" aria-label="Filtros activos">
          {summary.activeLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </section>
  );
}
