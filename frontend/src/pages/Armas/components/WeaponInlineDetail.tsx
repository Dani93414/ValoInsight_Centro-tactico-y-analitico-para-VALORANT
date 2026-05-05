import { useId, useState } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { EnrichedWeapon } from "../types";
import { formatWeaponCost, formatWeaponValue, STAT_LABELS } from "../weaponUtils";
import { WeaponDamageTable } from "./WeaponDamageTable";

type Props = {
  weapon: EnrichedWeapon;
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

export function WeaponInlineDetail({ weapon, onClose }: Props) {
  const [globalOpen, setGlobalOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const globalId = useId();
  const baseId = useId();
  const adsId = useId();
  const damageId = useId();

  const stats = weapon.globalStats;
  const baseEntries = Object.entries(weapon.stats ?? {}).filter(([, value]) => value !== undefined && value !== null);
  const adsEntries = Object.entries(weapon.adsStats ?? {}).filter(([, value]) => value !== undefined && value !== null);
  const damageRanges = weapon.damageRanges ?? [];
  const globalStats = [
    ["Kills", formatNumber(stats?.kills)],
    ["Rondas equipada", formatNumber(stats?.rounds_equipped)],
    ["Headshot", formatPercent(stats?.headshot_pct)],
    ["Dano total", formatNumber(stats?.damage_dealt)],
  ];
  const globalPreview =
    (stats?.kills ?? 0) > 0 || (stats?.rounds_equipped ?? 0) > 0
      ? `${formatNumber(stats?.kills)} kills · ${formatPercent(stats?.headshot_pct)} HS · ${weapon.sampleReliability}`
      : "Sin estadisticas globales";

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

          <section className={`weapon-collapsible ${globalOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="weapon-collapsible-toggle"
              onClick={() => setGlobalOpen((open) => !open)}
              aria-expanded={globalOpen}
              aria-controls={globalId}
            >
              <span>Estadisticas globales</span>
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
              <span>Estadisticas base</span>
              <strong>{baseEntries.length} metricas</strong>
              <i aria-hidden="true" />
            </button>
            {baseOpen && (
              <div id={baseId} className="weapon-collapsible-panel">
                {baseEntries.length > 0 ? (
                  <StatGrid entries={baseEntries} />
                ) : (
                  <p className="weapons-panel-empty">Sin estadisticas base.</p>
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
              <strong>{adsEntries.length > 0 ? `${adsEntries.length} metricas` : "Sin ADS"}</strong>
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
              <span>Dano por distancia</span>
              <strong>{damageRanges.length} rangos</strong>
              <i aria-hidden="true" />
            </button>
            {damageOpen && (
              <div id={damageId} className="weapon-collapsible-panel">
                {damageRanges.length > 0 ? (
                  <WeaponDamageTable ranges={damageRanges} />
                ) : (
                  <p className="weapons-panel-empty">Sin rangos de dano disponibles.</p>
                )}
              </div>
            )}
          </section>
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

