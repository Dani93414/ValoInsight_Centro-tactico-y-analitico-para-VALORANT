import { useEffect, useRef } from "react";
import BackButton from "../../components/BackButton";
import FloatingActionButton from "../../components/FloatingActionButton";
import "../Armas.css";
import { WeaponGrid } from "./components/WeaponGrid";
import { WeaponInlineDetail } from "./components/WeaponInlineDetail";
import { WeaponsFilters } from "./components/WeaponsFilters";
import { WeaponsGlobalRanking } from "./components/WeaponsGlobalRanking";
import { WeaponsHeader } from "./components/WeaponsHeader";
import { WeaponsHighlights } from "./components/WeaponsHighlights";
import { useArmasViewModel } from "./useArmasViewModel";

export default function Armas() {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const viewModel = useArmasViewModel();

  useEffect(() => {
    if (viewModel.selectedWeapon && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewModel.selectedWeapon]);

  if (viewModel.isLoading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando arsenal</h2>
          <p>Comprando en la tienda...</p>
        </div>
      </div>
    );
  }

  if (viewModel.isError) {
    const message =
      viewModel.error instanceof Error
        ? viewModel.error.message
        : "No se pudo cargar la información del arsenal.";

    return (
      <div className="weapons-container">
        <BackButton />
        <div className="weapons-state-card weapons-state-card--error">
          <span className="weapons-eyebrow">Valorant</span>
          <h1>No se pudo cargar el arsenal</h1>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weapons-container">
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

      <WeaponsHeader overview={viewModel.overviewStats} />
      <WeaponsFilters
        activeCategory={viewModel.activeCategory}
        activeCost={viewModel.activeCost}
        categories={viewModel.categories}
        search={viewModel.search}
        sortKey={viewModel.sortKey}
        statsFilter={viewModel.statsFilter}
        summary={viewModel.filterSummary}
        onCategoryChange={viewModel.setActiveCategory}
        onCostChange={viewModel.setActiveCost}
        onSearchChange={viewModel.setSearch}
        onSortChange={viewModel.setSortKey}
        onStatsFilterChange={viewModel.setStatsFilter}
        onResetFilters={viewModel.resetFilters}
        onClearFilter={viewModel.clearFilter}
      />
      <WeaponsHighlights insights={viewModel.insights} />
      <WeaponsGlobalRanking ranking={viewModel.ranking} />

      {viewModel.selectedWeapon && (
        <div ref={detailRef}>
          <WeaponInlineDetail
            key={viewModel.selectedWeapon.uuid ?? viewModel.selectedWeapon.displayName}
            weapon={viewModel.selectedWeapon}
            personalComparison={viewModel.personalComparison}
            onClose={() => viewModel.setSelectedWeapon(null)}
          />
        </div>
      )}

      <WeaponGrid
        weaponsByCategory={viewModel.weaponsByCategory}
        selectedWeapon={viewModel.selectedWeapon}
        activeFilters={viewModel.filterSummary.activeFilters}
        onSelect={viewModel.selectWeapon}
        onResetFilters={viewModel.resetFilters}
      />
    </div>
  );
}
