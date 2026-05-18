import { X } from "lucide-react";
import { formatWeaponCost } from "../weaponUtils";
import type { EnrichedWeapon } from "../types";

type Props = {
  weapons: EnrichedWeapon[];
  compareWeapons: EnrichedWeapon[];
  isOpen: boolean;
  onClose: () => void;
  onToggleCompare: (weapon: EnrichedWeapon) => void;
  onClear: () => void;
};

function getWeaponKey(weapon: EnrichedWeapon) {
  return weapon.uuid ?? weapon.displayName;
}

function getCompareDisabledReason(
  weapon: EnrichedWeapon,
  compareWeapons: EnrichedWeapon[],
  selected: boolean,
) {
  if (selected) return null;
  if (compareWeapons.length >= 2) return "Ya hay 2 armas seleccionadas.";
  const first = compareWeapons[0];
  if (first && Boolean(first.isShield) !== Boolean(weapon.isShield)) {
    return "No se puede comparar un arma con un escudo.";
  }
  return null;
}

export function WeaponCompareSelector({
  weapons,
  compareWeapons,
  isOpen,
  onClose,
  onToggleCompare,
  onClear,
}: Props) {
  if (!isOpen) return null;

  return (
    <section className="weapon-compare-selector" aria-label="Selector de comparacion de armas">
      <header className="weapon-compare-selector__header">
        <div>
          <span className="weapons-section-eyebrow">Comparacion</span>
          <h2>Selecciona 2 armas</h2>
          <p>{compareWeapons.length}/2 armas seleccionadas</p>
        </div>
        <div className="weapon-compare-selector__actions">
          {compareWeapons.length > 0 && (
            <button type="button" onClick={onClear} aria-label="Limpiar seleccion de comparacion">
              Limpiar
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Cerrar selector de comparacion">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="weapon-compare-selector__grid">
        {weapons.map((weapon) => {
          const key = getWeaponKey(weapon);
          const selected = compareWeapons.some((item) => getWeaponKey(item) === key);
          const disabledReason = getCompareDisabledReason(weapon, compareWeapons, selected);
          const disabled = Boolean(disabledReason);
          return (
            <button
              key={key}
              type="button"
              className={`weapon-compare-selector-card${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${selected ? "Quitar" : "Agregar"} ${weapon.displayName} a comparacion`}
              title={disabledReason ?? "Comparar arma"}
              disabled={disabled}
              onClick={() => onToggleCompare(weapon)}
            >
              {weapon.displayIcon && <img src={weapon.displayIcon} alt="" />}
              <span>
                <strong>{weapon.displayName}</strong>
                <small>{weapon.normalizedCategory}</small>
              </span>
              <em>{formatWeaponCost(weapon.cost)}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
