import { formatPercent } from "../../../utils/formatters";
import type { Role } from "../../../types/agents";
import type { RoleSummaryItem, TopAgentSummary } from "../types";
import { AgentsInsights } from "./AgentsInsights";

type Props = {
  activeRole: string | null;
  roles: Role[];
  roleSummary: RoleSummaryItem[];
  topAgents: TopAgentSummary[];
  onRoleChange: (role: string | null) => void;
};

export function AgentsHeader({
  activeRole,
  roles,
  roleSummary,
  topAgents,
  onRoleChange,
}: Props) {
  const summaryByRole = new Map(
    roleSummary.map((role) => [role.displayName, role]),
  );

  return (
    <header className="agents-header">
      <div className="agents-header-copy">
        <span className="agents-eyebrow">Valorant</span>
        <h1 className="agents-title">Agentes</h1>
        <p className="agents-subtitle">
          Explora el rendimiento global y personal de cada agente por mapa, rango,
          región y acto.
        </p>
      </div>

      <div className="agents-role-tabs" role="group" aria-label="Filtrar agentes por rol">
        <button
          type="button"
          className={`agents-role-tab ${activeRole ? "" : "active"}`}
          onClick={() => onRoleChange(null)}
          aria-pressed={!activeRole}
        >
          <span>Todos</span>
          <strong>{roleSummary.reduce((total, role) => total + role.agents, 0)}</strong>
        </button>

        {roles.map((role) => {
          const active = activeRole === role.displayName;
          const summary = summaryByRole.get(role.displayName);
          return (
            <button
              key={role.displayName}
              type="button"
              className={`agents-role-tab ${active ? "active" : ""}`}
              onClick={() => onRoleChange(active ? null : role.displayName)}
              aria-pressed={active}
            >
              <span>{role.displayName}</span>
              <strong>{summary?.agents ?? 0}</strong>
              {summary && <em>{formatPercent(summary.winRate)} WR</em>}
            </button>
          );
        })}
      </div>

      <AgentsInsights topAgents={topAgents} />
    </header>
  );
}
