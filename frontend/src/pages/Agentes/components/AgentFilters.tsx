import type { Role } from "../../../types/agents";
import type { AgentSortKey, AgentStatsFilter } from "../types";

type Props = {
  activeRole: string | null;
  roles: Role[];
  search: string;
  sortKey: AgentSortKey;
  statsFilter: AgentStatsFilter;
  onRoleChange: (role: string | null) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: AgentSortKey) => void;
  onStatsFilterChange: (value: AgentStatsFilter) => void;
};

const statsFilters: Array<{ value: AgentStatsFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "withStats", label: "Con estadísticas" },
  { value: "withoutStats", label: "Sin estadísticas" },
  { value: "base", label: "Base" },
  { value: "added", label: "Añadido" },
];

const sortOptions: Array<{ value: AgentSortKey; label: string }> = [
  { value: "name", label: "Nombre" },
  { value: "picks", label: "Picks globales" },
  { value: "winRate", label: "Win rate global" },
  { value: "role", label: "Rol" },
  { value: "releaseDate", label: "Fecha de salida" },
];

export function AgentFilters({
  activeRole,
  roles,
  search,
  sortKey,
  statsFilter,
  onRoleChange,
  onSearchChange,
  onSortChange,
  onStatsFilterChange,
}: Props) {
  return (
    <div className="agents-filters">
      <div className="roles-filter" aria-label="Filtrar agentes por rol">
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

        <button
          type="button"
          className={`role-filter-btn reset ${activeRole ? "" : "active"}`}
          onClick={() => onRoleChange(null)}
          aria-pressed={!activeRole}
        >
          Todos
        </button>
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
          value={statsFilter}
          onChange={(event) =>
            onStatsFilterChange(event.target.value as AgentStatsFilter)
          }
          aria-label="Filtrar por disponibilidad de estadísticas"
        >
          {statsFilters.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
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
    </div>
  );
}

