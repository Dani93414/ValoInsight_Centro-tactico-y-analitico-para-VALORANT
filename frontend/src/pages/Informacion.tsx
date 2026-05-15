import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCeremonies,
  useCompetitiveTiers,
  useContracts,
  useCurrencies,
  useVersion,
} from "../api/hooks";
import type {
  CeremonyContent,
  ContractContent,
} from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
  ClearableSearchInput,
} from "./contentPageUtils";
import {
  formatNumber,
  formatValue,
  hideBrokenImage,
  normalizeText,
} from "./contentFormatters";
import "./ContentPages.css";

type InfoTab = "version" | "rangos" | "economia" | "contratos" | "finalRonda";

const INFO_TABS: Array<{ key: InfoTab; label: string }> = [
  { key: "version", label: "Version" },
  { key: "rangos", label: "Rangos" },
  { key: "economia", label: "Economia" },
  { key: "contratos", label: "Contratos" },
  { key: "finalRonda", label: "Final de ronda" },
];

function formatCost(value?: number | null) {
  if (value === undefined || value === null || value < 0) return "-";
  return String(value);
}

function formatVersionValue(key: string, value: unknown) {
  if (key === "buildDate" && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    }
    return value.replace(/Z$/, "");
  }

  return formatValue(value);
}

function hasVersionData(version?: Record<string, unknown>) {
  return Boolean(version && Object.keys(version).length > 0);
}

function getTopbarOffset() {
  const topbar = document.querySelector(".app-topbar");
  if (!(topbar instanceof HTMLElement)) {
    return 96;
  }
  return Math.ceil(topbar.getBoundingClientRect().height + 20);
}

function scrollToElement(element: HTMLElement | null) {
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - getTopbarOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export default function Informacion() {
  const versionQuery = useVersion();
  const competitiveTiersQuery = useCompetitiveTiers();
  const currenciesQuery = useCurrencies();
  const ceremoniesQuery = useCeremonies();
  const contractsQuery = useContracts();
  const [activeTab, setActiveTab] = useState<InfoTab>("version");
  const [showExtra, setShowExtra] = useState(false);
  const [openContractKey, setOpenContractKey] = useState<string | null>(null);
  const [contractSearch, setContractSearch] = useState("");
  const [contractSearchMenuOpen, setContractSearchMenuOpen] = useState(false);
  const contractRefs = useRef(new Map<string, HTMLElement>());

  const queries = [
    versionQuery,
    competitiveTiersQuery,
    currenciesQuery,
    ceremoniesQuery,
    contractsQuery,
  ];

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const retryAll = () => queries.forEach((query) => query.refetch());

  const contracts = useMemo(
    () =>
      [...((contractsQuery.data ?? []) as ContractContent[])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [contractsQuery.data],
  );
  const ceremonies = (ceremoniesQuery.data ?? []) as CeremonyContent[];
  const versionMainEntries = Object.entries(versionQuery.data?.main ?? {});
  const versionExtraEntries = Object.entries(versionQuery.data?.extra ?? {});
  const competitiveTiers = competitiveTiersQuery.data ?? [];
  const rankedTiers = competitiveTiers.filter((tier) => (tier.tier ?? 0) > 0);
  const divisionNames = new Set(
    rankedTiers
      .map((tier) => tier.divisionName || tier.tierName)
      .filter(Boolean),
  );
  const currencies = useMemo(
    () =>
      [...(currenciesQuery.data ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [currenciesQuery.data],
  );
  const contractSearchNeedle = normalizeText(contractSearch);
  const filteredContracts = useMemo(() => {
    if (!contractSearchNeedle) return contracts;

    return contracts.filter((contract) => {
      const chapters = contract.chapters ?? [];
      const searchable = [
        contract.displayName,
        contract.uuid,
        ...chapters.map((chapter) => `capitulo ${chapter.chapter}`),
        ...chapters.flatMap((chapter) =>
          (chapter.levels ?? []).map(
            (level) =>
              `capitulo ${chapter.chapter} nivel ${level.level} xp ${level.xp ?? ""} vp ${level.vpCost ?? ""} dough ${level.doughCost ?? ""}`,
          ),
        ),
      ].join(" ");

      return normalizeText(searchable).includes(contractSearchNeedle);
    });
  }, [contractSearchNeedle, contracts]);
  const contractSuggestions = useMemo(
    () =>
      filteredContracts.slice(0, 8).map((contract) => {
        const chapters = contract.chapters ?? [];
        const levels = chapters.reduce(
          (total, chapter) => total + (chapter.levels?.length ?? 0),
          0,
        );

        return {
          key: contract.uuid ?? contract.displayName,
          label: contract.displayName,
          meta: `${chapters.length} capitulos - ${levels} niveles`,
        };
      }),
    [filteredContracts],
  );

  const hasAnyData =
    hasVersionData(versionQuery.data?.main) ||
    hasVersionData(versionQuery.data?.extra) ||
    (competitiveTiersQuery.data?.length ?? 0) > 0 ||
    (currenciesQuery.data?.length ?? 0) > 0 ||
    (ceremoniesQuery.data?.length ?? 0) > 0 ||
    (contractsQuery.data?.length ?? 0) > 0;

  useEffect(() => {
    if (!openContractKey) return;
    window.requestAnimationFrame(() => {
      scrollToElement(contractRefs.current.get(openContractKey) ?? null);
    });
  }, [openContractKey]);

  if (isLoading) {
    return <ContentLoading title="Cargando informacion" />;
  }

  return (
    <ContentShell
      title="Informacion"
      subtitle="Version, rangos, economia, contratos y datos de sistema del contenido actual."
    >
      {isError && (
        <ContentError
          message="No se pudo cargar toda la informacion de contenido."
          onRetry={retryAll}
        />
      )}

      {!isError && !hasAnyData && (
        <ContentEmpty message="No hay informacion disponible." />
      )}

      {!isError && hasAnyData && (
        <>
          <div className="content-tabs" role="tablist" aria-label="Informacion">
            {INFO_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`content-tab ${activeTab === tab.key ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "version" && (
            <ContentSection title="Version">
              <div className="content-panel">
                <div className="content-kv-grid">
                  {versionMainEntries.map(([key, value]) => (
                    <div className="content-kv" key={key}>
                      <span>{key}</span>
                      <strong>{formatVersionValue(key, value)}</strong>
                    </div>
                  ))}
                </div>
                {hasVersionData(versionQuery.data?.extra) && (
                  <>
                    <button
                      className="content-primary-btn"
                      type="button"
                      onClick={() => setShowExtra((prev) => !prev)}
                    >
                      {showExtra ? "Ocultar extra" : "Mostrar extra"}
                    </button>
                    {showExtra && (
                      <div className="content-kv-grid">
                        {versionExtraEntries.map(([key, value]) => (
                          <div className="content-kv" key={key}>
                            <span>{key}</span>
                            <strong>{formatVersionValue(key, value)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ContentSection>
          )}

          {activeTab === "rangos" && (
            <ContentSection title="Rangos competitivos">
              {competitiveTiers.length === 0 ? (
                <ContentEmpty message="No hay rangos competitivos." />
              ) : (
                <>
                  <div className="info-stat-grid">
                    <article className="info-stat-card">
                      <span>Tiers</span>
                      <strong>{formatNumber(rankedTiers.length)}</strong>
                      <small>Excluyendo entradas vacias</small>
                    </article>
                    <article className="info-stat-card">
                      <span>Divisiones</span>
                      <strong>{formatNumber(divisionNames.size)}</strong>
                      <small>Grupos competitivos</small>
                    </article>
                  </div>

                  <table className="content-table info-rank-table">
                    <thead>
                      <tr>
                        <th>Icono</th>
                        <th>Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitiveTiers.map((tier) => (
                        <tr key={`${tier.tier}-${tier.tierName}`}>
                          <td>
                            {tier.smallIcon && (
                              <img
                                className="content-table-icon"
                                src={tier.smallIcon}
                                alt={tier.tierName ?? tier.divisionName ?? "Rango"}
                                onError={hideBrokenImage}
                              />
                            )}
                          </td>
                          <td>{tier.tierName ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </ContentSection>
          )}

          {activeTab === "economia" && (
            <ContentSection title="Economia">
              {currencies.length === 0 ? (
                <ContentEmpty message="No hay monedas disponibles." />
              ) : (
                <div className="content-panel">
                  <div className="info-panel-intro">
                    <h3 className="content-panel-title">Monedas del contenido</h3>
                  </div>
                  <div className="info-currency-grid">
                    {currencies.map((currency) => (
                      <article
                        className="info-currency-card"
                        key={currency.uuid ?? currency.displayName}
                      >
                        {(currency.displayIcon ||
                          currency.largeIcon ||
                          currency.rewardPreviewIcon) && (
                          <img
                            src={
                              currency.displayIcon ||
                              currency.largeIcon ||
                              currency.rewardPreviewIcon ||
                              ""
                            }
                            alt={currency.displayName}
                            onError={hideBrokenImage}
                          />
                        )}
                        <strong>{currency.displayName}</strong>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </ContentSection>
          )}

          {activeTab === "contratos" && (
            <ContentSection title="Contratos">
              {contracts.length === 0 ? (
                <ContentEmpty message="No hay contratos disponibles." />
              ) : (
                <>
                  <div className="content-toolbar content-toolbar--skins info-contract-toolbar">
                    <label className="content-select-label content-select-label--premium content-filter-field--search">
                      Buscar
                      <ClearableSearchInput
                        inputClassName="content-search--premium"
                        placeholder="Buscar contratos, capitulos o niveles"
                        value={contractSearch}
                        onChange={(event) => {
                          setContractSearch(event.target.value);
                          setContractSearchMenuOpen(true);
                          setOpenContractKey(null);
                        }}
                        onClear={() => {
                          setContractSearch("");
                          setContractSearchMenuOpen(false);
                          setOpenContractKey(null);
                        }}
                        onFocus={() => setContractSearchMenuOpen(true)}
                        onBlur={() =>
                          window.setTimeout(() => setContractSearchMenuOpen(false), 120)
                        }
                      />
                      {contractSearchMenuOpen && contractSuggestions.length > 0 && (
                        <div className="cskins-search-menu" role="listbox">
                          {contractSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.key}
                              type="button"
                              className="cskins-search-option"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setContractSearch(suggestion.label);
                                setContractSearchMenuOpen(false);
                                setOpenContractKey(suggestion.key);
                              }}
                            >
                              <span className="cskins-search-option-thumb">
                                <span className="cskins-search-folder-icon" aria-hidden="true" />
                              </span>
                              <span className="cskins-search-option-copy">
                                <strong>{suggestion.label}</strong>
                                <small>{suggestion.meta}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </label>
                    <span className="content-result-count">
                      {filteredContracts.length} contratos
                    </span>
                  </div>

                  {filteredContracts.length === 0 ? (
                    <ContentEmpty message="No hay contratos con esa busqueda." />
                  ) : (
                    <div className="info-contract-list">
                      {filteredContracts.map((contract) => {
                    const contractKey = contract.uuid ?? contract.displayName;
                    const chapters = contract.chapters ?? [];
                    const levels = chapters.flatMap((chapter) =>
                      (chapter.levels ?? []).map((level) => ({
                        chapter: chapter.chapter,
                        ...level,
                      })),
                    );
                    const stats = levels.reduce(
                      (summary, level) => ({
                        xp: summary.xp + (level.xp ?? 0),
                        vp: summary.vp + Math.max(0, level.vpCost ?? 0),
                        dough: summary.dough + Math.max(0, level.doughCost ?? 0),
                      }),
                      { xp: 0, vp: 0, dough: 0 },
                    );
                    const isOpen = openContractKey === contractKey;

                    return (
                      <article
                        className={`info-contract-card ${isOpen ? "is-open" : ""}`}
                        key={contractKey}
                        ref={(element) => {
                          if (element) contractRefs.current.set(contractKey, element);
                          else contractRefs.current.delete(contractKey);
                        }}
                      >
                        <button
                          className="info-contract-toggle"
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpenContractKey(isOpen ? null : contractKey)
                          }
                        >
                          <span className="info-contract-title-block">
                            <strong>{contract.displayName}</strong>
                            <small>{chapters.length} capitulos - {levels.length} niveles</small>
                          </span>
                          <span className="info-contract-open-label">
                            {isOpen ? "Cerrar" : "Abrir"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="info-contract-detail">
                            <div className="info-stat-grid">
                              <article className="info-stat-card">
                                <span>Capitulos</span>
                                <strong>{formatNumber(chapters.length)}</strong>
                              </article>
                              <article className="info-stat-card">
                                <span>Niveles</span>
                                <strong>{formatNumber(levels.length)}</strong>
                              </article>
                              <article className="info-stat-card">
                                <span>XP</span>
                                <strong>{formatNumber(stats.xp)}</strong>
                              </article>
                              <article className="info-stat-card">
                                <span>VP</span>
                                <strong>{formatNumber(stats.vp)}</strong>
                              </article>
                              <article className="info-stat-card">
                                <span>Dough</span>
                                <strong>{formatNumber(stats.dough)}</strong>
                              </article>
                            </div>

                            {levels.length === 0 ? (
                              <ContentEmpty message="No hay niveles en este contrato." />
                            ) : (
                              <div className="info-contract-chapters">
                                {chapters.map((chapter) => {
                                  const chapterLevels = chapter.levels ?? [];
                                  const chapterStats = chapterLevels.reduce<{
                                    xp: number;
                                    vp: number;
                                    dough: number;
                                  }>(
                                    (summary, level) => ({
                                      xp: summary.xp + (level.xp ?? 0),
                                      vp: summary.vp + Math.max(0, level.vpCost ?? 0),
                                      dough:
                                        summary.dough +
                                        Math.max(0, level.doughCost ?? 0),
                                    }),
                                    { xp: 0, vp: 0, dough: 0 },
                                  );

                                  return (
                                    <section
                                      className="info-contract-chapter"
                                      key={`${contractKey}-${chapter.chapter}`}
                                    >
                                      <header className="info-contract-chapter-head">
                                        <h3>Capitulo {chapter.chapter ?? "-"}</h3>
                                        <span>
                                          {chapterLevels.length} niveles - {formatNumber(chapterStats.xp)} XP
                                        </span>
                                      </header>
                                      <table className="content-table">
                                        <thead>
                                          <tr>
                                            <th>Nivel</th>
                                            <th>XP</th>
                                            <th>VP</th>
                                            <th>Dough</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {chapterLevels.map((row, index) => (
                                            <tr
                                              key={`${contractKey}-${chapter.chapter}-${row.level}-${index}`}
                                            >
                                              <td>{row.level ?? "-"}</td>
                                              <td>{row.xp ?? "-"}</td>
                                              <td>{formatCost(row.vpCost)}</td>
                                              <td>{formatCost(row.doughCost)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </section>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                      })}
                    </div>
                  )}
                </>
              )}
            </ContentSection>
          )}

          {activeTab === "finalRonda" && (
            <ContentSection title="Final de ronda">
              {ceremonies.length === 0 ? (
                <ContentEmpty message="No hay finales de ronda disponibles." />
              ) : (
                <div className="content-grid info-round-end-grid">
                  {ceremonies.map((ceremony) => (
                    <div
                      className="content-card content-card--static info-round-end-card"
                      key={ceremony.uuid ?? ceremony.displayName}
                    >
                      <h2 className="content-card-title">
                        {ceremony.displayName}
                      </h2>
                    </div>
                  ))}
                </div>
              )}
            </ContentSection>
          )}
        </>
      )}
    </ContentShell>
  );
}
