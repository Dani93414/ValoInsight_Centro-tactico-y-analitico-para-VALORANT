import { formatNumber } from "../../../utils/formatters";
import type { WeaponOverviewStats } from "../types";

type Props = { overview: WeaponOverviewStats };

export function WeaponsHeader({ overview }: Props) {
  const kpis = [
    ["Total armas", formatNumber(overview.totalWeapons), "Arsenal disponible"],
    ["Escudos", formatNumber(overview.totalShields), "Gear defensivo"],
    ["Categorias", formatNumber(overview.categories), "Familias del arsenal"],
    ["Top kills", overview.topKillsWeapon, "Mayor impacto global"],
    ["Mejor HS", overview.bestHeadshotWeapon, "Con muestra suficiente"],
    ["Kills globales", formatNumber(overview.totalKills), "Volumen analizado"],
  ];

  return (
    <header className="weapons-header">
      <div className="weapons-header-copy">
        <span className="weapons-eyebrow">Valorant</span>
        <h1 className="weapons-title">Armas</h1>
        <p className="weapons-subtitle">
          Explora el arsenal, costes, dano y rendimiento global.
        </p>
        <div className="weapons-divider" />
      </div>
      <div className="weapons-overview-kpis" aria-label="KPIs rapidos de armas">
        {kpis.map(([label, value, hint]) => (
          <article key={label} className="weapons-kpi-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
    </header>
  );
}

