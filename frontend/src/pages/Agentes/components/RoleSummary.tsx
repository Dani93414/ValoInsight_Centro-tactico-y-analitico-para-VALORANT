import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { RoleSummaryItem } from "../types";

type Props = {
  roles: RoleSummaryItem[];
};

export function RoleSummary({ roles }: Props) {
  return (
    <section className="agents-role-summary" aria-label="Resumen por rol">
      {roles.map((role) => (
        <article key={role.displayName} className="agents-role-summary-card">
          {role.displayIcon && <img src={role.displayIcon} alt="" />}
          <div className="role-summary-content">
            <span>{role.displayName}</span>
            <strong>{role.agents} agentes</strong>
            <small>
              {role.picks > 0
                ? `${formatNumber(role.picks)} picks · ${formatPercent(role.winRate)} WR`
                : "Sin muestra global"}
            </small>
            <div className="role-usage-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(role.usagePct, 100)}%` }} />
            </div>
            <div className="role-summary-badges">
              {role.picks > 0 && <em>{formatPercent(role.usagePct)} uso</em>}
              {role.isMostUsed && <em>Más usado</em>}
              {role.isBestWinRate && <em>Mejor WR</em>}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

