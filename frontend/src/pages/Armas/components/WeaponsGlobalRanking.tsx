import { useMemo, useState } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { WeaponRankingItem } from "../types";

type Props = { ranking: WeaponRankingItem[] };
type RankingMode = "kills" | "headshot" | "rounds";

const rankingModes: Array<{ value: RankingMode; label: string }> = [
  { value: "kills", label: "Kills" },
  { value: "headshot", label: "HS%" },
  { value: "rounds", label: "Rondas" },
];

export function WeaponsGlobalRanking({ ranking }: Props) {
  const [mode, setMode] = useState<RankingMode>("kills");
  const displayedRanking = useMemo(() => {
    const candidates =
      mode === "headshot"
        ? ranking.filter((item) => item.hasSufficientHeadshotSample)
        : ranking;

    return [...candidates]
      .sort((a, b) => {
        if (mode === "headshot") {
          return b.headshotPct - a.headshotPct || b.kills - a.kills;
        }
        if (mode === "rounds") return b.rounds - a.rounds || b.kills - a.kills;
        return b.kills - a.kills || b.rounds - a.rounds;
      })
      .slice(0, 6);
  }, [mode, ranking]);
  const maxMetric = Math.max(
    1,
    ...displayedRanking.map((item) =>
      mode === "headshot"
        ? item.headshotPct
        : mode === "rounds"
          ? item.rounds
          : item.kills,
    ),
  );

  return (
    <section className="weapons-global-ranking" aria-label="Ranking global de armas">
      <div className="weapons-panel-header">
        <div>
          <span className="weapons-section-eyebrow">Ranking global</span>
          <h2>
            Top por{" "}
            {mode === "headshot"
              ? "headshot"
              : mode === "rounds"
                ? "rondas"
                : "kills"}
          </h2>
        </div>
        <div className="weapons-ranking-tabs" role="tablist" aria-label="Modo de ranking">
          {rankingModes.map((option) => (
            <button
              key={option.value}
              type="button"
              className={mode === option.value ? "active" : ""}
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {displayedRanking.length === 0 ? (
        <div className="weapons-panel-empty">
          {mode === "headshot"
            ? "Sin armas con muestra suficiente para ranking de headshot."
            : "Sin estadísticas globales de armas."}
        </div>
      ) : (
        <div className="weapons-global-list">
          {displayedRanking.map((weapon, index) => {
            const metricValue =
              mode === "headshot"
                ? weapon.headshotPct
                : mode === "rounds"
                  ? weapon.rounds
                  : weapon.kills;

            return (
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
                  {mode === "headshot" && <em>Muestra suficiente</em>}
                  <div className="weapons-ranking-bar" aria-hidden="true">
                    <i style={{ width: `${(metricValue / maxMetric) * 100}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

