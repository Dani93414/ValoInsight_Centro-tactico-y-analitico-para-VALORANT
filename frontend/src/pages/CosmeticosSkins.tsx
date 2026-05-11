import { Fragment, useCallback, useMemo, useState } from "react";
import { useContentTiers, useSkins } from "../api/hooks";
import type { SkinContent, SkinVariantContent } from "../types/content";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import "./ContentPages.css";

type GroupMode = "weapon" | "theme";

type SkinGroup = {
  key: string;
  label: string;
  items: SkinContent[];
};

const getSkinKey = (item: SkinContent) => item.uuid ?? item.displayName;
const getThemeName = (item: SkinContent) => item.themeName || "Default";
const getVariantImage = (item?: SkinVariantContent | null) =>
  item?.fullRender || item?.displayIcon || null;

function SkinVariantSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SkinVariantContent[];
  onChange: (value: string) => void;
}) {
  if (options.length <= 1) {
    return null;
  }

  return (
    <label className="content-select-label content-select-label--premium">
      {label}
      <select
        id={id}
        className="content-select content-select--premium"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option, index) => (
          <option key={option.uuid ?? option.displayName} value={option.uuid ?? ""}>
            {option.displayName || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function SkinDetail({
  item,
  tierName,
  onClose,
}: {
  item: SkinContent;
  tierName?: string | null;
  onClose: () => void;
}) {
  const chromas = item.chromas ?? [];
  const levels = item.levels ?? [];
  const [selectedChromaUuid, setSelectedChromaUuid] = useState(
    chromas[0]?.uuid ?? "",
  );
  const [selectedLevelUuid, setSelectedLevelUuid] = useState(
    levels[0]?.uuid ?? "",
  );

  const selectedChroma =
    chromas.find((chroma) => chroma.uuid === selectedChromaUuid) ?? chromas[0];
  const selectedLevel =
    levels.find((level) => level.uuid === selectedLevelUuid) ?? levels[0];
  const selectedChromaImage = getVariantImage(selectedChroma);
  const selectedLevelImage = getVariantImage(selectedLevel);
  const featuredImage =
    selectedChromaImage || selectedLevelImage || item.displayIcon || null;
  const themeName = getThemeName(item);

  return (
    <article className="content-detail skin-inline-detail">
      <button
        className="content-detail-close"
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
      >
        x
      </button>
      <div className="content-detail-grid skin-detail-grid">
        <div className="skin-detail-copy">
          <h2 className="content-detail-title">{item.displayName}</h2>
          <div className="content-badge-row">
            <span className="content-badge">{item.weaponName ?? "Arma"}</span>
            <span className="content-badge">{themeName}</span>
            {tierName && <span className="content-badge">{tierName}</span>}
          </div>

          <div className="skin-variant-controls">
            <SkinVariantSelect
              id={`skin-chroma-${getSkinKey(item)}`}
              label="Chroma"
              value={selectedChromaUuid}
              options={chromas}
              onChange={setSelectedChromaUuid}
            />
            <SkinVariantSelect
              id={`skin-level-${getSkinKey(item)}`}
              label="Nivel"
              value={selectedLevelUuid}
              options={levels}
              onChange={setSelectedLevelUuid}
            />
          </div>

          <div className="content-kv-grid skin-detail-facts">
            <div className="content-kv">
              <span>Arma</span>
              <strong>{item.weaponName ?? "Desconocida"}</strong>
            </div>
            <div className="content-kv">
              <span>Linea</span>
              <strong>{themeName}</strong>
            </div>
            <div className="content-kv">
              <span>Rareza</span>
              <strong>{tierName ?? "Sin rareza"}</strong>
            </div>
            <div className="content-kv">
              <span>Chromas</span>
              <strong>{item.chromasCount ?? chromas.length}</strong>
            </div>
            <div className="content-kv">
              <span>Niveles</span>
              <strong>{item.levelsCount ?? levels.length}</strong>
            </div>
          </div>
        </div>

        <div className="content-detail-media skin-detail-media">
          {item.wallpaper && (
            <img
              className="skin-detail-wallpaper"
              src={item.wallpaper}
              alt=""
              aria-hidden="true"
              onError={hideBrokenImage}
            />
          )}
          {featuredImage && (
            <img
              className="content-detail-image skin-detail-weapon"
              src={featuredImage}
              alt={item.displayName}
              onError={hideBrokenImage}
            />
          )}
          {item.displayIcon && featuredImage !== item.displayIcon && (
            <img
              className="skin-detail-base-icon"
              src={item.displayIcon}
              alt={`${item.displayName} display icon`}
              onError={hideBrokenImage}
            />
          )}
          {selectedLevelImage && selectedLevelImage !== featuredImage && (
            <img
              className="skin-detail-level-icon"
              src={selectedLevelImage}
              alt={selectedLevel?.displayName ?? "Nivel seleccionado"}
              onError={hideBrokenImage}
            />
          )}
        </div>
      </div>
    </article>
  );
}

export default function CosmeticosSkins() {
  const query = useSkins();
  const tiersQuery = useContentTiers();
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("weapon");
  const [weaponFilter, setWeaponFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedSkinKey, setSelectedSkinKey] = useState<string | null>(null);

  const tierNames = useMemo(() => {
    const map = new Map<string, string>();
    (tiersQuery.data ?? []).forEach((tier) => {
      if (tier.uuid) {
        map.set(tier.uuid, tier.displayName);
      }
    });
    return map;
  }, [tiersQuery.data]);

  const items = useMemo(
    () =>
      [...(query.data ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [query.data],
  );

  const weaponOptions = useMemo(() => {
    const weapons = new Set(
      items
        .map((item) => item.weaponName)
        .filter((name): name is string => Boolean(name)),
    );
    return [...weapons].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const themeOptions = useMemo(() => {
    const themes = new Set(items.map((item) => getThemeName(item)));
    return [...themes].sort((a, b) => {
      if (a === "Default") return -1;
      if (b === "Default") return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  const tierOptions = useMemo(() => {
    const tiers = new Set(
      items
        .map((item) => item.contentTierUuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    );
    return [...tiers]
      .map((uuid) => ({ uuid, label: tierNames.get(uuid) ?? uuid }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, tierNames]);

  const getTierName = useCallback(
    (item: SkinContent) =>
      item.contentTierUuid ? tierNames.get(item.contentTierUuid) : null,
    [tierNames],
  );

  const filtered = useMemo(() => {
    const needle = normalizeText(search);
    return items.filter((item) => {
      const tierName = getTierName(item) ?? "";
      const searchText = `${item.displayName} ${item.weaponName ?? ""} ${getThemeName(item)} ${tierName}`;
      return (
        normalizeText(searchText).includes(needle) &&
        (weaponFilter === "all" || item.weaponName === weaponFilter) &&
        (themeFilter === "all" || getThemeName(item) === themeFilter) &&
        (tierFilter === "all" || item.contentTierUuid === tierFilter)
      );
    });
  }, [getTierName, items, search, themeFilter, tierFilter, weaponFilter]);

  const groups = useMemo<SkinGroup[]>(() => {
    const map = new Map<string, SkinContent[]>();
    filtered.forEach((item) => {
      const label =
        groupMode === "weapon" ? item.weaponName || "Sin arma" : getThemeName(item);
      const current = map.get(label) ?? [];
      current.push(item);
      map.set(label, current);
    });

    return [...map.entries()]
      .map(([label, groupItems]) => ({
        key: `${groupMode}:${label}`,
        label,
        items: groupItems.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }))
      .sort((a, b) => {
        if (a.label === "Default") return -1;
        if (b.label === "Default") return 1;
        return a.label.localeCompare(b.label);
      });
  }, [filtered, groupMode]);

  const selectedSkin = selectedSkinKey
    ? items.find((item) => getSkinKey(item) === selectedSkinKey)
    : null;

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleSelectSkin = (item: SkinContent, groupKey: string) => {
    const key = getSkinKey(item);
    setOpenGroups((current) => new Set(current).add(groupKey));
    setSelectedSkinKey((current) => (current === key ? null : key));
  };

  if (query.isLoading) {
    return <ContentLoading title="Cargando skins" />;
  }

  return (
    <ContentShell
      title="Skins"
      subtitle="Coleccion de apariencias de armas agrupadas por arma base o linea de skins."
    >
      {query.isError && (
        <ContentError
          message="No se pudo cargar esta categoria de cosmeticos."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && items.length === 0 && (
        <ContentEmpty message="No hay skins disponibles." />
      )}

      {!query.isError && items.length > 0 && (
        <>
          <div className="content-toolbar content-toolbar--skins">
            <label className="content-select-label content-select-label--premium content-filter-field--search">
              Buscar
              <input
                className="content-search content-search--premium"
                type="search"
                placeholder="Buscar skin..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="content-inline-controls content-inline-controls--premium">
              <label className="content-select-label content-select-label--premium">
                Agrupar
                <select
                  className="content-select content-select--premium"
                  value={groupMode}
                  onChange={(event) => {
                    setGroupMode(event.target.value as GroupMode);
                    setOpenGroups(new Set());
                    setSelectedSkinKey(null);
                  }}
                >
                  <option value="weapon">Por arma</option>
                  <option value="theme">Por linea</option>
                </select>
              </label>
              <label className="content-select-label content-select-label--premium">
                Arma
                <select
                  className="content-select content-select--premium"
                  value={weaponFilter}
                  onChange={(event) => setWeaponFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {weaponOptions.map((weapon) => (
                    <option key={weapon} value={weapon}>
                      {weapon}
                    </option>
                  ))}
                </select>
              </label>
              <label className="content-select-label content-select-label--premium">
                Linea
                <select
                  className="content-select content-select--premium"
                  value={themeFilter}
                  onChange={(event) => setThemeFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {themeOptions.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </label>
              <label className="content-select-label content-select-label--premium">
                Rareza
                <select
                  className="content-select content-select--premium"
                  value={tierFilter}
                  onChange={(event) => setTierFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {tierOptions.map((tier) => (
                    <option key={tier.uuid} value={tier.uuid}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {groups.length === 0 ? (
            <ContentEmpty message="No hay resultados con ese filtro." />
          ) : (
            <div className="skin-group-list">
              {groups.map((group) => {
                const isOpen = openGroups.has(group.key);
                return (
                  <section className="skin-group" key={group.key}>
                    <button
                      className={`skin-group-toggle${isOpen ? " is-open" : ""}`}
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isOpen}
                    >
                      <span>{group.label}</span>
                      <strong>{group.items.length} skins</strong>
                    </button>

                    {isOpen && (
                      <div className="content-grid skin-group-grid">
                        {group.items.map((item) => {
                          const key = getSkinKey(item);
                          const active = selectedSkinKey === key;
                          const image = item.displayIcon || item.wallpaper;
                          return (
                            <Fragment key={`${key}-row`}>
                              {active && selectedSkin && (
                                <SkinDetail
                                  key={`${key}-detail`}
                                  item={selectedSkin}
                                  tierName={getTierName(selectedSkin)}
                                  onClose={() => setSelectedSkinKey(null)}
                                />
                              )}
                              <button
                                key={key}
                                className={`content-card ${active ? "active" : ""}`}
                                type="button"
                                onClick={() => handleSelectSkin(item, group.key)}
                              >
                                {image && (
                                  <span className="content-card-image-wrap">
                                    <img
                                      className="content-card-image"
                                      src={image}
                                      alt={item.displayName}
                                      loading="lazy"
                                      onError={hideBrokenImage}
                                    />
                                  </span>
                                )}
                                <h2 className="content-card-title">
                                  {item.displayName}
                                </h2>
                                <p className="content-card-meta">
                                  {[getThemeName(item), getTierName(item)]
                                    .filter(Boolean)
                                  .join(" · ")}
                                </p>
                              </button>
                            </Fragment>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
