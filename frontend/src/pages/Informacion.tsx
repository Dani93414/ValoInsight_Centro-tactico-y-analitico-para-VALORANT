import { useMemo, useState } from "react";
import {
  useCeremonies,
  useCompetitiveTiers,
  useContentTiers,
  useContracts,
  useCurrencies,
  useGear,
  useVersion,
} from "../api/hooks";
import type {
  CeremonyContent,
  ContractContent,
  GearContent,
} from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
} from "./contentPageUtils";
import {
  formatNumber,
  formatValue,
  hideBrokenImage,
} from "./contentFormatters";
import "./ContentPages.css";

type InfoTab = "version" | "rangos" | "economia" | "contratos" | "sistema";

const INFO_TABS: Array<{ key: InfoTab; label: string }> = [
  { key: "version", label: "Version" },
  { key: "rangos", label: "Rangos" },
  { key: "economia", label: "Economia" },
  { key: "contratos", label: "Contratos" },
  { key: "sistema", label: "Sistema" },
];

function formatCost(value?: number | null) {
  if (value === undefined || value === null || value < 0) return "-";
  return String(value);
}

function hasVersionData(version?: Record<string, unknown>) {
  return Boolean(version && Object.keys(version).length > 0);
}

function isCeremonyAvailable(ceremony: CeremonyContent) {
  return Boolean(ceremony.displayName && ceremony.displayName !== "-");
}

function getGearCost(gear: GearContent) {
  if (typeof gear.cost === "number") return formatNumber(gear.cost);
  return gear.cost ?? "-";
}

export default function Informacion() {
  const versionQuery = useVersion();
  const competitiveTiersQuery = useCompetitiveTiers();
  const contentTiersQuery = useContentTiers();
  const currenciesQuery = useCurrencies();
  const gearQuery = useGear();
  const ceremoniesQuery = useCeremonies();
  const contractsQuery = useContracts();
  const [activeTab, setActiveTab] = useState<InfoTab>("version");
  const [showExtra, setShowExtra] = useState(false);
  const [onlyAvailableCeremonies, setOnlyAvailableCeremonies] = useState(false);

  const queries = [
    versionQuery,
    competitiveTiersQuery,
    contentTiersQuery,
    currenciesQuery,
    gearQuery,
    ceremoniesQuery,
    contractsQuery,
  ];

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const retryAll = () => queries.forEach((query) => query.refetch());

  const contractsRows = useMemo(
    () =>
      (contractsQuery.data ?? []).flatMap((contract: ContractContent) =>
        (contract.chapters ?? []).flatMap((chapter) =>
          (chapter.levels ?? []).map((level) => ({
            contract: contract.displayName,
            chapter: chapter.chapter,
            ...level,
          })),
        ),
      ),
    [contractsQuery.data],
  );

  const ceremonies = (ceremoniesQuery.data ?? []).filter(
    (ceremony) => !onlyAvailableCeremonies || isCeremonyAvailable(ceremony),
  );

  const hasAnyData =
    hasVersionData(versionQuery.data?.main) ||
    hasVersionData(versionQuery.data?.extra) ||
    (competitiveTiersQuery.data?.length ?? 0) > 0 ||
    (contentTiersQuery.data?.length ?? 0) > 0 ||
    (currenciesQuery.data?.length ?? 0) > 0 ||
    (gearQuery.data?.length ?? 0) > 0 ||
    (ceremoniesQuery.data?.length ?? 0) > 0 ||
    (contractsQuery.data?.length ?? 0) > 0;

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
                  {Object.entries(versionQuery.data?.main ?? {}).map(
                    ([key, value]) => (
                      <div className="content-kv" key={key}>
                        <span>{key}</span>
                        <strong>{formatValue(value)}</strong>
                      </div>
                    ),
                  )}
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
                        {Object.entries(versionQuery.data?.extra ?? {}).map(
                          ([key, value]) => (
                            <div className="content-kv" key={key}>
                              <span>{key}</span>
                              <strong>{formatValue(value)}</strong>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ContentSection>
          )}

          {activeTab === "rangos" && (
            <>
              <ContentSection title="Rangos competitivos">
                {(competitiveTiersQuery.data?.length ?? 0) === 0 ? (
                  <ContentEmpty message="No hay rangos competitivos." />
                ) : (
                  <table className="content-table">
                    <thead>
                      <tr>
                        <th>Icono</th>
                        <th>Tier</th>
                        <th>Nombre</th>
                        <th>Division</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(competitiveTiersQuery.data ?? []).map((tier) => (
                        <tr key={`${tier.tier}-${tier.tierName}`}>
                          <td>
                            {tier.smallIcon && (
                              <img
                                className="content-table-icon"
                                src={tier.smallIcon}
                                alt={
                                  tier.tierName ?? tier.divisionName ?? "Rango"
                                }
                                onError={hideBrokenImage}
                              />
                            )}
                          </td>
                          <td>{tier.tier ?? "-"}</td>
                          <td>{tier.tierName ?? "-"}</td>
                          <td>{tier.divisionName ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ContentSection>

              <ContentSection title="Rarezas de contenido">
                {(contentTiersQuery.data?.length ?? 0) === 0 ? (
                  <ContentEmpty message="No hay content tiers." />
                ) : (
                  <div className="content-grid">
                    {(contentTiersQuery.data ?? []).map((tier) => (
                      <div
                        className="content-card"
                        key={tier.uuid ?? tier.displayName}
                      >
                        {tier.displayIcon && (
                          <span className="content-card-image-wrap">
                            <img
                              className="content-card-image"
                              src={tier.displayIcon}
                              alt={tier.displayName}
                              onError={hideBrokenImage}
                            />
                          </span>
                        )}
                        <h2 className="content-card-title">
                          {tier.displayName}
                        </h2>
                        <p className="content-card-meta">
                          {tier.rank !== undefined && tier.rank !== null
                            ? `Rank ${tier.rank}`
                            : "Content tier"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ContentSection>
            </>
          )}

          {activeTab === "economia" && (
            <ContentSection title="Economia">
              <div className="content-split">
                <div className="content-panel">
                  <h3 className="content-panel-title">Monedas</h3>
                  {(currenciesQuery.data?.length ?? 0) === 0 ? (
                    <ContentEmpty message="No hay monedas disponibles." />
                  ) : (
                    <div className="content-mini-list">
                      {(currenciesQuery.data ?? []).map((currency) => (
                        <div
                          className="content-mini-item"
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="content-panel">
                  <h3 className="content-panel-title">Equipo y costes</h3>
                  {(gearQuery.data?.length ?? 0) === 0 ? (
                    <ContentEmpty message="No hay equipo disponible." />
                  ) : (
                    <table className="content-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Categoria</th>
                          <th>Coste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(gearQuery.data ?? []).map((gear) => (
                          <tr key={gear.uuid ?? gear.displayName}>
                            <td>{gear.displayName}</td>
                            <td>{gear.category ?? "-"}</td>
                            <td>{getGearCost(gear)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </ContentSection>
          )}

          {activeTab === "contratos" && (
            <>
              <ContentSection title="Resumen de contratos">
                {(contractsQuery.data?.length ?? 0) === 0 ? (
                  <ContentEmpty message="No hay contratos disponibles." />
                ) : (
                  <table className="content-table">
                    <thead>
                      <tr>
                        <th>Contrato</th>
                        <th>Capitulos</th>
                        <th>Niveles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(contractsQuery.data ?? []).map((contract) => (
                        <tr key={contract.uuid ?? contract.displayName}>
                          <td>{contract.displayName}</td>
                          <td>{contract.chapters?.length ?? 0}</td>
                          <td>
                            {(contract.chapters ?? []).reduce(
                              (total, chapter) =>
                                total + (chapter.levels?.length ?? 0),
                              0,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ContentSection>

              <ContentSection title="Niveles de contrato">
                {contractsRows.length === 0 ? (
                  <ContentEmpty message="No hay niveles de contrato disponibles." />
                ) : (
                  <table className="content-table">
                    <thead>
                      <tr>
                        <th>Contrato</th>
                        <th>Capitulo</th>
                        <th>Nivel</th>
                        <th>XP</th>
                        <th>VP</th>
                        <th>Dough</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractsRows.map((row, index) => (
                        <tr
                          key={`${row.contract}-${row.chapter}-${row.level}-${index}`}
                        >
                          <td>{row.contract}</td>
                          <td>{row.chapter ?? "-"}</td>
                          <td>{row.level ?? "-"}</td>
                          <td>{row.xp ?? "-"}</td>
                          <td>{formatCost(row.vpCost)}</td>
                          <td>{formatCost(row.doughCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ContentSection>
            </>
          )}

          {activeTab === "sistema" && (
            <ContentSection title="Ceremonias">
              <div className="content-toolbar">
                <div className="content-filter-row">
                  <button
                    className={`content-filter-btn ${
                      !onlyAvailableCeremonies ? "active" : ""
                    }`}
                    type="button"
                    onClick={() => setOnlyAvailableCeremonies(false)}
                  >
                    Todas
                  </button>
                  <button
                    className={`content-filter-btn ${
                      onlyAvailableCeremonies ? "active" : ""
                    }`}
                    type="button"
                    onClick={() => setOnlyAvailableCeremonies(true)}
                  >
                    Disponibles
                  </button>
                </div>
              </div>
              {ceremonies.length === 0 ? (
                <ContentEmpty message="No hay ceremonias con ese filtro." />
              ) : (
                <div className="content-grid">
                  {ceremonies.map((ceremony) => (
                    <div
                      className="content-card"
                      key={ceremony.uuid ?? ceremony.displayName}
                    >
                      <h2 className="content-card-title">
                        {ceremony.displayName}
                      </h2>
                      <p className="content-card-meta">
                        {isCeremonyAvailable(ceremony)
                          ? "Disponible"
                          : "No disponible"}
                      </p>
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
