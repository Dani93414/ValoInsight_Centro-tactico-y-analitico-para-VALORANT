import { GitCompare } from "lucide-react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import {
  formatWeaponCost,
  isMeleeWeapon,
} from "../weaponUtils";
import type { EnrichedWeapon } from "../types";

type Props = {
  weapon: EnrichedWeapon;
  active: boolean;
  compareActive: boolean;
  compareDisabled: boolean;
  compareDisabledReason?: string | null;
  onSelect: (weapon: EnrichedWeapon) => void;
  onToggleCompare: (weapon: EnrichedWeapon) => void;
};

export function WeaponCard({
  weapon,
  active,
  compareActive,
  compareDisabled,
  compareDisabledReason,
  onSelect,
  onToggleCompare,
}: Props) {
  const kills = weapon.globalStats?.kills ?? 0;
  const rounds = weapon.globalStats?.rounds_equipped ?? 0;
  const headshot = weapon.globalStats?.headshot_pct;
  const isShield = Boolean(weapon.isShield);
  const isMelee = isMeleeWeapon(weapon);
  const hasStats = kills > 0 || rounds > 0;
  const hasLowSample = weapon.sampleReliability === "Baja muestra";
  const headshotWidth = Math.max(0, Math.min(headshot ?? 0, 100));

  return (
    <article
      className={`weapon-card ${active ? "active" : ""}`}
    >
      <button
        type="button"
        className={`weapon-card-compare ${compareActive ? "is-active" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleCompare(weapon);
        }}
        disabled={compareDisabled}
        aria-pressed={compareActive}
        aria-label={`${compareActive ? "Quitar" : "Agregar"} ${weapon.displayName} a comparación`}
        title={compareDisabledReason ?? "Comparar arma"}
      >
        <GitCompare size={16} aria-hidden="true" />
      </button>
      {hasLowSample && <span className="weapon-stat-badge is-low">Baja muestra</span>}

      <button
        type="button"
        className="weapon-card-main"
        onClick={() => onSelect(weapon)}
        aria-pressed={active}
        aria-label={`${active ? "Ocultar" : "Ver"} detalles de ${weapon.displayName}`}
      >
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
            <strong>
              {isShield
                  ? formatPercent(weapon.globalStats?.win_rate)
                  : hasStats
                    ? `${formatNumber(kills)} kills`
                    : "-"}
            </strong>
          </div>
          <div className="weapon-card-meta-row">
            <span>{rounds > 0 ? `${formatNumber(rounds)} rondas` : "Sin rondas"}</span>
            <strong>
              {isShield
                  ? formatPercent(weapon.globalStats?.survival_rate)
                  : isMelee && hasStats
                    ? `${formatNumber(rounds)} rondas`
                    : hasStats
                    ? formatPercent(headshot)
                    : "-"}
            </strong>
          </div>
          {!isMelee && !isShield && (
            <div
              className="weapon-headshot-bar"
              aria-label={hasStats ? `Headshot ${formatPercent(headshot)}` : "Sin headshot"}
            >
              <i style={{ width: `${hasStats ? headshotWidth : 0}%` }} />
            </div>
          )}
          {hasLowSample && <span className="weapon-sample-badge">Baja muestra</span>}
        </div>
      </button>
    </article>
  );
}
