import { useId, useState } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { EnrichedWeapon, WeaponPersonalComparison } from "../types";
import {
  buildWeaponProfileSummary,
  formatWeaponCost,
  formatWeaponValue,
  STAT_LABELS,
} from "../weaponUtils";
import { WeaponDamageTable } from "./WeaponDamageTable";

type Props = {
  weapon: EnrichedWeapon;
  personalComparison: WeaponPersonalComparison | null;
  onClose: () => void;
};

function StatGrid({ entries }: { entries: Array<[string, unknown]> }) {
  return (
    <div className="weapon-stats-grid">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{STAT_LABELS[key] || key}</span>
          <strong>{formatWeaponValue(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function PersonalComparisonPanel({
  comparison,
}: {
  comparison: WeaponPersonalComparison;
}) {
  if (comparison.isLoading) {
    return (
      <div className="weapon-personal-skeleton" role="status">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (comparison.isError) {
    return <p className="weapons-panel-empty">{comparison.summary}</p>;
  }

  if (!comparison.hasPersonalUsage) {
    return <p className="weapons-panel-empty">{comparison.summary}</p>;
  }

  return (
    <div className="weapon-comparison">
      <div className="weapon-comparison-summary">
        <span className="weapon-sample-badge">{comparison.sampleReliability}</span>
        <p>{comparison.summary}</p>
      </div>
      <div className="weapon-comparison-grid">
        {comparison.metrics.map((metric) => (
          <article
            key={metric.key}
            className={`weapon-comparison-metric tone-${metric.tone}`}
          >
            <div className="weapon-comparison-metric-header">
              <strong>{metric.label}</strong>
              <span>
                {metric.tone === "positive"
                  ? "Positiva"
                  : metric.tone === "improve"
                    ? "Mejorable"
                    : "Neutral"}
              </span>
            </div>
            <div className="weapon-comparison-values">
              <span>Global: {metric.globalLabel}</span>
              <span>Tú: {metric.personalLabel}</span>
              <strong>{metric.diffLabel}</strong>
            </div>
            <p>{metric.feedback}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function WeaponInlineDetail({ weapon, personalComparison, onClose }: Props) {
  const [globalOpen, setGlobalOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const globalId = useId();
  const baseId = useId();
  const adsId = useId();
  const damageId = useId();
  const personalId = useId();

  const stats = weapon.globalStats;
  const baseEntries = Object.entries(weapon.stats ?? {}).filter(([, value]) => value !== undefined && value !== null);
  const adsEntries = Object.entries(weapon.adsStats ?? {}).filter(([, value]) => value !== undefined && value !== null);
  const damageRanges = weapon.damageRanges ?? [];
  const globalStats = [
    ["Kills", formatNumber(stats?.kills)],
    ["Rondas equipada", formatNumber(stats?.rounds_equipped)],
    ["Headshot", formatPercent(stats?.headshot_pct)],
    ["Daño total", formatNumber(stats?.damage_dealt)],
  ];
  const globalPreview =
    (stats?.kills ?? 0) > 0 || (stats?.rounds_equipped ?? 0) > 0
      ? `${formatNumber(stats?.kills)} kills · ${formatPercent(stats?.headshot_pct)} HS · ${weapon.sampleReliability}`
      : "Sin estadísticas globales";
  const basePreview =
    baseEntries.length > 0 ? `${baseEntries.length} métricas` : "Sin métricas";
  const adsPreview =
    adsEntries.length > 0 ? `${adsEntries.length} métricas` : "Sin ADS";
  const hasOneTap = damageRanges.some((range) => range.headDamage >= 150);
  const damagePreview =
    damageRanges.length > 0
      ? `${damageRanges.length} rangos${hasOneTap ? " · One tap disponible" : ""}`
      : "Sin rangos";
  const personalPreview = personalComparison
    ? personalComparison.isLoading
      ? "Cargando tus estadísticas..."
      : personalComparison.hasPersonalUsage
        ? `${personalComparison.sampleReliability} · ${personalComparison.metrics.length} métricas`
        : personalComparison.summary
    : "";

  return (
    <article className="weapon-detail">
      <button
        type="button"
        className="weapon-detail-close"
        onClick={onClose}
        aria-label="Cerrar detalle"
      >
        x
      </button>

      <div className="weapon-detail-content">
        <div className="weapon-detail-left">
          <div className="weapon-detail-heading">
            <div>
              <span className="weapons-section-eyebrow">Ficha de arsenal</span>
              <h2 className="weapon-name">{weapon.displayName}</h2>
            </div>
            <span className="weapon-sample-badge">{weapon.sampleReliability}</span>
          </div>

          <div className="weapon-badges">
            <span>{weapon.normalizedCategory}</span>
            <span>{formatWeaponCost(weapon.cost)}</span>
          </div>

          <div className="weapon-global-stats">
            {globalStats.slice(0, 3).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          {weapon.description && <p className="weapon-description">{weapon.description}</p>}

          {weapon.profileTags.length > 0 && (
            <div className="weapon-tags">
              {weapon.profileTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className="weapon-profile-block">
            <span className="weapons-section-eyebrow">Perfil del arma</span>
            <p>{buildWeaponProfileSummary(weapon)}</p>
          </div>

          <section className={`weapon-collapsible ${globalOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="weapon-collapsible-toggle"
              onClick={() => setGlobalOpen((open) => !open)}
              aria-expanded={globalOpen}
              aria-controls={globalId}
            >
              <span>Estadísticas globales</span>
              <strong>{globalPreview}</strong>
              <i aria-hidden="true" />
            </button>
            {globalOpen && (
              <div id={globalId} className="weapon-collapsible-panel">
                <div className="weapon-stats-grid">
                  {globalStats.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={`weapon-collapsible ${baseOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="weapon-collapsible-toggle"
              onClick={() => setBaseOpen((open) => !open)}
              aria-expanded={baseOpen}
              aria-controls={baseId}
            >
              <span>Estadísticas base</span>
              <strong>{basePreview}</strong>
              <i aria-hidden="true" />
            </button>
            {baseOpen && (
              <div id={baseId} className="weapon-collapsible-panel">
                {baseEntries.length > 0 ? (
                  <StatGrid entries={baseEntries} />
                ) : (
                  <p className="weapons-panel-empty">Sin estadísticas base.</p>
                )}
              </div>
            )}
          </section>

          <section className={`weapon-collapsible ${adsOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="weapon-collapsible-toggle"
              onClick={() => setAdsOpen((open) => !open)}
              aria-expanded={adsOpen}
              aria-controls={adsId}
            >
              <span>Apuntar con mira</span>
              <strong>{adsPreview}</strong>
              <i aria-hidden="true" />
            </button>
            {adsOpen && (
              <div id={adsId} className="weapon-collapsible-panel">
                {adsEntries.length > 0 ? (
                  <StatGrid entries={adsEntries} />
                ) : (
                  <p className="weapons-panel-empty">Esta arma no tiene datos de mira.</p>
                )}
              </div>
            )}
          </section>

          <section className={`weapon-collapsible ${damageOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="weapon-collapsible-toggle"
              onClick={() => setDamageOpen((open) => !open)}
              aria-expanded={damageOpen}
              aria-controls={damageId}
            >
              <span>Daño por distancia</span>
              <strong>{damagePreview}</strong>
              <i aria-hidden="true" />
            </button>
            {damageOpen && (
              <div id={damageId} className="weapon-collapsible-panel">
                {damageRanges.length > 0 ? (
                  <WeaponDamageTable ranges={damageRanges} />
                ) : (
                  <p className="weapons-panel-empty">Sin rangos de daño disponibles.</p>
                )}
              </div>
            )}
          </section>

          {personalComparison && (
            <section className={`weapon-collapsible ${personalOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="weapon-collapsible-toggle"
                onClick={() => setPersonalOpen((open) => !open)}
                aria-expanded={personalOpen}
                aria-controls={personalId}
              >
                <span>Tus estadísticas vs global</span>
                <strong>{personalPreview}</strong>
                <i aria-hidden="true" />
              </button>
              {personalOpen && (
                <div id={personalId} className="weapon-collapsible-panel">
                  <PersonalComparisonPanel comparison={personalComparison} />
                </div>
              )}
            </section>
          )}
        </div>

        <div className="weapon-detail-right">
          {weapon.displayIcon && (
            <img
              src={weapon.displayIcon}
              alt={weapon.displayName}
              className="weapon-image-large"
            />
          )}
        </div>
      </div>
    </article>
  );
}
