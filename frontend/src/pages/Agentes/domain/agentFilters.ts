import { normalizeLabel } from "../../../utils/formatters";
import type { AgentSelectOption, EnrichedAgent } from "../types";

export type PersonalAgentMatch = {
  agentKey: string;
  map?: string;
  rank?: string;
  actId?: string;
  actLabel?: string;
};

export function makeOptions(
  values: Array<string | undefined>,
  emptyLabel: string,
): AgentSelectOption[] {
  const uniqueValues = Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ).sort((a, b) => a.localeCompare(b));

  if (uniqueValues.length === 0) {
    return [{ value: "all", label: emptyLabel, disabled: true }];
  }

  return [
    { value: "all", label: "Todos" },
    ...uniqueValues.map((value) => ({ value, label: value })),
  ];
}

export function agentHasPersonalMatch(
  agent: EnrichedAgent,
  matches: PersonalAgentMatch[],
  filters: { map: string; rank: string; act: string },
) {
  const activePersonalFilter =
    filters.map !== "all" || filters.rank !== "all" || filters.act !== "all";
  if (!activePersonalFilter) return true;

  const agentKey = agent.uuid ?? agent.id ?? agent.displayName;
  return matches.some((match) => {
    if (match.agentKey !== agentKey) return false;
    if (filters.map !== "all" && normalizeLabel(match.map) !== normalizeLabel(filters.map)) {
      return false;
    }
    if (filters.rank !== "all" && match.rank !== filters.rank) return false;
    if (filters.act !== "all" && match.actId !== filters.act) return false;
    return true;
  });
}
