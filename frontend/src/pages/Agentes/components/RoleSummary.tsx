import type { CSSProperties } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { RoleSummaryItem } from "../types";

type Props = {
  roles: RoleSummaryItem[];
};

export function RoleSummary({ roles }: Props) {
  return (
    <section
      className="agents-role-summary agents-role-summary--header"
      aria-label="Resumen por rol"
    >
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
            <div className="role-summary-heading">
              <strong>{role.displayName}</strong>
              <span>· {role.agents} agentes</span>
            </div>

            <div className="role-stat-line">
              <div className="role-stat-label-row">
                <span>Uso</span>
                <strong>
                  {formatNumber(role.picks)} picks · {formatPercent(role.usagePct)}
                </strong>
              </div>
              <div
                className="role-usage-bar"
                aria-label={`${formatNumber(role.picks)} picks, ${formatPercent(role.usagePct)} uso`}
              >
                <i style={{ width: `${Math.min(role.usagePct, 100)}%` }} />
              </div>
            </div>

            <div className="role-stat-line">
              <div className="role-stat-label-row">
                <span>WR</span>
                <strong>{formatPercent(role.winRate)}</strong>
              </div>
              <div
                className="role-usage-bar role-winrate-bar"
                aria-label={`${formatPercent(role.winRate)} WR`}
              >
                <i style={{ width: `${Math.min(role.winRate, 100)}%` }} />
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
