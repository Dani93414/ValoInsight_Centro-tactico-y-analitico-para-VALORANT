import { useEffect, useRef } from "react";
import BackButton from "../../components/BackButton";
import FloatingActionButton from "../../components/FloatingActionButton";
import "../Agentes.css";
import { AgentFilters } from "./components/AgentFilters";
import { AgentGrid } from "./components/AgentGrid";
import { AgentInlineDetail } from "./components/AgentInlineDetail";
import { AgentsHeader } from "./components/AgentsHeader";
import { useAgentesViewModel } from "./useAgentesViewModel";

export default function Agentes() {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const viewModel = useAgentesViewModel();

  useEffect(() => {
    if (viewModel.selectedAgent && detailRef.current) {
      detailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [viewModel.selectedAgent]);

  if (viewModel.isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando agentes</h2>
          <p>Plantando la spike...</p>
        </div>
      </div>
    );
  }

  if (viewModel.isError) {
    const message =
      viewModel.error instanceof Error
        ? viewModel.error.message
        : "No se pudo cargar la información de agentes.";

    return (
      <div className="agents-container">
        <BackButton />
        <div className="agents-state-card agents-state-card--error">
          <span className="agents-eyebrow">Valorant</span>
          <h1>No se pudieron cargar los agentes</h1>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-container">
      <BackButton />
      {viewModel.returnTo && (
        <FloatingActionButton
          label={viewModel.returnLabel}
          onClick={() => {
            if (viewModel.returnTo) viewModel.navigate(viewModel.returnTo);
          }}
          ariaLabel={viewModel.returnLabel}
        />
      )}

      <AgentsHeader
        activeRole={viewModel.activeRole}
        roles={viewModel.roles}
        roleSummary={viewModel.roleSummary}
        topAgents={viewModel.topAgents}
        onRoleChange={viewModel.setActiveRole}
      />
      <AgentFilters
        actFilter={viewModel.actFilter}
        actOptions={viewModel.actOptions}
        mapFilter={viewModel.mapFilter}
        mapOptions={viewModel.mapOptions}
        rankFilter={viewModel.rankFilter}
        rankOptions={viewModel.rankOptions}
        regionOptions={viewModel.regionOptions}
        summary={viewModel.filterSummary}
        search={viewModel.search}
        selectedRegion={viewModel.selectedRegion}
        sortKey={viewModel.sortKey}
        onActFilterChange={viewModel.setActFilter}
        onMapFilterChange={viewModel.setMapFilter}
        onRankFilterChange={viewModel.setRankFilter}
        onRegionChange={viewModel.setSelectedRegion}
        onSearchChange={viewModel.setSearch}
        onSortChange={viewModel.setSortKey}
        onResetFilters={viewModel.resetFilters}
      />
      {viewModel.selectedAgent && (
        <div ref={detailRef}>
          <AgentInlineDetail
            key={
              viewModel.selectedAgent.uuid ??
              viewModel.selectedAgent.id ??
              viewModel.selectedAgent.displayName
            }
            agent={viewModel.selectedAgent}
            hasSession={viewModel.hasSession}
            isRoleOpen={viewModel.isRoleOpen}
            onClose={viewModel.closeDetail}
            onToggleRole={() => viewModel.setIsRoleOpen((open) => !open)}
          />
        </div>
      )}

      <AgentGrid
        agents={viewModel.filteredAgents}
        selectedAgent={viewModel.selectedAgent}
        activeFilterLabels={viewModel.filterSummary.activeLabels}
        onSelect={viewModel.selectAgent}
        onResetFilters={viewModel.resetFilters}
      />
    </div>
  );
}
