import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { WeaponRankingItem } from "../types";

type Props = { ranking: WeaponRankingItem[] };

export function WeaponsGlobalRanking({ ranking }: Props) {
  const maxKills = Math.max(1, ...ranking.map((item) => item.kills));

  return (
    <section className="weapons-global-ranking" aria-label="Ranking global de armas">
      <div className="weapons-panel-header">
        <div>
          <span className="weapons-section-eyebrow">Ranking global</span>
          <h2>Top por kills</h2>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="weapons-panel-empty">Sin estadisticas globales de armas.</div>
      ) : (
        <div className="weapons-global-list">
          {ranking.map((weapon, index) => (
            <article key={weapon.id} className="weapons-global-item">
              <span className="weapons-rank">#{index + 1}</span>
              {weapon.image && <img src={weapon.image} alt="" loading="lazy" />}
              <div className="weapons-global-copy">
                <strong>{weapon.name}</strong>
                <small>
                  {formatNumber(weapon.kills)} kills ·{" "}
                  {formatPercent(weapon.headshotPct)} HS ·{" "}
                  {formatNumber(weapon.rounds)} rondas
                </small>
                <div className="weapons-ranking-bar" aria-hidden="true">
                  <i style={{ width: `${(weapon.kills / maxKills) * 100}%` }} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

