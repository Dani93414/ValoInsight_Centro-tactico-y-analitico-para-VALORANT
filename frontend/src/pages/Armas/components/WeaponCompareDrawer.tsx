import { X } from "lucide-react";
import { formatNumber } from "../../../utils/formatters";
import { formatWeaponCost } from "../weaponUtils";
import type { EnrichedWeapon, WeaponCompareMetric } from "../types";

type Props = {
  weapons: EnrichedWeapon[];
  metrics: WeaponCompareMetric[];
  onClear: () => void;
  onRemove: (weapon: EnrichedWeapon) => void;
};

function getWeaponKey(weapon: EnrichedWeapon) {
  return weapon.uuid ?? weapon.displayName;
}

export function WeaponCompareDrawer({ weapons, metrics, onClear, onRemove }: Props) {
  if (weapons.length !== 2) return null;

  const [first, second] = weapons;

  return (
    <aside className="weapon-compare-drawer" aria-label={`Comparar: ${first.displayName} vs ${second.displayName}`}>
      <div className="weapon-compare-drawer__header">
        <div>
          <span className="weapons-section-eyebrow">Comparacion</span>
          <h2>
            Comparar: {first.displayName} vs {second.displayName}
          </h2>
        </div>
        <button type="button" className="weapon-compare-drawer__close" onClick={onClear} aria-label="Limpiar comparacion">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="weapon-compare-drawer__weapons">
        {weapons.map((weapon) => (
          <div key={getWeaponKey(weapon)} className="weapon-compare-chip">
            {weapon.displayIcon && <img src={weapon.displayIcon} alt="" />}
            <span>
              <strong>{weapon.displayName}</strong>
              <small>
                {weapon.normalizedCategory} · {formatWeaponCost(weapon.cost)}
              </small>
            </span>
            <button type="button" onClick={() => onRemove(weapon)} aria-label={`Quitar ${weapon.displayName} de comparacion`}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="weapon-compare-table" role="table" aria-label="Metricas comparadas entre armas">
        <div className="weapon-compare-row weapon-compare-row--head" role="row">
          <span role="columnheader">Metrica</span>
          <span role="columnheader">{first.displayName}</span>
          <span role="columnheader">{second.displayName}</span>
        </div>
        {metrics.map((metric) => {
          const max = Math.max(Math.abs(metric.firstValue ?? 0), Math.abs(metric.secondValue ?? 0), 1);
          return (
            <div key={metric.key} className="weapon-compare-row" role="row">
              <span role="cell">{metric.label}</span>
              <strong role="cell">
                {metric.firstLabel}
                <i style={{ width: `${Math.min(100, ((metric.firstValue ?? 0) / max) * 100)}%` }} aria-hidden="true" />
              </strong>
              <strong role="cell">
                {metric.secondLabel}
                <i style={{ width: `${Math.min(100, ((metric.secondValue ?? 0) / max) * 100)}%` }} aria-hidden="true" />
              </strong>
            </div>
          );
        })}
      </div>

      <div className="weapon-compare-summary">
        {weapons.map((weapon) => (
          <article key={`${getWeaponKey(weapon)}-summary`}>
            {weapon.displayIcon && <img src={weapon.displayIcon} alt={weapon.displayName} />}
            <div>
              <strong>{weapon.displayName}</strong>
              <span>{weapon.normalizedCategory}</span>
              <small>{formatNumber(weapon.globalStats?.rounds_equipped, 0)} rondas registradas</small>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
