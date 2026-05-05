import type { CSSProperties } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { RoleSummaryItem, TopAgentSummary } from "../types";

type Props = {
  roles: RoleSummaryItem[];
  topAgents: TopAgentSummary[];
};

export function AgentsHeader({ roles, topAgents }: Props) {
  return (
    <header className="agents-header">
      <div className="agents-header-copy">
        <span className="agents-eyebrow">Valorant</span>
        <h1 className="agents-title">Agentes</h1>
        <p className="agents-subtitle">
          Explora la plantilla, compara roles y detecta picks con impacto global
          dentro de ValoInsight.
        </p>
        <div className="agents-divider" />
        <div className="agents-top-winrate" aria-label="Top 3 agentes por win rate">
          {topAgents.map((agent) => (
            <div key={agent.key} className="agents-top-winrate-item">
              <div className="agents-top-winrate-orb" title={`${agent.name} · ${formatPercent(agent.winRate)} WR`}>
                {agent.displayIcon ? (
                  <img src={agent.displayIcon} alt="" />
                ) : (
                  <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <strong>{agent.name}</strong>
              <small>{formatPercent(agent.winRate)} WR</small>
            </div>
          ))}
        </div>
      </div>

      <section className="agents-role-summary agents-role-summary--header" aria-label="Resumen por rol">
        {roles.map((role) => (
          <article
            key={role.displayName}
            className="agents-role-summary-card"
            style={
              role.displayIcon
                ? ({
                    ["--role-watermark" as string]: `url("${role.displayIcon}") center / contain no-repeat`,
                  } as CSSProperties)
                : undefined
            }
          >
            {role.displayIcon && <img src={role.displayIcon} alt="" />}
            <div className="role-summary-content">
              <span>{role.displayName}</span>
              <strong>{role.agents} agentes</strong>
              <small>
                {formatNumber(role.picks)} picks · {formatPercent(role.usagePct)} uso
              </small>
              <div className="role-bar-row">
                <span>Uso</span>
                <div className="role-usage-bar" aria-label={`${formatNumber(role.picks)} picks, ${formatPercent(role.usagePct)} uso`}>
                  <i style={{ width: `${Math.min(role.usagePct, 100)}%` }} />
                </div>
              </div>
              <div className="role-bar-row">
                <span>WR</span>
                <div className="role-usage-bar role-winrate-bar" aria-label={`${formatPercent(role.winRate)} WR`}>
                  <i style={{ width: `${Math.min(role.winRate, 100)}%` }} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </header>
  );
}
