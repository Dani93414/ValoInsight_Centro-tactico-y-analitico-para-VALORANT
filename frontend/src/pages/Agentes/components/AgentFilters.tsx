import type { Role } from "../../../types/agents";
import type { AgentFilterSummary, AgentSelectOption, AgentSortKey } from "../types";

type Props = {
  activeRole: string | null;
  actFilter: string;
  actOptions: AgentSelectOption[];
  mapFilter: string;
  mapOptions: AgentSelectOption[];
  rankFilter: string;
  rankOptions: AgentSelectOption[];
  regionOptions: AgentSelectOption[];
  roles: Role[];
  search: string;
  selectedRegion: string;
  sortKey: AgentSortKey;
  summary: AgentFilterSummary;
  onActFilterChange: (value: string) => void;
  onMapFilterChange: (value: string) => void;
  onRankFilterChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onRoleChange: (role: string | null) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: AgentSortKey) => void;
  onResetFilters: () => void;
};

const sortOptions: Array<{ value: AgentSortKey; label: string }> = [
  { value: "name", label: "Nombre" },
  { value: "picks", label: "Picks globales" },
  { value: "winRate", label: "Win rate global" },
  { value: "role", label: "Rol" },
];

export function AgentFilters({
  activeRole,
  actFilter,
  actOptions,
  mapFilter,
  mapOptions,
  rankFilter,
  rankOptions,
  regionOptions,
  roles,
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
    <section className="agents-filters">
      <div className="agents-filters-header">
        <div>
          <span className="agents-section-eyebrow">Filtros</span>
          <strong>
            Mostrando {summary.shown} de {summary.total} agentes
          </strong>
        </div>

        <button
          type="button"
          className="agents-clear-filters"
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
        >
          Limpiar filtros
        </button>
      </div>

      <div className="roles-filter" aria-label="Filtrar agentes por rol">
        <button
          type="button"
          className={`role-filter-btn reset ${activeRole ? "" : "active"}`}
          onClick={() => onRoleChange(null)}
          aria-pressed={!activeRole}
        >
          Todos
        </button>

        {roles.map((role) => {
          const active = activeRole === role.displayName;
          return (
            <button
              key={role.displayName}
              type="button"
              className={`role-filter-btn ${active ? "active" : ""}`}
              onClick={() => onRoleChange(active ? null : role.displayName)}
              aria-pressed={active}
            >
              {role.displayIcon && <img src={role.displayIcon} alt="" />}
              <span>{role.displayName}</span>
            </button>
          );
        })}
      </div>

      <div className="agent-filter-tools">
        <input
          type="text"
          className="agents-search"
          placeholder="Buscar agente..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Buscar agente por nombre"
        />

        <select
          className="agents-select"
          value={selectedRegion}
          onChange={(event) => onRegionChange(event.target.value)}
          aria-label="Seleccionar región"
        >
          {regionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Región: {option.label}
            </option>
          ))}
        </select>

        <select
          className="agents-select"
          value={mapFilter}
          onChange={(event) => onMapFilterChange(event.target.value)}
          aria-label="Filtrar por mapa"
        >
          {mapOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Mapa: {option.label}
            </option>
          ))}
        </select>

        <select
          className="agents-select"
          value={rankFilter}
          onChange={(event) => onRankFilterChange(event.target.value)}
          aria-label="Filtrar por rango"
        >
          {rankOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Rango: {option.label}
            </option>
          ))}
        </select>

        <select
          className="agents-select"
          value={actFilter}
          onChange={(event) => onActFilterChange(event.target.value)}
          aria-label="Filtrar por acto"
        >
          {actOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Acto: {option.label}
            </option>
          ))}
        </select>

        <select
          className="agents-select"
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as AgentSortKey)}
          aria-label="Ordenar agentes"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Orden: {option.label}
            </option>
          ))}
        </select>
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
