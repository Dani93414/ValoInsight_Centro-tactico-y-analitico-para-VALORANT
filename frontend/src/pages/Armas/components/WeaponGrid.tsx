import type { EnrichedWeapon } from "../types";
import { WeaponCard } from "./WeaponCard";

type Props = {
  weaponsByCategory: Record<string, EnrichedWeapon[]>;
  selectedWeapon: EnrichedWeapon | null;
  activeFilterLabels: string[];
  onSelect: (weapon: EnrichedWeapon) => void;
  onResetFilters: () => void;
};

function getWeaponKey(weapon: EnrichedWeapon) {
  return weapon.uuid ?? weapon.displayName;
}

export function WeaponGrid({
  weaponsByCategory,
  selectedWeapon,
  activeFilterLabels,
  onSelect,
  onResetFilters,
}: Props) {
  const entries = Object.entries(weaponsByCategory);

  if (entries.length === 0) {
    return (
      <div className="weapons-empty-state">
        <span className="weapons-section-eyebrow">Sin resultados</span>
        <h2>No se encontraron armas</h2>
        <p>No hay elementos del arsenal que encajen con los filtros activos.</p>
        {activeFilterLabels.length > 0 && (
          <div className="weapons-empty-filters">
            {activeFilterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
        <button type="button" className="weapons-empty-action" onClick={onResetFilters}>
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <>
      {entries.map(([category, weapons]) => (
        <section key={category} className="weapons-category">
          <h2 className="weapons-category-title">{category}</h2>
          <div className="weapons-grid">
            {weapons.map((weapon) => {
              const active =
                Boolean(selectedWeapon) &&
                getWeaponKey(selectedWeapon ?? weapon) === getWeaponKey(weapon);
              return (
                <WeaponCard
                  key={getWeaponKey(weapon)}
                  weapon={weapon}
                  active={active}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

