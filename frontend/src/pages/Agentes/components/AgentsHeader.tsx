import type { RoleSummaryItem, TopAgentSummary } from "../types";
import { AgentsInsights } from "./AgentsInsights";
import { RoleSummary } from "./RoleSummary";

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
        <div className="agents-divider" />

        <AgentsInsights topAgents={topAgents} />
      </div>
      <RoleSummary roles={roles} />
    </header>
  );
}
