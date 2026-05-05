import { formatNumber, formatPercent } from "../../../utils/formatters";
import { formatWeaponCost } from "../weaponUtils";
import type { EnrichedWeapon } from "../types";

type Props = {
  weapon: EnrichedWeapon;
  active: boolean;
  onSelect: (weapon: EnrichedWeapon) => void;
};

export function WeaponCard({ weapon, active, onSelect }: Props) {
  const kills = weapon.globalStats?.kills ?? 0;
  const rounds = weapon.globalStats?.rounds_equipped ?? 0;
  const headshot = weapon.globalStats?.headshot_pct;
  const hasStats = kills > 0 || rounds > 0;
  const headshotWidth = Math.max(0, Math.min(headshot ?? 0, 100));

  return (
    <button
      type="button"
      className={`weapon-card ${active ? "active" : ""}`}
      onClick={() => onSelect(weapon)}
      aria-pressed={active}
      aria-label={`${active ? "Ocultar" : "Ver"} detalles de ${weapon.displayName}`}
    >
      <span className={`weapon-stat-badge ${hasStats ? "is-ready" : "is-muted"}`}>
        {hasStats ? "Con stats" : "Sin stats"}
      </span>

      {weapon.displayIcon && (
        <div className="weapon-image-frame">
          <img
            src={weapon.displayIcon}
            alt={weapon.displayName}
            className="weapon-image"
            loading="lazy"
          />
        </div>
      )}

      <div className="weapon-card-body">
        <h3 className="weapon-card-name">{weapon.displayName}</h3>
        <p className="weapon-card-category">{weapon.normalizedCategory}</p>
        <div className="weapon-card-meta-row">
          <span>{formatWeaponCost(weapon.cost)}</span>
          <strong>{hasStats ? `${formatNumber(kills)} kills` : "-"}</strong>
        </div>
        <div className="weapon-card-meta-row">
          <span>{rounds > 0 ? `${formatNumber(rounds)} rondas` : "Sin rondas"}</span>
          <strong>{hasStats ? formatPercent(headshot) : "-"}</strong>
        </div>
        <div
          className="weapon-headshot-bar"
          aria-label={hasStats ? `Headshot ${formatPercent(headshot)}` : "Sin headshot"}
        >
          <i style={{ width: `${hasStats ? headshotWidth : 0}%` }} />
        </div>
        <span className="weapon-sample-badge">{weapon.sampleReliability}</span>
      </div>
    </button>
  );
}
